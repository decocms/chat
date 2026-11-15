import { expect, test } from "bun:test";
import {
  interpretCPUTimeOrder,
  recordCPUTimeOrder,
} from "./ui-metrics-cpu-timestamp-order";
import {
  summarizeCPUProfile,
  diagnosticCPUFailure,
  diagnosticScript,
} from "./ui-metrics-diagnostics";
const frame = (
  name: string,
  scriptId = "trusted",
  url = "http://fixture/app.js",
) => ({ functionName: name, scriptId, url, lineNumber: 1, columnNumber: 2 });
const profile = () => ({
  startTime: 100,
  endTime: 160,
  nodes: [
    { id: 0, callFrame: frame("(root)", "0", ""), children: [1, 2, 3] },
    { id: 1, callFrame: frame("one") },
    { id: 2, callFrame: frame("two") },
    { id: 3, callFrame: frame("three") },
  ],
  samples: [1, 2, 3],
  timeDeltas: [30, -10, 20],
});
const assets = [
  {
    url: "http://fixture/app.js",
    assetKey: "fixture/app.js",
    sourceSHA256: "a".repeat(64),
    servedSHA256: "b".repeat(64),
  },
];
const trusted = {
  scriptId: "trusted",
  url: assets[0]!.url,
  hash: assets[0]!.servedSHA256,
};
const scripts = () => new Map([["trusted", diagnosticScript(trusted)]]);
function interpreted(value: unknown) {
  const result = interpretCPUTimeOrder(value, assets, scripts());
  if (result.status !== "interpreted")
    throw Error("Expected interpreted fixture");
  return result;
}
type InterpretationReason = Extract<
  ReturnType<typeof interpretCPUTimeOrder>,
  { status: "unverified" }
