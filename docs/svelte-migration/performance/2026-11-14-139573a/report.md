# Fully native versus vanilla controlled long-room benchmark
Status: passed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 961.9 / 998.7 | 70.2 / 75.0 | 220.4 / 235.7 | 353.7 / 374.8 |
| long / mobile | svelte | 7/7 | 1773.0 / 1822.2 | 203.3 / 215.6 | 450.5 / 479.7 | 672.6 / 713.5 |
| long / desktop | vanilla | 7/7 | 1022.1 / 1045.4 | 89.8 / 103.6 | 258.7 / 330.2 | 335.7 / 413.1 |
| long / desktop | svelte | 7/7 | 1706.2 / 1794.7 | 199.4 / 207.4 | 415.0 / 476.0 | 630.0 / 695.6 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 643917 / 190227 | 383729 | 59409 / 18527 | 0 |
| long / mobile | svelte | 1/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / mobile | svelte | 2/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / mobile | vanilla | 2/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 3/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / mobile | svelte | 3/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / mobile | svelte | 4/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / mobile | vanilla | 4/passed | 643917 / 190227 | 392061 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 5/passed | 643917 / 190227 | 383729 | 59409 / 18527 | 0 |
| long / mobile | svelte | 5/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / mobile | svelte | 6/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / mobile | vanilla | 6/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 7/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / mobile | svelte | 7/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / desktop | vanilla | 1/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / desktop | svelte | 1/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / desktop | svelte | 2/passed | 1944059 / 1184812 | 1203145 | 45464 / 15446 | 2 |
| long / desktop | vanilla | 2/passed | 643917 / 190227 | 383739 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 3/passed | 643917 / 190227 | 383725 | 59409 / 18527 | 0 |
| long / desktop | svelte | 3/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / desktop | svelte | 4/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / desktop | vanilla | 4/passed | 643917 / 190227 | 383729 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 5/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / desktop | svelte | 5/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / desktop | svelte | 6/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |
| long / desktop | vanilla | 6/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 7/passed | 643917 / 190227 | 383727 | 59409 / 18527 | 0 |
| long / desktop | svelte | 7/passed | 1944059 / 1184812 | 1205208 | 45464 / 15446 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 961.9000000000233 | 1773 | 1154.280000000028 | failed |
| long / mobile | threadSwitch.ms | 325.5999999999767 | 587.7000000000116 | 390.71999999997206 | failed |
| long / mobile | history1.ms | 331.5999999999767 | 398.69999999995343 | 397.91999999997205 | failed |
| long / mobile | history2.ms | 481.70000000001164 | 419.79999999998836 | 578.040000000014 | passed |
| long / mobile | history3.ms | 715.3999999999651 | 493.5 | 858.4799999999581 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 190227 | 358662 | 220947 | failed |
| long / mobile | entry.fontTransferBytes | 190631 | 826876 | 293031 | failed |
| long / mobile | settled.JSHeapUsedSize | 7037296 | 20978680 | 15425904 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 1022.0999999998603 | 1706.2000000001863 | 1226.5199999998324 | failed |
| long / desktop | threadSwitch.ms | 345.39999999990687 | 526.1999999999534 | 414.4799999998882 | failed |
| long / desktop | history1.ms | 347.5999999998603 | 399 | 417.1199999998324 | passed |
| long / desktop | history2.ms | 481.39999999990687 | 424.69999999995343 | 577.6799999998882 | passed |
| long / desktop | history3.ms | 680.5 | 515.8000000000466 | 816.6 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 190227 | 358662 | 220947 | failed |
| long / desktop | entry.fontTransferBytes | 190631 | 826876 | 293031 | failed |
| long / desktop | settled.JSHeapUsedSize | 7078528 | 20843896 | 15467136 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
