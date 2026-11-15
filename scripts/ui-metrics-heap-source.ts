import { record } from "../shared/validation";
import type {
  DiagnosticAsset,
  DiagnosticScript,
} from "./ui-metrics-diagnostics";

const scope =
  "Source-associated node self size only; not retained bytes, ownership, dominators, RSS or performance acceptance";
const kinds = new Set([
  "hidden",
  "array",
  "string",
  "object",
  "code",
  "closure",
  "regexp",
  "number",
  "native",
  "synthetic",
  "concatenated string",
  "sliced string",
  "symbol",
  "bigint",
  "object shape",
]);
const integer = (n: unknown): n is number =>
  typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const digest = (s: string) => /^[a-f0-9]{64}$/.test(s);
type Reason =
  | "snapshot-shape"
  | "node-metadata"
  | "node-values"
  | "node-duplicate"
  | "size-overflow"
  | "locations-missing"
  | "location-metadata"
  | "location-values"
  | "location-duplicate";
class Invalid extends Error {
  constructor(readonly reason: Reason) {
    super(reason);
  }
}
function requireValue(ok: unknown, reason: Reason): asserts ok {
  if (!ok) throw new Invalid(reason);
}
function fields(value: unknown, reason: Reason): string[] {
  requireValue(
    Array.isArray(value) &&
      value.length &&
      value.every((v): v is string => typeof v === "string") &&
      new Set(value).size === value.length,
    reason,
  );
  return value;
}
type Totals = { count: number; selfSizeBytes: number };
function add(total: Totals, size: number) {
  requireValue(
    Number.isSafeInteger(total.selfSizeBytes + size) &&
      Number.isSafeInteger(total.count + 1),
    "size-overflow",
  );
  total.count++;
  total.selfSizeBytes += size;
}
function matchingPublicPath(asset: DiagnosticAsset) {
  try {
    const url = new URL(asset.url);
    const rawPath =
      /^https?:\/\/[^/?#]+(\/[^?#]*)?(?:\?[^#]*)?$/.exec(asset.url)?.[1] ?? "";
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      !url.username &&
      !url.password &&
      !url.hash &&
      rawPath === url.pathname &&
      !url.pathname.includes("%") &&
      url.pathname ===
        (asset.assetKey.startsWith("/") ? asset.assetKey : `/${asset.assetKey}`)
    );
  } catch {
    return false;
  }
}
/** Only network-observed external public JS with the existing script-ID/URL/
 * served-byte-SHA conjunction is eligible. Never emit a raw URL or node name. */
