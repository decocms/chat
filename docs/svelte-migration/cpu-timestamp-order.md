# Separate opt-in CPU timestamp-order interpretation

This diagnostic is not strict CPU acceptance, performance acceptance, hardware evidence, or retrospective repair. It is disabled by default. `METRICS_CPU_TIMESTAMP_ORDER=1` is evaluated only for an existing separately excluded diagnostic context; it creates no measured-phase profiling. The original strict validator, its summary schema, rejected historical artifacts, original 32 trials, readiness, minimum seven measurements and every budget remain unchanged.

The [official CDP Profile definition](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/pdl/js_protocol.pdl) specifies integer deltas, the first relative to the profile start, without a nonnegative constraint. The [current official DevTools implementation](https://raw.githubusercontent.com/ChromeDevTools/devtools-frontend/main/front_end/models/cpu_profile/CPUProfileDataModel.ts) accumulates deltas into timestamps (lines 131–141) and sorts timestamp/sample pairs (240–260). These sources were read on 2026-11-15. This supports a separate interpretation of bounded out-of-order observations; it does not prove that every negative delta or our discarded historical profiles was valid. Upstream main URLs can change; retain the exact diagnostic source revision with any run.

We deliberately exclude DevTools' additional normalization and missing-sample transformations. We neither infer a final timestamp, interpolate missing values, replace program/native samples, remap IDs, clamp durations, drop observations nor change sampling frequency. The new implementation is a bounded diagnostic interpretation, not a copy of the entire DevTools model.

## Algorithm and attribution

`scripts/ui-metrics-cpu-timestamp-order.ts` first checks profile arrays and sample/delta lengths. It reuses the existing strict validator with zero validation weights for unchanged node/sample identity and secure frame attribution, then validates complete call-frame fields and a rooted, reachable, acyclic single-parent graph. These zero weights are internal validation inputs; no replacement raw profile or new observations are exported. Optional absent child lists mean leaves; duplicate IDs, edges, parents and unknown/disconnected children fail closed.

Start/end must be finite, nonnegative, ordered and within safe numeric magnitude. Deltas must be signed safe integers. Each original sequential cumulative addition must remain finite and exactly represent its delta, and every reconstructed timestamp must lie within the original start/end bounds. Sorting cannot rescue an out-of-bounds excursion. Stable ordering uses timestamp and original index; an independent per-node count comparison checks sample-multiset preservation. The input is never mutated.

For each sorted observation except the last, its following observed timestamp defines a forward inter-sample interval. Equal timestamps remain separate observations with zero-width intervals. The initial start-to-first and final last-to-end gaps stay explicitly unattributed. There is no invented terminal sample or extrapolated duration. Singleton profiles report counts-only evidence; empty profiles remain unverified. This estimator differs from the old strict summary's backward delta weighting and is not exact CPU scheduling or whole-phase wall time.

The sidecar uses `cpuTimestampOrder[phase]`, with status `interpreted` or `unverified`, never a generic acceptance pass. Its available intervals are named `interSampleMicroseconds`, not the old `selfTimeMicroseconds`. Frames reuse the exact existing conjunction of trusted script ID/provenance, observed URL and actual served SHA; eval/sourceURL/live-edit/unrecognized scripts remain unattributed. Only sanitized frames and numeric counts/interval summaries leave memory, never raw timestamps, signed deltas, profile/source text, private URLs or heap strings. Closed failure reasons/counts contain no rejected payloads.

The caller records this namespace before invoking the original strict summary. A strict `delta-negative` rejection still propagates unchanged and the original diagnostic remains rejected/unverified; the supplementary interpretation cannot erase it. Existing post-failure private-heap collection behavior is preserved. No historical artifact can be reinterpreted: the raw old profiles were intentionally discarded, and retained failure counts cannot establish valid bounds or ordering.

## Verification boundary

Focused fixtures cover frozen input/multiset preservation, bounded signed reorder, monotonic-versus-old weighting, ties/duplicate samples, singleton/empty cases, excursions, invalid arithmetic, malformed graphs/frames, existing provenance privacy negatives, and default-off/measured-context zero inspection or mutation. They are pure tests, not actual Chrome acceptance. Source/type review and an explicitly separate fresh diagnostic run must follow before interpreting real results. The application under measurement remains the frozen revision; no complete benchmark is replayed or shortened by this source.

Author checks: six owned paths passed Node Prettier. The existing strict/private-heap suite and the new interpretation suite together passed 18 tests / 327 assertions in 2.60 seconds with Bun 1.4.4. Zero positive inter-sample intervals—including a singleton or multiple tied timestamps—are explicitly duration-unverified/counts-only; numeric interval totals do not claim zero CPU cost. The original strict source file and all historical artifacts have no diff. No local compiler, browser, profiler, heap snapshot or benchmark ran. Actual source/type review and fresh separately excluded diagnostics remain pending.

## External-script hash calibration

A separate [public fixed-source calibration](cpu-script-hash-calibration.json)
ran on pinned Chromium `158.0.8127.18`. Both external classic and module scripts
containing accented, CJK and astral characters reported the SHA-256 of served
UTF-8 bytes, matching the existing attribution policy. Neither reported
sourceURL, live-edit or stack-trace provenance. No application, profile or
private data was used. The fixed source was:

```js
globalThis.__hashProbe = (globalThis.__hashProbe || 0) + 1;
console.info("café 日本語 🧪");
```

The [V8 implementation](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/src/inspector/v8-debugger-script.cc)
has both a precomputed `GetSha256Hash()` path and a UTF-16 code-unit fallback.
The fallback alone does not define external-network script hashes. The actual
calibration supports keeping the existing served-byte comparison unchanged;
no alternate hash acceptance or field swapping is introduced. This limited
probe does not authenticate HTML inline, eval, live-edit or arbitrary-encoding
scripts, which remain conservatively unattributed. It does not validate an
actual CPU profile or change a historical rejection.

## Source-check correction

[Repository run 43687687418](https://github.com/vibegui/vibebook.dev/actions/runs/43687687418)
at `f2a043ce35ada2d96db946bc8931bd3517c9d59b` passed the build, preview freshness
and 23 of 24 repository gates on both operating systems, plus the Ubuntu
layout-browser job. Tooling
typing alone failed: the test helper accepted a broad string where the model
and Bun's equality matcher require its closed failure-reason union. The helper
now derives that parameter from the actual unverified result type. The equality
assertion, every fixture and all production/diagnostic semantics are unchanged;
no cast, suppression or validator relaxation is used. A fresh exact-head CI
run is required; the original failure remains retained as a failure.

## Verified source and four supplementary diagnostics

The subsequent exact source `485ca0cbb20913da31c82a5ab096d1e2b69254e5`
passed [all 24 repository gates and preview freshness on both operating
systems, plus the Ubuntu layout-browser job](https://github.com/vibegui/vibebook.dev/actions/runs/43688582518).
This resolves the tooling-only failure above without changing diagnostic or
strict-validator semantics.

Root then executed the separately reviewed four-extra-only driver. The
[losslessly retained results and provenance](performance/2026-11-15-485ca0c-four-diagnostics/README.md)
contain four excluded trials and zero original samples. Exit 1, the failed empty
cohort and all 16 unverified budgets are preserved. Strict CPU validation passed
one trial and rejected three for `delta-negative`; the independent timestamp
sidecar interpreted six available phases without overriding those rejections.

Native entry's verified Field frame `K` at zero-based `0:7227` accounts for
386,358 / 282,823 µs of diagnostic inter-sample intervals on mobile / desktop;
all verified Field frames aggregate to 456,248 / 301,703 µs. Source inspection
identifies the frame as layout measurement. This is an investigation target,
not validated CPU self time, latency causality or performance acceptance.
Application/public tree IDs remain identical to `249e1e9`; no original cohort
was replayed, changed or replaced. The retained preparation protocol predates
execution; its root approval and actual failure-preserving result are included.
