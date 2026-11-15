// Separate opt-in interpretation; the original strict CPU validator is untouched.
import { record } from "../shared/validation";
import {
  summarizeCPUProfile,
  diagnosticCPUFailure,
  type DiagnosticAsset,
  type DiagnosticScript,
} from "./ui-metrics-diagnostics";

type Reason = "profile-shape" | "bounds" | "graph" | "signed-delta" | "arithmetic" | "timestamp-bounds" | "no-samples" | "strict-shape";
class InterpretationFailure extends Error {
  constructor(readonly reason: Reason) { super(reason); }
}
const fail = (reason: Reason): never => { throw new InterpretationFailure(reason); };
const integer = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const bounded = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER;
const scope = "Diagnostic timestamp-order interpretation, not strict acceptance or exact CPU/wall time; only observed inter-sample intervals, no extrapolated edge intervals";

/** CDP integer deltas can encode samples out of timestamp order. Reconstruct
 * original timestamps, sort whole pairs stably, and never repair observations. */
export function interpretCPUTimeOrder(
  value: unknown,
  observed: readonly DiagnosticAsset[],
  scripts: ReadonlyMap<string, DiagnosticScript | null> = new Map(),
) {
  const counts = {
    nodeCount: record(value) && Array.isArray(value.nodes) ? value.nodes.length : null,
    sampleCount: record(value) && Array.isArray(value.samples) ? value.samples.length : null,
    deltaCount: record(value) && Array.isArray(value.timeDeltas) ? value.timeDeltas.length : null,
  };
  try {
    if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.samples) || !Array.isArray(value.timeDeltas) || value.samples.length !== value.timeDeltas.length) return fail("profile-shape");
    const start = value.startTime, end = value.endTime;
    if (!bounded(start) || !bounded(end) || end < start) return fail("bounds");
    // Reuse the existing identifier/frame validation and secure script-ID +
    // observed URL/hash attribution. Zero weights are validation inputs only;
    // no synthetic samples or substitute profile is exported or accepted.
    const safe = summarizeCPUProfile({ nodes: value.nodes, samples: value.samples, timeDeltas: value.samples.map(() => 0) }, observed, scripts);
    const known = new Set(safe.frames.map((frame) => frame.id));
    const children = new Map<number, number[]>(), parents = new Map<number, number>();
    for (const node of value.nodes) {
      if (!record(node) || !integer(node.id)) return fail("graph");
      if (node.children !== undefined && !Array.isArray(node.children)) return fail("graph");
      const edges: number[] = [];
      for (const child of node.children ?? []) {
        if (!integer(child) || !known.has(child) || parents.has(child)) return fail("graph");
        parents.set(child, node.id); edges.push(child);
      }
      children.set(node.id, edges);
    }
    const root: unknown = value.nodes[0];
    if (!record(root) || !integer(root.id) || parents.has(root.id)) return fail("graph");
    const reached = new Set<number>(), pending = [root.id];
    while (pending.length) {
      const id = pending.pop();
      if (id === undefined || reached.has(id)) return fail("graph");
      reached.add(id); pending.push(...(children.get(id) ?? []));
    }
    if (reached.size !== known.size) return fail("graph");
    const pairs: { timestamp: number; id: number; index: number }[] = [];
    let timestamp = start, negativeDeltaCount = 0;
    for (let index = 0; index < value.samples.length; index++) {
      const id: unknown = value.samples[index], delta: unknown = value.timeDeltas[index];
      if (!integer(id) || !known.has(id)) return fail("strict-shape");
      if (typeof delta !== "number" || !Number.isSafeInteger(delta)) return fail("signed-delta");
      const next = timestamp + delta;
      if (!bounded(next) || next - timestamp !== delta) return fail("arithmetic");
      if (next < start || next > end) return fail("timestamp-bounds");
      if (delta < 0) negativeDeltaCount++;
      timestamp = next; pairs.push({ timestamp, id, index });
    }
    if (!pairs.length) return fail("no-samples");
    pairs.sort((a, b) => a.timestamp - b.timestamp || a.index - b.index);
    // Sorting is a bijection of complete observations. Independent counts also
    // ensure that weighted attribution cannot silently omit any node's samples.
    const observedCounts = new Map<number, number>();
    for (const pair of pairs) observedCounts.set(pair.id, (observedCounts.get(pair.id) ?? 0) + 1);
    if (safe.frames.some((frame) => frame.samples !== (observedCounts.get(frame.id) ?? 0))) return fail("strict-shape");
    const times = new Map<number, number>();
    let intervalMicroseconds = 0, equalTimestampPairs = 0;
    for (let index = 0; index + 1 < pairs.length; index++) {
      const first = pairs[index]!, second = pairs[index + 1]!, duration = second.timestamp - first.timestamp;
      if (!integer(duration) || !Number.isSafeInteger(intervalMicroseconds + duration)) return fail("arithmetic");
      if (duration === 0) equalTimestampPairs++;
      intervalMicroseconds += duration;
      times.set(first.id, (times.get(first.id) ?? 0) + duration);
    }
    const frames = safe.frames.map(({ selfTimeMicroseconds: _strictWeight, ...frame }) => ({ ...frame, interSampleMicroseconds: times.get(frame.id) ?? 0 }));
    return {
      status: "interpreted" as const,
      interpretation: "signed-delta-timestamp-order-v1" as const,
      sampleCount: pairs.length,
      originalSampleMultisetPreserved: true,
      negativeDeltaCount,
      reorderedSampleCount: pairs.filter((pair, index) => pair.index !== index).length,
      equalTimestampPairs,
      intervalMicroseconds,
      unattributedEdges: { beforeFirstMicroseconds: pairs[0]!.timestamp - start, afterLastMicroseconds: end - pairs[pairs.length - 1]!.timestamp },
      durationEvidence: pairs.length > 1 ? "observed-inter-sample-intervals" : "counts-only-single-sample",
      assetMatchedSamples: safe.assetMatchedSamples,
      unattributedSamples: safe.unattributedSamples,
      frames: frames.sort((a, b) => b.interSampleMicroseconds - a.interSampleMicroseconds),
      scope,
    };
  } catch (error) {
    return {
      status: "unverified" as const,
      interpretation: "signed-delta-timestamp-order-v1" as const,
      reason: error instanceof InterpretationFailure ? error.reason : "strict-shape",
      ...counts,
      strictShapeFailure: diagnosticCPUFailure(error),
      scope,
    };
  }
}
export type CPUTimeOrderEvidence = ReturnType<typeof interpretCPUTimeOrder>;

/** Off and measured-context paths do not even inspect the profile or mutate the
 * destination. Supplementary evidence is recorded BEFORE the caller's unchanged
 * strict summary, so its rejection cannot erase this distinct namespace. */
export function recordCPUTimeOrder(
  destination: Record<string, unknown>,
  options: { diagnosticContext: boolean; flag: string | undefined; phase: string },
  value: unknown,
  observed: readonly DiagnosticAsset[],
  scripts: ReadonlyMap<string, DiagnosticScript | null>,
) {
  if (!options.diagnosticContext || options.flag !== "1") return;
  const namespace = record(destination.cpuTimestampOrder) ? destination.cpuTimestampOrder : {};
  namespace[options.phase] = interpretCPUTimeOrder(value, observed, scripts);
  destination.cpuTimestampOrder = namespace;
}
