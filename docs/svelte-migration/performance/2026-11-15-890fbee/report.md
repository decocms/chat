# Fully native versus vanilla controlled long-room benchmark
Workload execution: passed
Performance acceptance: failed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 887.5 / 897.1 | 59.4 / 63.6 | 183.3 / 196.7 | 306.3 / 318.4 |
| long / mobile | svelte | 7/7 | 1442.2 / 1501.3 | 170.2 / 199.8 | 371.5 / 389.2 | 550.3 / 609.0 |
| long / desktop | vanilla | 7/7 | 860.1 / 932.6 | 69.3 / 88.8 | 215.6 / 245.2 | 319.0 / 333.1 |
| long / desktop | svelte | 7/7 | 1352.0 / 1554.4 | 154.7 / 179.3 | 352.2 / 401.8 | 517.4 / 552.1 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 636629 / 187716 | 381214 | 59409 / 18527 | 0 |
| long / mobile | svelte | 1/passed | 1933528 / 1182139 | 1200472 | 47598 / 16466 | 2 |
| long / mobile | svelte | 2/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 2/passed | 636629 / 187716 | 389484 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 3/passed | 636629 / 187716 | 389504 | 59409 / 18527 | 0 |
| long / mobile | svelte | 3/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / mobile | svelte | 4/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 4/passed | 636629 / 187716 | 381217 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 5/passed | 636629 / 187716 | 381217 | 59409 / 18527 | 0 |
| long / mobile | svelte | 5/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / mobile | svelte | 6/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 6/passed | 636629 / 187716 | 381217 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 7/passed | 636629 / 187716 | 381217 | 59409 / 18527 | 0 |
| long / mobile | svelte | 7/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 1/passed | 636629 / 187716 | 381218 | 59409 / 18527 | 0 |
| long / desktop | svelte | 1/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / desktop | svelte | 2/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 2/passed | 636629 / 187716 | 381215 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 3/passed | 636629 / 187716 | 381215 | 59409 / 18527 | 0 |
| long / desktop | svelte | 3/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 1 |
| long / desktop | svelte | 4/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 4/passed | 636629 / 187716 | 381215 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 5/passed | 636629 / 187716 | 381215 | 59409 / 18527 | 0 |
| long / desktop | svelte | 5/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / desktop | svelte | 6/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 6/passed | 636629 / 187716 | 381214 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 7/passed | 636629 / 187716 | 381215 | 59409 / 18527 | 0 |
| long / desktop | svelte | 7/passed | 1933528 / 1182139 | 1202535 | 47598 / 16466 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 887.5 | 1442.1999999999534 | 1065 | failed |
| long / mobile | threadSwitch.ms | 282 | 491.8999999999942 | 338.4 | failed |
| long / mobile | history1.ms | 298.69999999995343 | 349.5999999999767 | 358.4399999999441 | passed |
| long / mobile | history2.ms | 431.8999999999942 | 358.4000000000233 | 518.279999999993 | passed |
| long / mobile | history3.ms | 632.1000000000058 | 415.20000000006985 | 758.5200000000069 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 187716 | 355989 | 218436 | failed |
| long / mobile | entry.fontTransferBytes | 190632 | 826876 | 293032 | failed |
| long / mobile | settled.JSHeapUsedSize | 7047500 | 20914712 | 15436108 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 860.1000000000931 | 1352 | 1032.1200000001118 | failed |
| long / desktop | threadSwitch.ms | 279.79999999993015 | 434.5999999999767 | 335.75999999991615 | failed |
| long / desktop | history1.ms | 282.30000000004657 | 332.5 | 338.76000000005587 | passed |
| long / desktop | history2.ms | 415.70000000006985 | 348.89999999990687 | 498.8400000000838 | passed |
| long / desktop | history3.ms | 615.8000000000466 | 411.5 | 738.9600000000559 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 187716 | 355989 | 218436 | failed |
| long / desktop | entry.fontTransferBytes | 190630 | 826876 | 293030 | failed |
| long / desktop | settled.JSHeapUsedSize | 7029960 | 20819064 | 15418568 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
