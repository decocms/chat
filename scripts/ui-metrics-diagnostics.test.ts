import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  summarizeHeapSnapshot,
  summarizeCPUProfile,
  diagnosticScript,
  heapChunkBytes,
  capturePrivateHeap,
  collectEntryDiagnostics,
  type EntryHeapEvidence,
  diagnosticFailure,
  diagnosticCPUFailure,
  MetricsDiagnosticFailure,
  type HeapDiagnosticPort,
} from "./ui-metrics-diagnostics";
const heap = () => ({
  snapshot: {
    meta: {
      node_fields: ["type", "name", "self_size"],
      node_types: [["object", "string", "PRIVATE_TYPE"], "string", "number"],
    },
    node_count: 3,
  },
  nodes: [0, 0, 24, 1, 1, 16, 2, 2, 8],
  strings: ["PRIVATE_VALUE_🔒", "", "a".repeat(40)],
});
test("heap projection emits fixed type totals and numeric UTF16 lengths, never names or contents", () => {
  const raw = heap(),
    summary = summarizeHeapSnapshot(raw),
    encoded = JSON.stringify(summary);
  expect(summary.nodeCount).toBe(3);
  expect(summary.selfSizeBytes).toBe(48);
  expect(summary.byType).toEqual([
    { type: "object", count: 1, selfSizeBytes: 24 },
    { type: "string", count: 1, selfSizeBytes: 16 },
    { type: "other", count: 1, selfSizeBytes: 8 },
  ]);
  expect(summary.strings.totalUTF16CodeUnits).toBe(
    raw.strings.reduce((n, value) => n + value.length, 0),
  );
  expect(
    summary.strings.buckets.reduce((n, bucket) => n + bucket.count, 0),
  ).toBe(3);
  expect(encoded.includes("PRIVATE")).toBe(false);
  expect(encoded.includes("🔒")).toBe(false);
});
test("malformed heap layouts, counts, types and sizes fail closed", () => {
  for (const raw of [
    { ...heap(), nodes: [0, 0] },
    { ...heap(), snapshot: { ...heap().snapshot, node_count: 7 } },
    { ...heap(), nodes: [9, 0, 24, 1, 1, 16, 2, 2, 8] },
    { ...heap(), nodes: [0, 0, -1, 1, 1, 16, 2, 2, 8] },
    { ...heap(), strings: [null] },
  ])
    expect(() => summarizeHeapSnapshot(raw)).toThrow("heap-invalid");
  expect(diagnosticFailure(Error("PRIVATE_FAILURE"))).toBe("diagnostic-failed");
});
test("UTF16LE streaming preserves split astral pairs and escaped unpaired surrogates", () => {
  const text = JSON.stringify({ value: "A🔒Z\ud800" }),
    split = text.indexOf("🔒") + 1;
  const decoded = Buffer.concat([
    heapChunkBytes(text.slice(0, split)),
    heapChunkBytes(text.slice(split)),
  ]).toString("utf16le");
  expect(decoded).toBe(text);
  expect(JSON.parse(decoded)).toEqual({ value: "A🔒Z\ud800" });
});
test("CPU summaries retain only observed asset frames and numeric sampled time", () => {
  const profile = {
    nodes: [
      {
        id: 1,
        callFrame: {
          scriptId: "trusted",
          functionName: "renderMessage",
          url: "http://fixture/app.js?v=known",
          lineNumber: 5,
          columnNumber: 7,
        },
      },
      {
        id: 2,
        callFrame: {
          scriptId: "untrusted",
          functionName: "PRIVATE_FUNCTION",
          url: "https://secret.invalid/token?secret=VALUE",
          lineNumber: 1,
          columnNumber: 1,
        },
      },
    ],
    samples: [1, 2, 1],
    timeDeltas: [1000, 500, 2000],
  };
  const observed = [
    {
      url: "http://fixture/app.js?v=known",
      assetKey: "svelte/app.js",
      sourceSHA256: "a".repeat(64),
      servedSHA256: "b".repeat(64),
    },
  ];
  const script = {
    scriptId: "trusted",
    url: observed[0].url,
    hash: observed[0].servedSHA256,
  };
  const summary = summarizeCPUProfile(
    profile,
    observed,
    new Map([["trusted", diagnosticScript(script)]]),
  );
  for (const parsed of [
    { ...script, hasSourceURL: true },
    { ...script, stackTrace: {} },
    { ...script, isLiveEdit: true },
    { ...script, hash: "c".repeat(64) },
  ]) {
    const spoof = {
      ...profile,
      nodes: profile.nodes.map((node) =>
        node.id === 1
          ? {
              ...node,
              callFrame: {
                ...node.callFrame,
                functionName: "PRIVATE_EVAL_NAME",
              },
            }
          : node,
      ),
    };
    const safe = summarizeCPUProfile(
      spoof,
      observed,
      new Map([["trusted", diagnosticScript(parsed)]]),
    );
    expect(JSON.stringify(safe)).not.toContain("PRIVATE");
    expect(safe.frames[0].asset).toBe(null);
  }
  expect(summarizeCPUProfile(profile, observed).frames[0].asset).toBe(null);
  expect(summary.sampleCount).toBe(3);
  expect(summary.sampledMicroseconds).toBe(3500);
  expect(summary.frames[0]).toMatchObject({
    functionName: "renderMessage",
    line: 5,
    column: 7,
    samples: 2,
    selfTimeMicroseconds: 3000,
  });
  expect(summary.frames[1]).toMatchObject({
    functionName: "[unattributed]",
    asset: null,
    line: null,
    column: null,
  });
  expect(JSON.stringify(summary)).not.toContain("PRIVATE");
  expect(JSON.stringify(summary)).not.toContain("secret");
  expect(() => summarizeCPUProfile({ ...profile, samples: [3] }, [])).toThrow(
    "cpu-invalid",
  );
  expect(() =>
    summarizeCPUProfile({ ...profile, timeDeltas: [-1, 500, 2000] }, []),
  ).toThrow("cpu-invalid");
});
function port(
  chunks: string[],
  fail = false,
): HeapDiagnosticPort & { listeners: Set<(event: unknown) => void> } {
  const listeners = new Set<(event: unknown) => void>();
  return {
    listeners,
    on(_event, listener) {
      listeners.add(listener);
    },
    off(_event, listener) {
      listeners.delete(listener);
    },
    async send(method) {
      if (method === "HeapProfiler.takeHeapSnapshot") {
        for (const chunk of chunks)
          for (const listener of listeners) listener({ chunk });
        if (fail) throw Error("PRIVATE_PROVIDER_MESSAGE");
      }
      return {};
    },
  };
}
test("private snapshot is summarized and ALWAYS removed, including cap/transport/parse failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "metrics-diagnostic-test-")),
    artifacts = join(root, "artifacts"),
    temporary = join(root, "private");
  await mkdir(temporary);
  await mkdir(artifacts);
  try {
    const text = JSON.stringify(heap()),
      split = text.indexOf("🔒") + 1,
      good = port([text.slice(0, split), text.slice(split)]);
    const summary = await capturePrivateHeap(
      good,
      artifacts,
      100000,
      temporary,
    );
    expect(summary.nodeCount).toBe(3);
    expect(summary.rawRetained).toBe(false);
    expect(summary.rawUTF16LEBytes).toBe(text.length * 2);
    expect(good.listeners.size).toBe(0);
    expect(await readdir(temporary)).toEqual([]);
    expect(await readdir(artifacts)).toEqual([]);
    for (const [bad, cap] of [
      [port([text]), 2],
      [port([text], true), 100000],
      [port(["bad JSON"]), 100000],
    ] as const) {
      await expect(
        capturePrivateHeap(bad, artifacts, cap, temporary),
      ).rejects.toThrow();
      expect(bad.listeners.size).toBe(0);
      expect(await readdir(temporary)).toEqual([]);
      expect(await readdir(artifacts)).toEqual([]);
    }
    await expect(
      capturePrivateHeap(port([text]), artifacts, 100000, artifacts),
    ).rejects.toThrow("private-location");
    expect(await readdir(artifacts)).toEqual([]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid CPU profiles expose only closed reasons and numeric indices/counts", () => {
  const profile = () => ({
    nodes: [
      {
        id: 1,
        callFrame: { functionName: "PRIVATE_FN", url: "PRIVATE_TOKEN" },
      },
      { id: 2, callFrame: {} },
    ],
    samples: [1, 2],
    timeDeltas: [10, 20],
  });
  const rows: {
    value: unknown;
    reason: string;
    nodeIndex?: number;
    sampleIndex?: number;
  }[] = [
    { value: null, reason: "profile-not-object" },
    {
      value: { ...profile(), nodes: "PRIVATE_NODES" },
      reason: "nodes-not-array",
    },
    {
      value: { ...profile(), samples: "PRIVATE_SAMPLES" },
      reason: "samples-not-array",
    },
    {
      value: { ...profile(), timeDeltas: "PRIVATE_DELTAS" },
      reason: "deltas-not-array",
    },
    {
      value: { ...profile(), samples: [1] },
      reason: "sample-delta-count-mismatch",
    },
    {
      value: { ...profile(), nodes: [null] },
      reason: "node-not-object",
      nodeIndex: 0,
    },
    {
      value: { ...profile(), nodes: [{ id: "PRIVATE_ID" }] },
      reason: "node-id-invalid",
      nodeIndex: 0,
    },
    {
      value: { ...profile(), nodes: [{ id: 1 }, { id: 1 }] },
      reason: "node-id-duplicate",
      nodeIndex: 1,
    },
    {
      value: { ...profile(), samples: ["PRIVATE_ID", 2] },
      reason: "sample-id-invalid",
      sampleIndex: 0,
    },
    {
      value: { ...profile(), samples: [1, 3] },
      reason: "sample-id-unknown",
      sampleIndex: 1,
    },
    {
      value: { ...profile(), timeDeltas: ["PRIVATE_TIME", 20] },
      reason: "delta-not-number",
      sampleIndex: 0,
    },
    {
      value: { ...profile(), timeDeltas: [NaN, 20] },
      reason: "delta-not-finite",
      sampleIndex: 0,
    },
    {
      value: { ...profile(), timeDeltas: [Infinity, 20] },
      reason: "delta-not-finite",
      sampleIndex: 0,
    },
    {
      value: { ...profile(), timeDeltas: [10, -1] },
      reason: "delta-negative",
      sampleIndex: 1,
    },
    {
      value: { ...profile(), timeDeltas: [0.5, 20] },
      reason: "delta-not-safe-integer",
      sampleIndex: 0,
    },
    {
      value: { ...profile(), timeDeltas: [Number.MAX_SAFE_INTEGER + 1, 20] },
      reason: "delta-not-safe-integer",
      sampleIndex: 0,
    },
    {
      value: { ...profile(), timeDeltas: [Number.MAX_SAFE_INTEGER, 1] },
      reason: "sampled-time-overflow",
      sampleIndex: 1,
    },
    {
      value: {
        ...profile(),
        nodes: [profile().nodes[0], { id: 2, callFrame: null }],
      },
      reason: "call-frame-invalid",
      nodeIndex: 1,
    },
  ];
  for (const row of rows) {
    let rejected = false;
    try {
      summarizeCPUProfile(row.value, []);
    } catch (error) {
      rejected = true;
      expect(diagnosticFailure(error)).toBe("cpu-invalid");
      const failure = diagnosticCPUFailure(error);
      expect(failure).toMatchObject({
        reason: row.reason,
        nodeIndex: row.nodeIndex ?? null,
        sampleIndex: row.sampleIndex ?? null,
      });
      expect(Object.keys(failure ?? {}).sort()).toEqual([
        "deltaCount",
        "nodeCount",
        "nodeIndex",
        "reason",
        "sampleCount",
        "sampleIndex",
      ]);
      expect(JSON.stringify(failure)).not.toContain("PRIVATE");
      for (const key of ["nodeCount", "sampleCount", "deltaCount"] as const) {
        const value = failure?.[key];
        expect(
          value === null ||
            (typeof value === "number" &&
              Number.isSafeInteger(value) &&
              value >= 0),
        ).toBe(true);
      }
    }
    expect(rejected).toBe(true);
  }
  try {
    summarizeCPUProfile({ ...profile(), samples: [1] }, []);
  } catch (error) {
    expect(diagnosticCPUFailure(error)).toEqual({
      reason: "sample-delta-count-mismatch",
      nodeIndex: null,
      sampleIndex: null,
      nodeCount: 2,
      sampleCount: 1,
      deltaCount: 2,
    });
  }
  expect(
    diagnosticCPUFailure(new Error("PRIVATE_REMOTE_EXCEPTION")),
  ).toBeNull();
  expect(
    diagnosticCPUFailure(new MetricsDiagnosticFailure("cpu-invalid")),
  ).toBeNull();
});

test("CPU failure detail instrumentation preserves zero/empty valid profiles and summary schema", () => {
  const empty = summarizeCPUProfile(
    { nodes: [], samples: [], timeDeltas: [] },
    [],
  );
  expect(empty.sampleCount).toBe(0);
  expect(empty.sampledMicroseconds).toBe(0);
  expect(empty.frames).toEqual([]);
  const result = summarizeCPUProfile(
    {
      nodes: [{ id: 1, callFrame: { functionName: "(root)" } }],
      samples: [1],
      timeDeltas: [-0],
      startTime: "PRIVATE_IGNORED",
    },
    [],
  );
  expect(result.sampleCount).toBe(1);
  expect(result.sampledMicroseconds).toBe(0);
  expect(Object.keys(result).sort()).toEqual([
    "assetMatchedSamples",
    "frames",
    "sampleCount",
    "sampledMicroseconds",
    "scope",
    "unattributedSamples",
  ]);
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  expect(JSON.stringify(result)).not.toContain("reason");
});

function rejectedCPU() {
  try { summarizeCPUProfile({ nodes: [], samples: [1], timeDeltas: [1] }, []); }
  catch (error) { return error; }
  throw Error("Expected actual CPU validator rejection");
}
test("failed entry CPU still collects sanitized private heap but rethrows the exact CPU rejection", async () => {
  const root = await mkdtemp(join(tmpdir(), "metrics-cpu-failure-heap-")),
    artifacts = join(root, "artifacts"), temporary = join(root, "private");
  await mkdir(artifacts); await mkdir(temporary);
  const cpuError = rejectedCPU(), stream = port([JSON.stringify(heap())]);
  const sample: EntryHeapEvidence & { status: string; acceptance: string; measuredSamples: number } = { status: "running", acceptance: "unverified", measuredSamples: 0 };
  const events: string[] = []; let rejected: unknown;
  try {
    try {
      await collectEntryDiagnostics(sample, {
        stopCPU: async () => { events.push("cpu"); throw cpuError; },
        captureHeap: async () => { events.push("heap"); return capturePrivateHeap(stream, artifacts, 100000, temporary); },
      });
    } catch (error) { rejected = error; }
    expect(rejected).toBe(cpuError);
    expect(diagnosticFailure(rejected)).toBe("cpu-invalid");
    expect(diagnosticCPUFailure(rejected)).not.toBeNull();
    expect(events).toEqual(["cpu", "heap"]);
    expect(sample.initialHeap?.rawRetained).toBe(false);
    expect(sample.initialHeap?.nodeCount).toBe(3);
    expect(sample.heapFailure).toBeUndefined();
    expect([sample.status, sample.acceptance, sample.measuredSamples]).toEqual(["running", "unverified", 0]);
    expect(JSON.stringify(sample)).not.toContain("PRIVATE");
    expect(stream.listeners.size).toBe(0);
    expect(await readdir(temporary)).toEqual([]); expect(await readdir(artifacts)).toEqual([]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("secondary heap failure stays explicit and cannot replace the original invalid CPU error", async () => {
  for (const heapError of [new MetricsDiagnosticFailure("heap-invalid"), Error("PRIVATE_HEAP_FAILURE")]) {
    const cpuError = rejectedCPU(), sample: EntryHeapEvidence = {}; let rejected: unknown;
    try { await collectEntryDiagnostics(sample, { stopCPU: async () => { throw cpuError; }, captureHeap: async () => { throw heapError; } }); }
    catch (error) { rejected = error; }
    expect(rejected).toBe(cpuError);
    expect(diagnosticFailure(rejected)).toBe("cpu-invalid");
    expect(sample.initialHeap).toBeUndefined();
    expect(sample.heapFailure).toBe(heapError instanceof MetricsDiagnosticFailure ? "heap-invalid" : "diagnostic-failed");
    expect(JSON.stringify(sample)).not.toContain("PRIVATE");
  }
});
test("valid CPU preserves the original heap success and failure behavior", async () => {
  const summary: Awaited<ReturnType<typeof capturePrivateHeap>> = { status: "summarized", rawUTF16LEBytes: 100, rawBytesCap: 1000, rawRetained: false, ...summarizeHeapSnapshot(heap()) };
  const sample: EntryHeapEvidence = {}, events: string[] = [];
  expect(await collectEntryDiagnostics(sample, { stopCPU: async () => { events.push("cpu"); }, captureHeap: async () => { events.push("heap"); return summary; } })).toBeUndefined();
  expect(events).toEqual(["cpu", "heap"]); expect(sample.initialHeap).toBe(summary); expect(sample.heapFailure).toBeUndefined();
  const failure = new MetricsDiagnosticFailure("heap-write"), failed: EntryHeapEvidence = {}; let rejected: unknown;
  try { await collectEntryDiagnostics(failed, { stopCPU: async () => {}, captureHeap: async () => { throw failure; } }); }
  catch (error) { rejected = error; }
  expect(rejected).toBe(failure); expect(failed).toEqual({});
});
