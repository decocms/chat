# Fully native versus vanilla controlled long-room benchmark
Workload execution: passed
Performance acceptance: failed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 1708.8 / 1805.4 | 88.9 / 101.7 | 332.1 / 343.2 | 587.2 / 593.3 |
| long / mobile | svelte | 7/7 | 2809.5 / 2847.0 | 275.9 / 279.4 | 680.3 / 698.8 | 1168.7 / 1181.8 |
| long / desktop | vanilla | 7/7 | 1844.8 / 1904.4 | 125.4 / 134.9 | 413.2 / 441.2 | 594.6 / 598.2 |
| long / desktop | svelte | 7/7 | 2769.6 / 2819.7 | 271.4 / 285.3 | 674.3 / 708.3 | 1100.3 / 1126.5 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 643213 / 189923 | 383428 | 60277 / 18566 | 0 |
| long / mobile | svelte | 1/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / mobile | svelte | 2/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 2/passed | 643213 / 189923 | 383423 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 3/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / mobile | svelte | 3/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / mobile | svelte | 4/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 4/passed | 643213 / 189923 | 383427 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 5/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / mobile | svelte | 5/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / mobile | svelte | 6/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 6/passed | 643213 / 189923 | 383424 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 7/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / mobile | svelte | 7/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 1/passed | 643213 / 189923 | 391776 | 60277 / 18566 | 0 |
| long / desktop | svelte | 1/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / desktop | svelte | 2/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 2/passed | 643213 / 189923 | 391754 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 3/passed | 643213 / 189923 | 391754 | 60277 / 18566 | 0 |
| long / desktop | svelte | 3/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / desktop | svelte | 4/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 4/passed | 643213 / 189923 | 383427 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 5/passed | 643213 / 189923 | 383426 | 60277 / 18566 | 0 |
| long / desktop | svelte | 5/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / desktop | svelte | 6/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 6/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 7/passed | 643213 / 189923 | 383426 | 60277 / 18566 | 0 |
| long / desktop | svelte | 7/passed | 1940701 / 1184477 | 1205091 | 47598 / 16466 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 1708.7999999523163 | 2809.5 | 2050.5599999427795 | failed |
| long / mobile | threadSwitch.ms | 508.7999999523163 | 903.5999999046326 | 610.5599999427795 | failed |
| long / mobile | history1.ms | 598.2000000476837 | 764.7999999523163 | 717.8400000572204 | failed |
| long / mobile | history2.ms | 912.1000001430511 | 765.1000001430511 | 1094.5200001716614 | passed |
| long / mobile | history3.ms | 1326.9000000953674 | 898.2000000476837 | 1592.2800001144408 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 189923 | 358327 | 220643 | failed |
| long / mobile | entry.fontTransferBytes | 190633 | 826876 | 293033 | failed |
| long / mobile | settled.JSHeapUsedSize | 7049952 | 21087764 | 15438560 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 1844.7999999523163 | 2769.600000143051 | 2213.7599999427794 | failed |
| long / desktop | threadSwitch.ms | 598.2000000476837 | 800.2999999523163 | 717.8400000572204 | failed |
| long / desktop | history1.ms | 613.7999999523163 | 781.7999999523163 | 736.5599999427795 | failed |
| long / desktop | history2.ms | 908.9000000953674 | 781.2999999523163 | 1090.6800001144409 | passed |
| long / desktop | history3.ms | 1252.7999999523163 | 897.7000000476837 | 1503.3599999427795 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 189923 | 358327 | 220643 | failed |
| long / desktop | entry.fontTransferBytes | 190635 | 826876 | 293035 | failed |
| long / desktop | settled.JSHeapUsedSize | 7052972 | 20921532 | 15441580 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
