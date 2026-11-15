# Fully native versus vanilla controlled long-room benchmark
Workload execution: passed
Performance acceptance: failed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 1300.9 / 1319.8 | 75.3 / 86.9 | 294.0 / 297.8 | 514.0 / 554.0 |
| long / mobile | svelte | 7/7 | 2590.3 / 2652.7 | 253.3 / 281.0 | 596.5 / 629.9 | 1032.3 / 1077.6 |
| long / desktop | vanilla | 7/7 | 1356.7 / 1426.4 | 103.6 / 116.2 | 338.8 / 361.1 | 523.7 / 557.8 |
| long / desktop | svelte | 7/7 | 2399.2 / 2503.8 | 253.7 / 275.8 | 579.4 / 612.5 | 968.2 / 999.9 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 638215 / 188145 | 381660 | 59409 / 18527 | 0 |
| long / mobile | svelte | 1/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / mobile | svelte | 2/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 2/passed | 638215 / 188145 | 381643 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 3/passed | 638215 / 188145 | 381644 | 59409 / 18527 | 0 |
| long / mobile | svelte | 3/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / mobile | svelte | 4/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 4/passed | 638215 / 188145 | 381646 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 5/passed | 638215 / 188145 | 381642 | 59409 / 18527 | 0 |
| long / mobile | svelte | 5/passed | 1935444 / 1182620 | 1200953 | 47598 / 16466 | 2 |
| long / mobile | svelte | 6/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 6/passed | 638215 / 188145 | 381642 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 7/passed | 638215 / 188145 | 381642 | 59409 / 18527 | 0 |
| long / mobile | svelte | 7/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 1/passed | 638215 / 188145 | 381506 | 59409 / 18527 | 0 |
| long / desktop | svelte | 1/passed | 1935444 / 1182620 | 1200953 | 47598 / 16466 | 2 |
| long / desktop | svelte | 2/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 2/passed | 638215 / 188145 | 381509 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 3/passed | 638215 / 188145 | 381506 | 59409 / 18527 | 0 |
| long / desktop | svelte | 3/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / desktop | svelte | 4/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 4/passed | 638215 / 188145 | 381510 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 5/passed | 638215 / 188145 | 381510 | 59409 / 18527 | 0 |
| long / desktop | svelte | 5/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / desktop | svelte | 6/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 6/passed | 638215 / 188145 | 381510 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 7/passed | 638215 / 188145 | 381646 | 59409 / 18527 | 0 |
| long / desktop | svelte | 7/passed | 1935444 / 1182620 | 1203016 | 47598 / 16466 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 1300.899999999965 | 2590.2999999999884 | 1561.079999999958 | failed |
| long / mobile | threadSwitch.ms | 458.29999999998836 | 803.7000000000698 | 549.959999999986 | failed |
| long / mobile | history1.ms | 515 | 682 | 618 | failed |
| long / mobile | history2.ms | 764.3999999999651 | 673 | 917.279999999958 | passed |
| long / mobile | history3.ms | 1129 | 798.7000000000116 | 1354.8 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 188145 | 356470 | 218865 | failed |
| long / mobile | entry.fontTransferBytes | 190629 | 826876 | 293029 | failed |
| long / mobile | settled.JSHeapUsedSize | 7041008 | 21009216 | 15429616 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 1356.6999999999534 | 2399.1999999999534 | 1628.039999999944 | failed |
| long / desktop | threadSwitch.ms | 506.5 | 700.1000000000931 | 607.8 | failed |
| long / desktop | history1.ms | 515.3000000000466 | 681.6000000000931 | 618.3600000000558 | failed |
| long / desktop | history2.ms | 747.1000000000931 | 698.2000000001863 | 896.5200000001117 | passed |
| long / desktop | history3.ms | 1140.2999999998137 | 765.3000000000466 | 1368.3599999997764 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 188145 | 356470 | 218865 | failed |
| long / desktop | entry.fontTransferBytes | 190496 | 826876 | 292896 | failed |
| long / desktop | settled.JSHeapUsedSize | 7039412 | 20891384 | 15428020 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
