# Fully native versus vanilla controlled long-room benchmark
Workload execution: passed
Performance acceptance: failed

Chromium: 158.0.8127.18; x64; repetitions 7 per variant and device after 1 warmup(s); 1440×1000 / 390×844, 4x CPU; fonts network-public-fonts; exclusive cohort declared true.

All values below require successful measured samples; failures remain in metrics.json. Fail-fast stops at the first invalid trial by default (METRICS_FAIL_FAST=0 continues). Step timeout defaults to 30 seconds (METRICS_STEP_TIMEOUT_MS); navigation timeout is 120 seconds. p95 is nearest rank, not a statistical confidence bound.

Action/update intervals include automation observation of the required DOM change and two animation frames. They are not pure WebSocket-event or rendering latency; see gaps in metrics.json. Fixture delivery alone never completes these measurements.

| Workload / device | Variant | Valid/total | Ready p50/p95 ms | Receipt update p50/p95 ms | Compose echo p50/p95 ms | Room switch p50/p95 ms |
|---|---|---:|---:|---:|---:|---:|
| long / mobile | vanilla | 7/7 | 1726.2 / 1802.5 | 92.9 / 106.7 | 329.8 / 332.2 | 587.6 / 623.6 |
| long / mobile | svelte | 7/7 | 2792.5 / 2842.3 | 279.3 / 283.8 | 681.0 / 697.8 | 1136.3 / 1159.3 |
| long / desktop | vanilla | 7/7 | 1844.1 / 1911.5 | 125.6 / 127.8 | 413.8 / 416.0 | 591.9 / 620.0 |
| long / desktop | svelte | 7/7 | 2759.1 / 2822.4 | 291.3 / 303.7 | 692.0 / 773.5 | 1068.3 / 1101.1 |

| Workload / device | Variant | Trial/status | Entry all local asset raw / gzip-reference bytes | Entry known HTTP transfer bytes | Post-entry all local asset raw / gzip-reference bytes | Missing transfer sizes |
|---|---|---|---:|---:|---:|---:|
| long / mobile | vanilla | 1/passed | 643165 / 189909 | 383410 | 60277 / 18566 | 0 |
| long / mobile | svelte | 1/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / mobile | svelte | 2/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 2/passed | 643165 / 189909 | 383410 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 3/passed | 643165 / 189909 | 383410 | 60277 / 18566 | 0 |
| long / mobile | svelte | 3/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / mobile | svelte | 4/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 4/passed | 643165 / 189909 | 383414 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 5/passed | 643165 / 189909 | 383412 | 60277 / 18566 | 0 |
| long / mobile | svelte | 5/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / mobile | svelte | 6/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / mobile | vanilla | 6/passed | 643165 / 189909 | 383413 | 60277 / 18566 | 0 |
| long / mobile | vanilla | 7/passed | 643165 / 189909 | 383414 | 60277 / 18566 | 0 |
| long / mobile | svelte | 7/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 1/passed | 643165 / 189909 | 383411 | 60277 / 18566 | 0 |
| long / desktop | svelte | 1/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / desktop | svelte | 2/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 2/passed | 643165 / 189909 | 383413 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 3/passed | 643165 / 189909 | 383414 | 60277 / 18566 | 0 |
| long / desktop | svelte | 3/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / desktop | svelte | 4/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 4/passed | 643165 / 189909 | 383414 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 5/passed | 643165 / 189909 | 383413 | 60277 / 18566 | 0 |
| long / desktop | svelte | 5/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / desktop | svelte | 6/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |
| long / desktop | vanilla | 6/passed | 643165 / 189909 | 383410 | 60277 / 18566 | 0 |
| long / desktop | vanilla | 7/passed | 643165 / 189909 | 383413 | 60277 / 18566 | 0 |
| long / desktop | svelte | 7/passed | 1801164 / 1155067 | 1176181 | 47598 / 16466 | 0 |

## Approved budget comparisons (not execution status)

| Workload / device | Metric | Vanilla median | Native median | Limit | Result |
|---|---|---:|---:|---:|---|
| long / mobile | entry.readyWithFontsAndTwoFramesMs | 1726.2000000476837 | 2792.5 | 2071.4400000572205 | failed |
| long / mobile | threadSwitch.ms | 523.8999998569489 | 920.9000000953674 | 628.6799998283386 | failed |
| long / mobile | history1.ms | 597.4000000953674 | 749.0999999046326 | 716.8800001144409 | failed |
| long / mobile | history2.ms | 897.1000001430511 | 765.7000000476837 | 1076.5200001716614 | passed |
| long / mobile | history3.ms | 1344.8999998569489 | 898.7000000476837 | 1613.8799998283387 | passed |
| long / mobile | entry.applicationGzipReferenceBytes | 189909 | 328917 | 220629 | failed |
| long / mobile | entry.fontTransferBytes | 190634 | 826876 | 293034 | failed |
| long / mobile | settled.JSHeapUsedSize | 7044644 | 20819244 | 15433252 | failed |
| long / desktop | entry.readyWithFontsAndTwoFramesMs | 1844.1000001430511 | 2759.0999999046326 | 2212.9200001716613 | failed |
| long / desktop | threadSwitch.ms | 596.0999999046326 | 827.2999999523163 | 715.319999885559 | failed |
| long / desktop | history1.ms | 614.1999998092651 | 782.2000000476837 | 737.0399997711181 | failed |
| long / desktop | history2.ms | 924.2000000476837 | 798.2000000476837 | 1109.0400000572204 | passed |
| long / desktop | history3.ms | 1272.2999999523163 | 914.5 | 1526.7599999427796 | passed |
| long / desktop | entry.applicationGzipReferenceBytes | 189909 | 328917 | 220629 | failed |
| long / desktop | entry.fontTransferBytes | 190635 | 826876 | 293035 | failed |
| long / desktop | settled.JSHeapUsedSize | 7051060 | 20712096 | 15439668 | failed |

Performance acceptance: failed. Twenty actual editor/provider lifecycle cycles require the separate real-Worker cohort. Previous hybrid budget failures are historical evidence, not overwritten or cleared by generating this report.

Scroll RAF intervals, frame-p95/jank counts, thread switching, Inbox loading, CPU/layout counters and heap/nodes are in each raw sample and summaries. V8 heap is not browser RSS.

Entry/deferred totals above include all requested local bodies, including local fonts. Budget metrics separately select application HTML/JS/CSS and actual font dependencies. Bytes come from actual requested resources classified by request-start phase, never a directory-wide chunk sum. See byteSummary and resources in metrics.json. gzip references are individually compressed file sizes, not measured transfer or a hypothetical concatenated bundle.

This is controlled frontend evidence, not production/Worker/provider acceptance. See config, fixture digests, environment, asset hashes and gaps in metrics.json.
