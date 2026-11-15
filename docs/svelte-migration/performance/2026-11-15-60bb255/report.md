# Fully native versus vanilla controlled long-room benchmark
Workload execution: passed
Performance acceptance: failed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 1729.6 / 1755.8 | 89.2 / 90.3 | 330.3 / 343.6 | 586.9 / 603.4 |
| long / mobile | svelte | 7/7 | 2796.2 / 2870.1 | 285.8 / 295.0 | 681.0 / 698.0 | 1146.7 / 1179.8 |
| long / desktop | vanilla | 7/7 | 1828.2 / 1899.1 | 125.7 / 128.1 | 413.1 / 431.9 | 586.9 / 636.9 |
| long / desktop | svelte | 7/7 | 2775.5 / 2806.5 | 285.3 / 300.7 | 693.9 / 710.6 | 1101.6 / 1133.5 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / mobile | svelte | 1/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / mobile | svelte | 2/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 2/passed | 643213 / 189923 | 383429 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 3/passed | 643213 / 189923 | 383426 | 60277 / 18566 | 0 |
| long / mobile | svelte | 3/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / mobile | svelte | 4/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 4/passed | 643213 / 189923 | 383424 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 5/passed | 643213 / 189923 | 383422 | 60277 / 18566 | 0 |
| long / mobile | svelte | 5/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / mobile | svelte | 6/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 6/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 7/passed | 643213 / 189923 | 383423 | 60277 / 18566 | 0 |
| long / mobile | svelte | 7/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 1/passed | 643213 / 189923 | 383427 | 60277 / 18566 | 0 |
| long / desktop | svelte | 1/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / desktop | svelte | 2/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 2/passed | 643213 / 189923 | 383424 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 3/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / desktop | svelte | 3/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / desktop | svelte | 4/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 4/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 5/passed | 643213 / 189923 | 383424 | 60277 / 18566 | 0 |
| long / desktop | svelte | 5/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / desktop | svelte | 6/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 6/passed | 643213 / 189923 | 383425 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 7/passed | 643213 / 189923 | 383428 | 60277 / 18566 | 0 |
| long / desktop | svelte | 7/passed | 1807376 / 1156941 | 1177557 | 47598 / 16466 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 1729.5999999046326 | 2796.199999809265 | 2075.519999885559 | failed |
| long / mobile | threadSwitch.ms | 522.8999998569489 | 986.5 | 627.4799998283386 | failed |
| long / mobile | history1.ms | 581.5 | 764.5 | 697.8 | failed |
| long / mobile | history2.ms | 913 | 764.8000001907349 | 1095.6 | passed |
| long / mobile | history3.ms | 1344.2999999523163 | 882.8999998569489 | 1613.1599999427795 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 189923 | 330791 | 220643 | failed |
| long / mobile | entry.fontTransferBytes | 190633 | 826876 | 293033 | failed |
| long / mobile | settled.JSHeapUsedSize | 7040072 | 20845232 | 15428680 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 1828.2000000476837 | 2775.5 | 2193.8400000572205 | failed |
| long / desktop | threadSwitch.ms | 597.1000001430511 | 953.7000000476837 | 716.5200001716613 | failed |
| long / desktop | history1.ms | 614.5 | 765.6999998092651 | 737.4 | failed |
| long / desktop | history2.ms | 925.0999999046326 | 797.8999998569489 | 1110.119999885559 | passed |
| long / desktop | history3.ms | 1256.7999999523163 | 898.3999998569489 | 1508.1599999427795 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 189923 | 330791 | 220643 | failed |
| long / desktop | entry.fontTransferBytes | 190633 | 826876 | 293033 | failed |
| long / desktop | settled.JSHeapUsedSize | 7035308 | 20699340 | 15423916 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
