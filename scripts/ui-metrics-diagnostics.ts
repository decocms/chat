// Opt-in controlled-fixture diagnostics only. Raw heap contents never enter artifacts.
import assert from "node:assert/strict";
import {
  optionalHeapSourceAttribution,
  type HeapSourceOptions,
} from "./ui-metrics-heap-source";
import { writeFileSync, closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute, sep } from "node:path";
import { record } from "../shared/validation";

const safeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
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
const lengths = [0, 8, 32, 128, 512, 2048, 8192, 32768, Infinity];
export class MetricsDiagnosticFailure extends Error {
  constructor(
    readonly code:
      | "heap-limit"
      | "heap-write"
      | "heap-invalid"
      | "cpu-invalid"
      | "private-location"
      | "diagnostic-failed",
  ) {
    super(code);
  }
}
export function diagnosticFailure(error: unknown) {
  return error instanceof MetricsDiagnosticFailure
    ? error.code
    : "diagnostic-failed";
}
export type EntryHeapEvidence = {
  initialHeap?: Awaited<ReturnType<typeof capturePrivateHeap>>;
  /** Independent, sanitized secondary failure; never replaces the CPU rejection. */
  heapFailure?: ReturnType<typeof diagnosticFailure>;
};
/** Collect debug heap evidence even when entry CPU validation rejects the trial.
 * CPU rejection is always rethrown unchanged; this cannot accept a diagnostic sample. */
export async function collectEntryDiagnostics(
  evidence: EntryHeapEvidence,
  ports: {
    stopCPU(): Promise<void>;
    captureHeap(): Promise<Awaited<ReturnType<typeof capturePrivateHeap>>>;
  },
): Promise<void> {
  try {
    await ports.stopCPU();
  } catch (cpuError) {
    try {
      evidence.initialHeap = await ports.captureHeap();
    } catch (heapError) {
      evidence.heapFailure = diagnosticFailure(heapError);
    }
    throw cpuError;
  }
  evidence.initialHeap = await ports.captureHeap();
}
type CPUFailureReason =
  | "profile-not-object"
  | "nodes-not-array"
  | "samples-not-array"
  | "deltas-not-array"
  | "sample-delta-count-mismatch"
  | "node-not-object"
  | "node-id-invalid"
  | "node-id-duplicate"
  | "sample-id-invalid"
  | "sample-id-unknown"
  | "delta-not-number"
  | "delta-not-finite"
  | "delta-negative"
  | "delta-not-safe-integer"
  | "sampled-time-overflow"
  | "call-frame-invalid";
type CPUFailureCounts = {
  nodeCount: number | null;
  sampleCount: number | null;
  deltaCount: number | null;
};
/** Fixed enum and numeric positions/counts only. Never retain the rejected
 * node/frame, identifier, delta value, source, function name or profile. */
