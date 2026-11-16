# Performance evidence at 890fbee

Exact source/tested revision: `890fbee856ce99b2acb72cb0a47d7ccae03956a5`.
[Run 43657685040](https://github.com/decocms/chat/actions/runs/43657685040).

All 32 original workload trials complete; all four separately excluded diagnostic trials pass with valid CPU profiles. Performance acceptance still fails **10 of 16 unchanged budgets**. Readiness, thread switch, requested application gzip, actual font transfer and post-GC heap fail on both devices. All three history loads pass on both devices. No trial, validator, feature or threshold was removed or relaxed.

Native initial application gzip is 355989 B against a 218436 B limit. Original Studio font transfer is 826876 B against about 293 KB. Heap is 20.9/20.8 MB against about 15.4 MB. Readiness medians are 1442.2/1352 ms against 1065/1032.12 ms on mobile/desktop. These controlled numbers are not production latency or a framework-only improvement claim; source, features and environment differ from earlier checkpoints.

Six original artifact files are retained without content edits; gzip restores exact bytes. Provenance records source identity, run ID, artifact names, sizes and hashes. Module/CPU/heap metadata supports investigation; excluded diagnostics do not replace measured summaries. This source predates main669 document-answer integration. No budget/fidelity waiver, M7 completion or default promotion is implied. Vanilla stays default.
