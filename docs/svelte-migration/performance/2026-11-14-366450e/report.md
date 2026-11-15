# Fully native versus vanilla controlled long-room benchmark
Status: passed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 1091.1 / 1122.2 | 64.7 / 69.3 | 224.2 / 225.6 | 358.8 / 376.7 |
| long / mobile | svelte | 7/7 | 2080.6 / 2167.8 | 292.0 / 310.7 | 617.3 / 664.2 | 805.5 / 824.1 |
| long / desktop | vanilla | 7/7 | 1135.7 / 1166.8 | 89.0 / 97.2 | 272.4 / 288.6 | 383.8 / 423.9 |
| long / desktop | svelte | 7/7 | 2069.1 / 2124.9 | 301.7 / 312.4 | 641.3 / 661.1 | 783.2 / 819.6 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 642201 / 189487 | 382989 | 59409 / 18527 | 0 |
| long / mobile | svelte | 1/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / mobile | svelte | 2/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / mobile | vanilla | 2/passed | 642201 / 189487 | 382989 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 3/passed | 642201 / 189487 | 382988 | 59409 / 18527 | 0 |
| long / mobile | svelte | 3/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / mobile | svelte | 4/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / mobile | vanilla | 4/passed | 642201 / 189487 | 382988 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 5/passed | 642201 / 189487 | 382988 | 59409 / 18527 | 0 |
| long / mobile | svelte | 5/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / mobile | svelte | 6/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / mobile | vanilla | 6/passed | 642201 / 189487 | 382987 | 59409 / 18527 | 0 |
| long / mobile | vanilla | 7/passed | 642201 / 189487 | 382987 | 59409 / 18527 | 0 |
| long / mobile | svelte | 7/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / desktop | vanilla | 1/passed | 642201 / 189487 | 382984 | 59409 / 18527 | 0 |
| long / desktop | svelte | 1/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / desktop | svelte | 2/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / desktop | vanilla | 2/passed | 642201 / 189487 | 382985 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 3/passed | 642201 / 189487 | 391274 | 59409 / 18527 | 0 |
| long / desktop | svelte | 3/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / desktop | svelte | 4/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / desktop | vanilla | 4/passed | 642201 / 189487 | 382991 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 5/passed | 642201 / 189487 | 382986 | 59409 / 18527 | 0 |
| long / desktop | svelte | 5/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / desktop | svelte | 6/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |
| long / desktop | vanilla | 6/passed | 642201 / 189487 | 382990 | 59409 / 18527 | 0 |
| long / desktop | vanilla | 7/passed | 642201 / 189487 | 382990 | 59409 / 18527 | 0 |
| long / desktop | svelte | 7/passed | 1936625 / 1183066 | 1203462 | 45464 / 15446 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 1091.1000000000058 | 2080.5999999999767 | 1309.320000000007 | failed |
| long / mobile | threadSwitch.ms | 332.70000000006985 | 640.7000000000116 | 399.2400000000838 | failed |
| long / mobile | history1.ms | 364.9000000000233 | 515 | 437.8800000000279 | failed |
| long / mobile | history2.ms | 532.1999999999534 | 545.0999999999767 | 638.639999999944 | passed |
| long / mobile | history3.ms | 782.9000000000233 | 689.6999999999534 | 939.4800000000279 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 189487 | 356916 | 220207 | failed |
| long / mobile | entry.fontTransferBytes | 190632 | 826876 | 293032 | failed |
| long / mobile | settled.JSHeapUsedSize | 7042792 | 21002584 | 15431400 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 1135.6999999999534 | 2069.0999999998603 | 1362.839999999944 | failed |
| long / desktop | threadSwitch.ms | 374.5 | 561 | 449.4 | failed |
| long / desktop | history1.ms | 381.69999999995343 | 532 | 458.0399999999441 | failed |
| long / desktop | history2.ms | 547.5 | 565.9000000001397 | 657 | passed |
| long / desktop | history3.ms | 814.8000000000466 | 684.5 | 977.7600000000558 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 189487 | 356916 | 220207 | failed |
| long / desktop | entry.fontTransferBytes | 190634 | 826876 | 293034 | failed |
| long / desktop | settled.JSHeapUsedSize | 7058276 | 20883676 | 15446884 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
