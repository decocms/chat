# Performance evidence at 14646bc

Exact source/tested revision: `14646bcf8f8445a7c7f8e8606c927a9ba791c87e`. [Run 43665138953](https://github.com/vibegui/vibebook.dev/actions/runs/43665138953).

All 32 original workload trials pass. Performance acceptance fails 12 of 16 unchanged budgets: readiness, thread switch, first history load, requested application gzip, actual font transfer and post-GC heap fail on both devices. Second and third history loads pass. No threshold or validator was relaxed.

Only two of four separately excluded diagnostic trials pass; both native diagnostic trials fail. Their failures are retained, and those diagnostics do not replace measured summaries. Six original artifact files are retained without content edits; gzip restores exact bytes. Provenance records original/stored hashes and sizes.

These are controlled frontend measurements, not production latency or a framework-only comparison across checkpoints. Source, workload and environment details remain in the original metrics. No budget/fidelity waiver, migration completion or default promotion is implied. Vanilla stays default.