class CPUProfileFailure extends MetricsDiagnosticFailure {
  constructor(
    readonly reason: CPUFailureReason,
    readonly counts: Readonly<CPUFailureCounts>,
    readonly nodeIndex: number | null = null,
    readonly sampleIndex: number | null = null,
  ) {
    super("cpu-invalid");
  }
}
export function diagnosticCPUFailure(error: unknown) {
  if (!(error instanceof CPUProfileFailure)) return null;
  return {
    reason: error.reason,
    nodeIndex: error.nodeIndex,
    sampleIndex: error.sampleIndex,
    nodeCount: error.counts.nodeCount,
    sampleCount: error.counts.sampleCount,
    deltaCount: error.counts.deltaCount,
  };
}
export function summarizeHeapSnapshot(value: unknown) {
  if (
    !record(value) ||
    !record(value.snapshot) ||
    !record(value.snapshot.meta) ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.strings)
  )
    throw new MetricsDiagnosticFailure("heap-invalid");
  const fields: unknown = value.snapshot.meta.node_fields,
    types: unknown = value.snapshot.meta.node_types;
  if (
    !Array.isArray(fields) ||
    !fields.length ||
    !fields.every((field) => typeof field === "string") ||
    new Set(fields).size !== fields.length ||
    !Array.isArray(types)
  )
    throw new MetricsDiagnosticFailure("heap-invalid");
  const width = fields.length,
    typeIndex = fields.indexOf("type"),
    sizeIndex = fields.indexOf("self_size");
  const labels: unknown = types[typeIndex];
  if (
    typeIndex < 0 ||
    sizeIndex < 0 ||
    !Array.isArray(labels) ||
    !labels.every((label) => typeof label === "string") ||
    value.nodes.length % width ||
    !safeInteger(value.snapshot.node_count) ||
    value.snapshot.node_count !== value.nodes.length / width
  )
    throw new MetricsDiagnosticFailure("heap-invalid");
  const byType = new Map<
    string,
    { type: string; count: number; selfSizeBytes: number }
  >();
  let selfSizeBytes = 0;
  for (let offset = 0; offset < value.nodes.length; offset += width) {
    const type: unknown = value.nodes[offset + typeIndex],
      size: unknown = value.nodes[offset + sizeIndex];
    if (
      !safeInteger(type) ||
      !safeInteger(size) ||
      type >= labels.length ||
      !Number.isSafeInteger(selfSizeBytes + size)
    )
      throw new MetricsDiagnosticFailure("heap-invalid");
    const raw: unknown = labels[type],
      name = typeof raw === "string" && kinds.has(raw) ? raw : "other";
    const row = byType.get(name) ?? { type: name, count: 0, selfSizeBytes: 0 };
    row.count++;
    row.selfSizeBytes += size;
    selfSizeBytes += size;
    byType.set(name, row);
  }
  const buckets = lengths.map((maximum, index) => ({
    minimum: index === 0 ? 0 : lengths[index - 1] + 1,
    maximum: Number.isFinite(maximum) ? maximum : null,
    count: 0,
  }));
  let totalUTF16CodeUnits = 0;
  for (const text of value.strings) {
    if (
      typeof text !== "string" ||
      !Number.isSafeInteger(totalUTF16CodeUnits + text.length)
    )
      throw new MetricsDiagnosticFailure("heap-invalid");
    totalUTF16CodeUnits += text.length;
    const index = lengths.findIndex((maximum) => text.length <= maximum);
    buckets[index].count++;
  }
  return {
    nodeCount: value.snapshot.node_count,
    selfSizeBytes,
    byType: [...byType.values()].sort(
      (a, b) => b.selfSizeBytes - a.selfSizeBytes,
    ),
    strings: { count: value.strings.length, totalUTF16CodeUnits, buckets },
  };
}
export type DiagnosticAsset = {
  url: string;
  assetKey: string;
  sourceSHA256: string;
  servedSHA256: string;
};
export type DiagnosticScript = { scriptId: string; url: string; hash: string };
export function diagnosticScript(value: unknown): DiagnosticScript | null {
  if (
    !record(value) ||
    typeof value.scriptId !== "string" ||
    typeof value.url !== "string" ||
    typeof value.hash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(value.hash) ||
    value.hasSourceURL === true ||
    value.isLiveEdit === true ||
    value.stackTrace !== undefined
  )
    return null;
  return {
    scriptId: value.scriptId,
    url: value.url,
    hash: value.hash.toLowerCase(),
  };
}
export function summarizeCPUProfile(
  value: unknown,
  observed: readonly DiagnosticAsset[],
  scripts: ReadonlyMap<string, DiagnosticScript | null> = new Map(),
) {
  const counts: Readonly<CPUFailureCounts> = Object.freeze({
    nodeCount:
      record(value) && Array.isArray(value.nodes) ? value.nodes.length : null,
    sampleCount:
      record(value) && Array.isArray(value.samples)
        ? value.samples.length
        : null,
    deltaCount:
      record(value) && Array.isArray(value.timeDeltas)
        ? value.timeDeltas.length
        : null,
  });
  if (!record(value)) throw new CPUProfileFailure("profile-not-object", counts);
  if (!Array.isArray(value.nodes))
    throw new CPUProfileFailure("nodes-not-array", counts);
  if (!Array.isArray(value.samples))
    throw new CPUProfileFailure("samples-not-array", counts);
  if (!Array.isArray(value.timeDeltas))
    throw new CPUProfileFailure("deltas-not-array", counts);
  if (value.samples.length !== value.timeDeltas.length)
    throw new CPUProfileFailure("sample-delta-count-mismatch", counts);
  const assets = new Map(
    observed
      .filter(
        (asset) =>
          /^[a-f0-9]{64}$/.test(asset.sourceSHA256) &&
          /^[a-f0-9]{64}$/.test(asset.servedSHA256),
      )
      .map((asset) => [asset.url, asset]),
  );
  const times = new Map<
      number,
      { samples: number; selfTimeMicroseconds: number }
    >(),
    known = new Set<number>();
  let total = 0;
  for (let index = 0; index < value.nodes.length; index++) {
    const node: unknown = value.nodes[index];
    if (!record(node))
      throw new CPUProfileFailure("node-not-object", counts, index);
    if (!safeInteger(node.id))
      throw new CPUProfileFailure("node-id-invalid", counts, index);
    if (known.has(node.id))
      throw new CPUProfileFailure("node-id-duplicate", counts, index);
    known.add(node.id);
  }
  for (let i = 0; i < value.samples.length; i++) {
    const id: unknown = value.samples[i],
      delta: unknown = value.timeDeltas[i];
    if (!safeInteger(id))
      throw new CPUProfileFailure("sample-id-invalid", counts, null, i);
    if (!known.has(id))
      throw new CPUProfileFailure("sample-id-unknown", counts, null, i);
    if (typeof delta !== "number")
      throw new CPUProfileFailure("delta-not-number", counts, null, i);
    if (!Number.isFinite(delta))
      throw new CPUProfileFailure("delta-not-finite", counts, null, i);
    if (delta < 0)
      throw new CPUProfileFailure("delta-negative", counts, null, i);
    if (!safeInteger(delta))
      throw new CPUProfileFailure("delta-not-safe-integer", counts, null, i);
    if (!Number.isSafeInteger(total + delta))
      throw new CPUProfileFailure("sampled-time-overflow", counts, null, i);
    total += delta;
    const row = times.get(id) ?? { samples: 0, selfTimeMicroseconds: 0 };
    row.samples++;
    row.selfTimeMicroseconds += delta;
    times.set(id, row);
  }
  const frames = value.nodes.map((node, index) => {
    if (!record(node) || !safeInteger(node.id) || !record(node.callFrame))
      throw new CPUProfileFailure("call-frame-invalid", counts, index);
    const frame = node.callFrame,
      script =
        typeof frame.scriptId === "string" ? scripts.get(frame.scriptId) : null,
      candidate =
        typeof frame.url === "string" ? assets.get(frame.url) : undefined,
      asset =
        script &&
        script.url === frame.url &&
        script.hash === candidate?.servedSHA256
          ? candidate
          : undefined;
    const position = (n: unknown) =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= -1 ? n : null;
    const functionName =
      asset &&
      typeof frame.functionName === "string" &&
      frame.functionName.length <= 200
        ? frame.functionName
        : typeof frame.functionName === "string" &&
            ["(root)", "(program)", "(idle)", "(garbage collector)"].includes(
              frame.functionName,
            )
          ? frame.functionName
          : "[unattributed]";
    return {
      id: node.id,
      functionName,
      asset: asset
        ? {
            key: asset.assetKey,
            sourceSHA256: asset.sourceSHA256,
            servedSHA256: asset.servedSHA256,
          }
        : null,
      line: asset ? position(frame.lineNumber) : null,
      column: asset ? position(frame.columnNumber) : null,
      ...(times.get(node.id) ?? { samples: 0, selfTimeMicroseconds: 0 }),
    };
  });
  return {
    sampleCount: value.samples.length,
    assetMatchedSamples: frames.reduce(
      (sum, frame) => sum + (frame.asset ? frame.samples : 0),
      0,
    ),
    unattributedSamples: frames.reduce(
      (sum, frame) => sum + (frame.asset ? 0 : frame.samples),
      0,
    ),
    sampledMicroseconds: [...times.values()].reduce(
      (sum, row) => sum + row.selfTimeMicroseconds,
      0,
    ),
    frames: frames.sort(
      (a, b) => b.selfTimeMicroseconds - a.selfTimeMicroseconds,
    ),
    scope:
      "Sampled CPU self time; not wall time, gzip allocation or hardware acceptance",
  };
}
const inside = (parent: string, child: string) => {
  const path = relative(parent, child);
  return (
    path === "" ||
    (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
  );
};
/** UTF16LE preserves lone surrogate halves when CDP splits a JSON string across chunks. */
export const heapChunkBytes = (chunk: string) => Buffer.from(chunk, "utf16le");
export type HeapDiagnosticPort = {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(event: string, listener: (event: unknown) => void): void;
  off(event: string, listener: (event: unknown) => void): void;
};
export async function capturePrivateHeap(
  cdp: HeapDiagnosticPort,
  artifactDirectory: string,
  capBytes = 128 * 1024 * 1024,
  temporaryRoot = tmpdir(),
  sourceOptions?: HeapSourceOptions,
) {
  assert(safeInteger(capBytes) && capBytes > 0);
  await mkdir(artifactDirectory, { recursive: true });
  const directory = await mkdtemp(
    join(temporaryRoot, "vibebook-private-heap-"),
  );
  let fd: number | undefined,
    bytes = 0,
    failure: "heap-limit" | "heap-write" | null = null;
  const chunk = (event: unknown) => {
    if (failure) return;
    if (!record(event) || typeof event.chunk !== "string") {
      failure = "heap-write";
      return;
    }
    if (event.chunk.length > Math.floor((capBytes - bytes) / 2)) {
      failure = "heap-limit";
      return;
    }
    const data = heapChunkBytes(event.chunk);
    try {
      if (fd === undefined) throw Error("closed");
      writeFileSync(fd, data);
      bytes += data.length;
    } catch {
      failure = "heap-write";
    }
  };
  try {
    const actual = await realpath(directory),
      artifacts = await realpath(artifactDirectory);
    if (inside(artifacts, actual))
      throw new MetricsDiagnosticFailure("private-location");
    const path = join(directory, "snapshot.utf16le");
    fd = openSync(path, "wx", 0o600);
    cdp.on("HeapProfiler.addHeapSnapshotChunk", chunk);
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.takeHeapSnapshot", {
      reportProgress: false,
      captureNumericValue: false,
    });
    cdp.off("HeapProfiler.addHeapSnapshotChunk", chunk);
    closeSync(fd);
    fd = undefined;
    if (failure) throw new MetricsDiagnosticFailure(failure);
    let parsed: unknown;
    try {
      parsed = JSON.parse((await readFile(path)).toString("utf16le"));
    } catch {
      throw new MetricsDiagnosticFailure("heap-invalid");
    }
    const sourceAttribution = optionalHeapSourceAttribution(
      parsed,
      sourceOptions,
    );
    return {
      ...(sourceAttribution
        ? { heapSourceAttribution: sourceAttribution }
        : {}),
      status: "summarized",
      rawUTF16LEBytes: bytes,
      rawBytesCap: capBytes,
      rawRetained: false,
      ...summarizeHeapSnapshot(parsed),
    };
  } finally {
    try {
      cdp.off("HeapProfiler.addHeapSnapshotChunk", chunk);
    } finally {
      try {
        if (fd !== undefined) closeSync(fd);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
}