function trusted(
  observed: readonly DiagnosticAsset[],
  scripts: ReadonlyMap<string, DiagnosticScript | null>,
) {
  const assets = new Map<string, DiagnosticAsset | null>();
  for (const asset of observed) {
    if (
      !digest(asset.sourceSHA256) ||
      !digest(asset.servedSHA256) ||
      !matchingPublicPath(asset) ||
      !/^\/?(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.m?js$/.test(asset.assetKey) ||
      asset.assetKey.split("/").some((p) => p === "." || p === "..")
    )
      continue;
    const old = assets.get(asset.url);
    if (
      assets.has(asset.url) &&
      (!old ||
        old.assetKey !== asset.assetKey ||
        old.sourceSHA256 !== asset.sourceSHA256 ||
        old.servedSHA256 !== asset.servedSHA256)
    )
      assets.set(asset.url, null);
    else assets.set(asset.url, asset);
  }
  const result = new Map<string, DiagnosticAsset>();
  for (const [id, script] of scripts) {
    if (
      !script ||
      script.scriptId !== id ||
      !/^(?:0|[1-9][0-9]*)$/.test(id) ||
      !Number.isSafeInteger(Number(id))
    )
      continue;
    const asset = assets.get(script.url);
    if (asset && script.hash === asset.servedSHA256) result.set(id, asset);
  }
  return result;
}
export type HeapSourceOptions = {
  diagnosticContext: boolean;
  flag: string | undefined;
  observed: readonly DiagnosticAsset[];
  scripts: ReadonlyMap<string, DiagnosticScript | null>;
};
/** Gate BEFORE inspecting the private snapshot or provenance inputs. */
export function optionalHeapSourceAttribution(
  value: unknown,
  options?: HeapSourceOptions,
) {
  if (!options?.diagnosticContext || options.flag !== "1") return undefined;
  return summarizeHeapSources(value, options.observed, options.scripts);
}
export function summarizeHeapSources(
  value: unknown,
  observed: readonly DiagnosticAsset[],
  scripts: ReadonlyMap<string, DiagnosticScript | null>,
) {
  try {
    requireValue(
      record(value) &&
        record(value.snapshot) &&
        record(value.snapshot.meta) &&
        Array.isArray(value.nodes) &&
        Array.isArray(value.strings),
      "snapshot-shape",
    );
    const meta = value.snapshot.meta,
      nodes = value.nodes,
      strings = value.strings;
    const nf = fields(meta.node_fields, "node-metadata"),
      width = nf.length;
    requireValue(
      Array.isArray(meta.node_types) &&
        meta.node_types.length === width &&
        meta.node_types.every(
          (v) =>
            typeof v === "string" ||
            (Array.isArray(v) &&
              v.every((x) => typeof x === "string") &&
              new Set(v).size === v.length),
        ),
      "node-metadata",
    );
    const ti = nf.indexOf("type"),
      si = nf.indexOf("self_size"),
      ni = nf.indexOf("name"),
      ii = nf.indexOf("id");
    requireValue(
      ti >= 0 &&
        si >= 0 &&
        ni >= 0 &&
        ii >= 0 &&
        Array.isArray(meta.node_types[ti]) &&
        meta.node_types[ni] === "string" &&
        meta.node_types[ii] === "number" &&
        meta.node_types[si] === "number",
      "node-metadata",
    );
    const labels: unknown[] = meta.node_types[ti];
    requireValue(
      nodes.length % width === 0 &&
        integer(value.snapshot.node_count) &&
        value.snapshot.node_count === nodes.length / width,
      "node-metadata",
    );
    requireValue(
      strings.every((s) => typeof s === "string"),
      "node-values",
    );
    const ids = new Set<number>();
    const totals: Totals = { count: 0, selfSizeBytes: 0 };
    for (let off = 0; off < nodes.length; off += width) {
      for (let col = 0; col < width; col++)
        requireValue(integer(nodes[off + col]), "node-values");
      const type: unknown = nodes[off + ti],
        name: unknown = nodes[off + ni],
        id: unknown = nodes[off + ii],
        size: unknown = nodes[off + si];
      requireValue(
        integer(type) &&
          type < labels.length &&
          integer(name) &&
          name < strings.length &&
          integer(id) &&
          integer(size),
        "node-values",
      );
      requireValue(!ids.has(id), "node-duplicate");
      ids.add(id);
      add(totals, size);
    }
    requireValue(
      meta.location_fields !== undefined && value.locations !== undefined,
      "locations-missing",
    );
    const lf = fields(meta.location_fields, "location-metadata"),
      lw = lf.length;
    const oi = lf.indexOf("object_index"),
      sci = lf.indexOf("script_id"),
      li = lf.indexOf("line"),
      ci = lf.indexOf("column"),
      scriptObjectIndex = lf.indexOf("script_object_index");
    requireValue(
      oi >= 0 &&
        sci >= 0 &&
        li >= 0 &&
        ci >= 0 &&
        Array.isArray(value.locations) &&
        value.locations.length % lw === 0,
      "location-metadata",
    );
    const locations = value.locations,
      sources = trusted(observed, scripts),
      located = new Map<number, DiagnosticAsset | undefined>();
    for (let off = 0; off < locations.length; off += lw) {
      for (let col = 0; col < lw; col++)
        requireValue(integer(locations[off + col]), "location-values");
      const index: unknown = locations[off + oi],
        script: unknown = locations[off + sci];
      requireValue(
        integer(index) &&
          index < nodes.length &&
          index % width === 0 &&
          integer(script),
        "location-values",
      );
      requireValue(!located.has(index), "location-duplicate");
      if (scriptObjectIndex >= 0) {
        const scriptIndex: unknown = locations[off + scriptObjectIndex];
        requireValue(
          integer(scriptIndex) &&
            scriptIndex < nodes.length &&
            scriptIndex % width === 0,
          "location-values",
        );
      }
      located.set(index, sources.get(String(script)));
    }
    const associated: Totals = { count: 0, selfSizeBytes: 0 },
      unattributed: Totals = { count: 0, selfSizeBytes: 0 };
    const rows = new Map<
      string,
      {
        asset: { key: string; sourceSHA256: string; servedSHA256: string };
        type: string;
        count: number;
        selfSizeBytes: number;
      }
    >();
    for (let off = 0; off < nodes.length; off += width) {
      const size: unknown = nodes[off + si],
        type: unknown = nodes[off + ti];
      requireValue(integer(size) && integer(type), "node-values");
      const asset = located.get(off),
        raw: unknown = labels[type],
        kind = typeof raw === "string" && kinds.has(raw) ? raw : "other";
      if (!asset) {
        add(unattributed, size);
        continue;
      }
      add(associated, size);
      const key = JSON.stringify([
        asset.assetKey,
        asset.sourceSHA256,
        asset.servedSHA256,
        kind,
      ]);
      let row = rows.get(key);
      if (!row) {
        row = {
          asset: {
            key: asset.assetKey,
            sourceSHA256: asset.sourceSHA256,
            servedSHA256: asset.servedSHA256,
          },
          type: kind,
          count: 0,
          selfSizeBytes: 0,
        };
        rows.set(key, row);
      }
      add(row, size);
    }
    return {
      status: "source-associated" as const,
      scope,
      nodeCount: totals.count,
      selfSizeBytes: totals.selfSizeBytes,
      locationCount: located.size,
      withoutLocationCount: totals.count - located.size,
      unmatchedLocationCount: located.size - associated.count,
      associated,
      unattributed,
      byAssetAndType: [...rows.values()].sort(
        (a, b) =>
          a.asset.key.localeCompare(b.asset.key) ||
          a.type.localeCompare(b.type),
      ),
    };
  } catch (error) {
    return {
      status: "unverified" as const,
      scope,
      reason: error instanceof Invalid ? error.reason : "snapshot-shape",
    };
  }
}
