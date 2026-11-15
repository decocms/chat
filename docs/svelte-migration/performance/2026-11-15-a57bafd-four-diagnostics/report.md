# NOT_ACCEPTANCE: four extra excluded CPU diagnostics
OriginalTrialsExecuted: 0. The measured cohort is intentionally empty and cannot establish performance acceptance.
Workload execution: incomplete-or-failed
Performance acceptance: unverified-pending-real-editor-lifecycle-and-full-scope-review

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 0/0 | unmeasured | unmeasured | unmeasured | unmeasured |
| long / mobile | svelte | 0/0 | unmeasured | unmeasured | unmeasured | unmeasured |
| long / desktop | vanilla | 0/0 | unmeasured | unmeasured | unmeasured | unmeasured |
| long / desktop | svelte | 0/0 | unmeasured | unmeasured | unmeasured | unmeasured |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | unverified | unverified | unverified | unverified |
| long / mobile | threadSwitch.ms | unverified | unverified | unverified | unverified |
| long / mobile | history1.ms | unverified | unverified | unverified | unverified |
| long / mobile | history2.ms | unverified | unverified | unverified | unverified |
| long / mobile | history3.ms | unverified | unverified | unverified | unverified |
| long / mobile | entry.applicationGzipReferenceBytes | unverified | unverified | unverified | unverified |
| long / mobile | entry.fontTransferBytes | unverified | unverified | unverified | unverified |
| long / mobile | settled.JSHeapUsedSize | unverified | unverified | unverified | unverified |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | unverified | unverified | unverified | unverified |
| long / desktop | threadSwitch.ms | unverified | unverified | unverified | unverified |
| long / desktop | history1.ms | unverified | unverified | unverified | unverified |
| long / desktop | history2.ms | unverified | unverified | unverified | unverified |
| long / desktop | history3.ms | unverified | unverified | unverified | unverified |
| long / desktop | entry.applicationGzipReferenceBytes | unverified | unverified | unverified | unverified |
| long / desktop | entry.fontTransferBytes | unverified | unverified | unverified | unverified |
| long / desktop | settled.JSHeapUsedSize | unverified | unverified | unverified | unverified |

Performance acceptance: unverified-pending-real-editor-lifecycle-and-full-scope-review. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
