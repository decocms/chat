# Fully native versus vanilla controlled long-room benchmark
Workload execution: passed
Performance acceptance: failed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 984.4 / 1048.4 | 69.1 / 73.1 | 233.6 / 236.7 | 370.0 / 387.1 |
| long / mobile | svelte | 7/7 | 1811.6 / 1886.2 | 215.2 / 233.0 | 498.3 / 515.5 | 689.7 / 736.2 |
| long / desktop | vanilla | 7/7 | 1061.8 / 1104.2 | 103.7 / 116.8 | 302.3 / 318.1 | 377.4 / 397.4 |
| long / desktop | svelte | 7/7 | 1800.6 / 1816.5 | 209.0 / 217.5 | 461.1 / 508.9 | 672.2 / 712.4 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 647168 / 191397 | 384899 | 59409 / 18527 | 0 |
| long / mobile | svelte | 1/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / mobile | svelte | 2/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 2/passed | 647168 / 191397 | 384897 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 3/passed | 647168 / 191397 | 384897 | 59409 / 18527 | 0 |
| long / mobile | svelte | 3/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / mobile | svelte | 4/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 4/passed | 647168 / 191397 | 384899 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 5/passed | 647168 / 191397 | 384899 | 59409 / 18527 | 0 |
| long / mobile | svelte | 5/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / mobile | svelte | 6/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 6/passed | 647168 / 191397 | 384899 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 7/passed | 647168 / 191397 | 384898 | 59409 / 18527 | 0 |
| long / mobile | svelte | 7/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 1/passed | 647168 / 191397 | 384898 | 59409 / 18527 | 0 |
| long / desktop | svelte | 1/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / desktop | svelte | 2/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 2/passed | 647168 / 191397 | 384891 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 3/passed | 647168 / 191397 | 384894 | 59409 / 18527 | 0 |
| long / desktop | svelte | 3/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / desktop | svelte | 4/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 4/passed | 647168 / 191397 | 384759 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 5/passed | 647168 / 191397 | 384895 | 59409 / 18527 | 0 |
| long / desktop | svelte | 5/passed | 1949529 / 1186713 | 1205046 | 47598 / 16466 | 2 |
| long / desktop | svelte | 6/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 6/passed | 647168 / 191397 | 384899 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 7/passed | 647168 / 191397 | 384762 | 59409 / 18527 | 0 |
| long / desktop | svelte | 7/passed | 1949529 / 1186713 | 1207109 | 47598 / 16466 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 984.3999999999069 | 1811.600000000035 | 1181.279999999888 | failed |
| long / mobile | threadSwitch.ms | 340.70000000006985 | 634.9000000000233 | 408.8400000000838 | failed |
| long / mobile | history1.ms | 348.10000000009313 | 448.70000000001164 | 417.7200000001117 | failed |
| long / mobile | history2.ms | 482.69999999998254 | 446.79999999998836 | 579.239999999979 | passed |
| long / mobile | history3.ms | 731.9000000000233 | 524.0999999999767 | 878.2800000000279 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 191397 | 360563 | 222117 | failed |
| long / mobile | entry.fontTransferBytes | 190633 | 826876 | 293033 | failed |
| long / mobile | settled.JSHeapUsedSize | 7047152 | 20999332 | 15435760 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 1061.8000000000466 | 1800.5999999998603 | 1274.1600000000558 | failed |
| long / desktop | threadSwitch.ms | 394.9000000001397 | 556.1999999999534 | 473.8800000001676 | failed |
| long / desktop | history1.ms | 364.39999999990687 | 448.30000000004657 | 437.2799999998882 | failed |
| long / desktop | history2.ms | 513.8999999999069 | 459.60000000009313 | 616.6799999998882 | passed |
| long / desktop | history3.ms | 779.8000000000466 | 531.6999999999534 | 935.7600000000558 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 191397 | 360563 | 222117 | failed |
| long / desktop | entry.fontTransferBytes | 190628 | 826876 | 293028 | failed |
| long / desktop | settled.JSHeapUsedSize | 7064384 | 20865900 | 15452992 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