>["reason"];
function reason(value: unknown, expected: InterpretationReason) {
  const result = interpretCPUTimeOrder(value, assets, scripts());
  expect(result.status).toBe("unverified");
  if (result.status !== "unverified") throw Error("Expected rejected fixture");
  expect(result.reason).toBe(expected);
}
test("signed reconstruction preserves strict rejection, exact sample counts, immutable input and edge gaps", () => {
  const raw = profile(),
    before = JSON.stringify(raw);
  for (const node of raw.nodes) {
    Object.freeze(node.callFrame);
    if ("children" in node) Object.freeze(node.children);
    Object.freeze(node);
  }
  Object.freeze(raw.nodes);
  Object.freeze(raw.samples);
  Object.freeze(raw.timeDeltas);
  Object.freeze(raw);
  const result = interpreted(raw);
  expect(result).toMatchObject({
    status: "interpreted",
    sampleCount: 3,
    originalSampleMultisetPreserved: true,
    negativeDeltaCount: 1,
    reorderedSampleCount: 2,
    intervalMicroseconds: 20,
    unattributedEdges: {
      beforeFirstMicroseconds: 20,
      afterLastMicroseconds: 20,
    },
  });
  expect(
    result.frames
      .map((x) => [x.id, x.samples, x.interSampleMicroseconds])
      .sort((a, b) => a[0]! - b[0]!),
  ).toEqual([
    [0, 0, 0],
    [1, 1, 10],
    [2, 1, 10],
    [3, 1, 0],
  ]);
  expect(
    result.intervalMicroseconds +
      result.unattributedEdges.beforeFirstMicroseconds +
      result.unattributedEdges.afterLastMicroseconds,
  ).toBe(raw.endTime - raw.startTime);
  expect(JSON.stringify(raw)).toBe(before);
  try {
    summarizeCPUProfile(raw, assets, scripts());
    throw Error("Expected strict rejection");
  } catch (error) {
    expect(diagnosticCPUFailure(error)?.reason).toBe("delta-negative");
  }
});
test("monotonic timestamps use explicitly forward inter-sample weights; old strict weights remain unchanged", () => {
  const raw = { ...profile(), samples: [1, 2, 1], timeDeltas: [10, 10, 20] };
  const strict = summarizeCPUProfile(raw, assets, scripts());
  expect(strict.frames.find((x) => x.id === 1)?.selfTimeMicroseconds).toBe(30);
  const result = interpreted(raw);
  expect(result.frames.find((x) => x.id === 1)?.interSampleMicroseconds).toBe(
    10,
  );
  expect(result.frames.find((x) => x.id === 2)?.interSampleMicroseconds).toBe(
    20,
  );
  expect(result.reorderedSampleCount).toBe(0);
  expect(summarizeCPUProfile(raw, assets, scripts())).toEqual(strict);
});
test("equal timestamps keep original pair order, duplicate sample counts and zero-width observations", () => {
  const result = interpreted({
    ...profile(),
    samples: [1, 2, 3, 1],
    timeDeltas: [20, -10, 10, 10],
  });
  expect(result.equalTimestampPairs).toBe(1);
  expect(result.sampleCount).toBe(4);
  expect(result.frames.find((x) => x.id === 1)).toMatchObject({
    samples: 2,
    interSampleMicroseconds: 0,
  });
  expect(result.frames.find((x) => x.id === 3)?.interSampleMicroseconds).toBe(
    10,
  );
});
test("single samples stay counts-only and empty profiles are unverified, never interpolated", () => {
  const result = interpreted({ ...profile(), samples: [1], timeDeltas: [20] });
  expect(result.durationStatus).toBe("unverified");
  expect(result.durationEvidence).toBe("counts-only-no-positive-intervals");
  expect(result.intervalMicroseconds).toBe(0);
  expect(result.unattributedEdges).toEqual({
    beforeFirstMicroseconds: 20,
    afterLastMicroseconds: 40,
  });
  reason({ ...profile(), samples: [], timeDeltas: [] }, "no-samples");
  const ties = interpreted({
    ...profile(),
    samples: [1, 2, 1],
    timeDeltas: [20, 0, 0],
  });
  expect(ties.sampleCount).toBe(3);
  expect(ties.equalTimestampPairs).toBe(2);
  expect(ties.durationStatus).toBe("unverified");
  expect(ties.durationEvidence).toBe("counts-only-no-positive-intervals");
});
test("every original cumulative timestamp must be bounded; no sorting/clamping can rescue an excursion", () => {
  reason({ ...profile(), timeDeltas: [-1, 20, 20] }, "timestamp-bounds");
  reason(
    { ...profile(), endTime: 140, timeDeltas: [50, -20, 0] },
    "timestamp-bounds",
  );
  for (const startTime of [NaN, Infinity, -1, "PRIVATE_START"])
    reason({ ...profile(), startTime }, "bounds");
  reason({ ...profile(), endTime: 99 }, "bounds");
  for (const bad of [
    Infinity,
    NaN,
    0.5,
    Number.MAX_SAFE_INTEGER + 1,
    "PRIVATE_DELTA",
  ])
    reason({ ...profile(), timeDeltas: [30, bad, 20] }, "signed-delta");
  reason(
    {
      ...profile(),
      startTime: Number.MAX_SAFE_INTEGER - 2,
      endTime: Number.MAX_SAFE_INTEGER,
      timeDeltas: [3, 0, 0],
    },
    "arithmetic",
  );
  expect(
    interpreted({ ...profile(), startTime: 100.5, endTime: 160.5 })
      .intervalMicroseconds,
  ).toBe(20);
});
test("node graph rejects unknown children, duplicate edges/parents, cycles, disconnected nodes and malformed frames", () => {
  const raw = profile();
  reason(
    {
      ...raw,
      nodes: [{ ...raw.nodes[0], children: [1, 2, 99] }, ...raw.nodes.slice(1)],
    },
    "graph",
  );
  reason(
    {
      ...raw,
      nodes: [
        { ...raw.nodes[0], children: [1, 1, 2, 3] },
        ...raw.nodes.slice(1),
      ],
    },
    "graph",
  );
  reason(
    {
      ...raw,
      nodes: [
        raw.nodes[0],
        { ...raw.nodes[1], children: [2] },
        ...raw.nodes.slice(2),
      ],
    },
    "graph",
  );
  reason(
    {
      ...raw,
      nodes: [
        { ...raw.nodes[0], children: [1] },
        { ...raw.nodes[1], children: [0] },
        ...raw.nodes.slice(2),
      ],
    },
    "graph",
  );
  reason(
    {
      ...raw,
      nodes: [{ ...raw.nodes[0], children: [] }, ...raw.nodes.slice(1)],
    },
    "graph",
  );
  reason(
    {
      ...raw,
      nodes: [
        raw.nodes[0],
        { ...raw.nodes[1], callFrame: { functionName: "PRIVATE" } },
        ...raw.nodes.slice(2),
      ],
    },
    "strict-shape",
  );
  reason({ ...raw, samples: [1, 2, 99] }, "strict-shape");
  reason({ ...raw, samples: [1] }, "profile-shape");
});
test("attribution reuses secure script provenance and never exports spoofed eval names, URLs or raw timelines", () => {
  for (const parsed of [
    { ...trusted, hasSourceURL: true },
    { ...trusted, isLiveEdit: true },
    { ...trusted, stackTrace: {} },
    { ...trusted, hash: "c".repeat(64) },
  ]) {
    const raw = profile();
    raw.nodes[1]!.callFrame = {
      ...frame("PRIVATE_DYNAMIC_NAME"),
      url: assets[0]!.url,
    };
    const result = interpretCPUTimeOrder(
      raw,
      assets,
      new Map([["trusted", diagnosticScript(parsed)]]),
    );
    expect(result.status).toBe("interpreted");
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(JSON.stringify(result)).not.toContain("http:");
    expect(JSON.stringify(result)).not.toContain("timeDeltas");
  }
  const foreign = profile();
  foreign.nodes[1]!.callFrame = frame(
    "PRIVATE_FUNCTION",
    "foreign",
    "https://secret.invalid/?token=PRIVATE_TOKEN",
  );
  expect(
    JSON.stringify(interpretCPUTimeOrder(foreign, assets, scripts())),
  ).not.toContain("PRIVATE");
});
test("default off and measured contexts inspect no profile and leave original cohort bytes unchanged", () => {
  const exploding = new Proxy(
    {},
    {
      get() {
        throw Error("Must not inspect");
      },
    },
  );
  for (const options of [
    { diagnosticContext: false, flag: "1", phase: "entry" },
    { diagnosticContext: true, flag: undefined, phase: "entry" },
    { diagnosticContext: true, flag: "true", phase: "entry" },
  ]) {
    const sample = { status: "passed", metrics: { ready: 123 } },
      before = JSON.stringify(sample);
    recordCPUTimeOrder(sample, options, exploding, assets, scripts());
    expect(JSON.stringify(sample)).toBe(before);
  }
  const measured = [{ status: "passed", metrics: { ready: 123 } }],
    budgets = [{ status: "failed" }],
    before = JSON.stringify({ measured, budgets });
  const diagnostic: Record<string, unknown> = { status: "running" };
  recordCPUTimeOrder(
    diagnostic,
    { diagnosticContext: true, flag: "1", phase: "entry" },
    profile(),
    assets,
    scripts(),
  );
  expect(diagnostic.cpuTimestampOrder).toMatchObject({
    entry: { status: "interpreted" },
  });
  try {
    summarizeCPUProfile(profile(), assets, scripts());
  } catch (error) {
    expect(diagnosticCPUFailure(error)?.reason).toBe("delta-negative");
  }
  expect(diagnostic.cpuTimestampOrder).toMatchObject({
    entry: { status: "interpreted" },
  });
  expect(JSON.stringify({ measured, budgets })).toBe(before);
  expect(diagnostic.status).toBe("running");
});
