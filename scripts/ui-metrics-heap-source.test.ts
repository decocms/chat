import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  summarizeHeapSources,
  optionalHeapSourceAttribution,
} from "./ui-metrics-heap-source";
import {
  capturePrivateHeap,
  diagnosticScript,
  summarizeHeapSnapshot,
  type DiagnosticAsset,
  type DiagnosticScript,
  type HeapDiagnosticPort,
} from "./ui-metrics-diagnostics";
const sha = "a".repeat(64),
  other = "b".repeat(64);
const asset: DiagnosticAsset = {
  url: "http://127.0.0.1:1234/svelte-preview/Field-public.js?v=1",
  assetKey: "/svelte-preview/Field-public.js",
  sourceSHA256: sha,
  servedSHA256: sha,
};
const script: DiagnosticScript = { scriptId: "9", url: asset.url, hash: sha };
const scripts = new Map([["9", script]]);
function snapshot() {
  return {
    snapshot: {
      node_count: 3,
      meta: {
        node_fields: ["type", "name", "id", "self_size"],
        node_types: [
          ["closure", "object", "PRIVATE_TYPE"],
          "string",
          "number",
          "number",
        ],
        location_fields: [
          "object_index",
          "script_id",
          "line",
          "column",
          "script_object_index",
        ],
      },
    },
    nodes: [0, 0, 1, 24, 1, 1, 3, 40, 2, 2, 5, 8],
    locations: [0, 9, 17, 22, 0, 4, 999, 0, 0, 0],
    strings: [
      "PRIVATE_NAME",
      "PRIVATE_TOKEN🔒",
      "https://PRIVATE.invalid/?secret=VALUE",
    ],
  };
}
function ready(
  value: unknown,
  observed: readonly DiagnosticAsset[] = [asset],
  known: ReadonlyMap<string, DiagnosticScript | null> = scripts,
) {
  const result = summarizeHeapSources(value, observed, known);
  if (result.status !== "source-associated") throw Error(result.reason);
  return result;
}
test("flat offsets and metadata widths aggregate safe source-associated self size, not raw data", () => {
  const raw = snapshot(),
    before = JSON.stringify(raw);
  Object.freeze(raw.nodes);
  Object.freeze(raw.locations);
  Object.freeze(raw.strings);
  Object.freeze(raw);
  const result = ready(raw);
  expect(result.nodeCount).toBe(3);
  expect(result.selfSizeBytes).toBe(72);
  expect(result.associated).toEqual({ count: 1, selfSizeBytes: 24 });
  expect(result.unattributed).toEqual({ count: 2, selfSizeBytes: 48 });
  expect(result.locationCount).toBe(2);
  expect(result.withoutLocationCount).toBe(1);
  expect(result.unmatchedLocationCount).toBe(1);
  expect(result.byAssetAndType).toEqual([
    {
      asset: { key: asset.assetKey, sourceSHA256: sha, servedSHA256: sha },
      type: "closure",
      count: 1,
      selfSizeBytes: 24,
    },
  ]);
  expect(JSON.stringify(raw)).toBe(before);
  const encoded = JSON.stringify(result);
  for (const forbidden of [
    "PRIVATE",
    "🔒",
    "127.0.0.1",
    "scriptId",
    "line",
    "column",
    "nodes",
    "locations",
    "strings",
  ])
    expect(encoded.includes(forbidden)).toBe(false);
});
test("reordered metadata and extra numeric location fields use names, and vendor asset keys are eligible", () => {
  const raw = snapshot();
  raw.snapshot.meta.location_fields = [
    "column",
    "script_object_index",
    "script_id",
    "object_index",
    "line",
  ];
  raw.locations = [2, 0, 9, 4, 1];
  const vendor = {
    ...asset,
    assetKey: "/vendor/marked-public.js",
    url: "http://127.0.0.1:1234/vendor/marked-public.js?v=known",
  };
  const result = ready(
    raw,
    [vendor],
    new Map([["9", { ...script, url: vendor.url }]]),
  );
  expect(result.byAssetAndType[0]?.type).toBe("object");
  expect(result.associated).toEqual({ count: 1, selfSizeBytes: 40 });
});
test("missing/empty locations differ: missing is unverified, empty retains all unattributed totals", () => {
  const raw = snapshot();
  expect(
    summarizeHeapSources({ ...raw, locations: undefined }, [asset], scripts),
  ).toMatchObject({ status: "unverified", reason: "locations-missing" });
  const result = ready({ ...raw, locations: [] });
  expect(result.associated.count).toBe(0);
  expect(result.unattributed.selfSizeBytes).toBe(72);
  expect(result.withoutLocationCount).toBe(3);
});
test("malformed metadata, tuple completeness, safe integers, alignment, bounds and duplicates reject", () => {
  const raw = snapshot();
  const cases: unknown[] = [
    null,
    { ...raw, nodes: [0, 0] },
    { ...raw, snapshot: { ...raw.snapshot, node_count: 8 } },
    {
      ...raw,
      snapshot: {
        ...raw.snapshot,
        meta: {
          ...raw.snapshot.meta,
          node_fields: ["type", "type", "id", "self_size"],
        },
      },
    },
    {
      ...raw,
      snapshot: {
        ...raw.snapshot,
        meta: { ...raw.snapshot.meta, node_types: [] },
      },
    },
    { ...raw, nodes: [9, 0, 1, 24, 1, 1, 3, 40, 2, 2, 5, 8] },
    { ...raw, nodes: [0, 7, 1, 24, 1, 1, 3, 40, 2, 2, 5, 8] },
    { ...raw, nodes: [0, 0, 1, 24, 1, 1, 1, 40, 2, 2, 5, 8] },
    { ...raw, nodes: [0, 0, 1, -1, 1, 1, 3, 40, 2, 2, 5, 8] },
    {
      ...raw,
      nodes: [0, 0, 1, Number.MAX_SAFE_INTEGER, 1, 1, 3, 40, 2, 2, 5, 8],
    },
    { ...raw, locations: [1, 9, 0, 0, 0] },
    { ...raw, locations: [12, 9, 0, 0, 0] },
    { ...raw, locations: [0, 9, 0, 0] },
    { ...raw, locations: [0, 9, 0, 0, 0, 0, 9, 0, 0, 0] },
    { ...raw, locations: [0, -1, 0, 0, 0] },
    { ...raw, locations: [0, 9, NaN, 0, 0] },
    { ...raw, locations: [0, 9, 0, Infinity, 0] },
    { ...raw, locations: [0, 9, 0, 0, Number.MAX_SAFE_INTEGER + 1] },
    { ...raw, locations: [0, 9, 0, 0, 1] },
    { ...raw, locations: [0, 9, 0, 0, 12] },
  ];
  for (const value of cases)
    expect(summarizeHeapSources(value, [asset], scripts).status).toBe(
      "unverified",
    );
});
test("public path must agree with trusted registry key; version queries stay internal and old four-field tuples work", () => {
  const raw = snapshot();
  raw.snapshot.meta.location_fields = [
    "object_index",
    "script_id",
    "line",
    "column",
  ];
  raw.locations = [0, 9, 0, 0];
  expect(ready(raw).associated.count).toBe(1);
  for (const url of [
    "http://127.0.0.1:1234/private.js",
    "http://user:PRIVATE@127.0.0.1:1234/svelte-preview/Field-public.js",
    asset.url + "#PRIVATE",
    "http://127.0.0.1:1234/private/../svelte-preview/Field-public.js",
    "http://127.0.0.1:1234/%73velte-preview/Field-public.js",
    "http://127.0.0.1:1234/private/%2e%2e/svelte-preview/Field-public.js",
    "file:///svelte-preview/Field-public.js",
  ]) {
    expect(
      ready(raw, [{ ...asset, url }], new Map([["9", { ...script, url }]]))
        .associated.count,
    ).toBe(0);
  }
});
test("untrusted/reused IDs, URL/hash mismatch, eval/sourceURL, unsafe keys and inline assets stay unattributed", () => {
  for (const known of [
    new Map(),
    new Map([["9", null]]),
    new Map([["9", { ...script, scriptId: "10" }]]),
    new Map([["9", { ...script, hash: other }]]),
    new Map([["9", { ...script, url: asset.url + "&private=1" }]]),
    new Map([["9", diagnosticScript({ ...script, hasSourceURL: true })]]),
    new Map([["9", diagnosticScript({ ...script, stackTrace: {} })]]),
  ])
    expect(ready(snapshot(), [asset], known).associated.count).toBe(0);
  for (const key of [
    "//svelte-preview/app.js",
    "../app.js",
    "/svelte-preview/../app.js",
    "/app.html",
    "/app.js?PRIVATE_TOKEN",
    "https://PRIVATE.invalid/a.js",
  ])
    expect(
      ready(snapshot(), [{ ...asset, assetKey: key }]).associated.count,
    ).toBe(0);
  expect(
    ready(snapshot(), [asset, { ...asset, servedSHA256: other }]).associated
      .count,
  ).toBe(0);
  expect(
    ready(snapshot(), [{ ...asset, sourceSHA256: "bad" }]).associated.count,
  ).toBe(0);
});
test("off and measured paths never inspect snapshot or provenance and never mutate original summary", () => {
  const hostile = new Proxy(
    {},
    {
      get() {
        throw Error("snapshot inspected");
      },
    },
  );
  const options = {
    diagnosticContext: true,
    flag: undefined,
    get observed(): readonly DiagnosticAsset[] {
      throw Error("assets inspected");
    },
    get scripts(): ReadonlyMap<string, DiagnosticScript | null> {
      throw Error("scripts inspected");
    },
  };
  expect(optionalHeapSourceAttribution(hostile)).toBeUndefined();
  expect(optionalHeapSourceAttribution(hostile, options)).toBeUndefined();
  expect(
    optionalHeapSourceAttribution(hostile, {
      diagnosticContext: false,
      flag: "1",
      get observed(): readonly DiagnosticAsset[] {
        throw Error("assets inspected");
      },
      get scripts(): ReadonlyMap<string, DiagnosticScript | null> {
        throw Error("scripts inspected");
      },
    }),
  ).toBeUndefined();
});
test("private capture adds only optional sanitized sidecar and always discards raw file", async () => {
  const root = await mkdtemp(join(tmpdir(), "heap-source-test-")),
    artifacts = join(root, "artifacts"),
    temporary = join(root, "private");
  await mkdir(temporary);
  const raw = snapshot(),
    listeners = new Set<(event: unknown) => void>();
  const port: HeapDiagnosticPort = {
    on(_event, fn) {
      listeners.add(fn);
    },
    off(_event, fn) {
      listeners.delete(fn);
    },
    async send(method) {
      if (method === "HeapProfiler.takeHeapSnapshot")
        for (const fn of listeners) fn({ chunk: JSON.stringify(raw) });
      return {};
    },
  };
  try {
    const baseline = await capturePrivateHeap(
      port,
      artifacts,
      100000,
      temporary,
    );
    expect(baseline).not.toHaveProperty("heapSourceAttribution");
    const withSource = await capturePrivateHeap(
      port,
      artifacts,
      100000,
      temporary,
      { diagnosticContext: true, flag: "1", observed: [asset], scripts },
    );
    const { heapSourceAttribution, ...rest } = withSource;
    expect(rest).toEqual(baseline);
    expect(heapSourceAttribution).toEqual(ready(raw));
    expect(summarizeHeapSnapshot(raw).nodeCount).toBe(3);
    expect(await readdir(temporary)).toEqual([]);
    expect(await readdir(artifacts)).toEqual([]);
    expect(listeners.size).toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
