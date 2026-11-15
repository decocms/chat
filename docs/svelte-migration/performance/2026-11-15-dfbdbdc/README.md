# Performance evidence at dfbdbdc

Exact source/tested revision: `dfbdbdc8f433ad07a6dd999a1e99f69e0e8352f0`.
[GitHub run 43654920935](https://github.com/vibegui/vibebook.dev/actions/runs/43654920935).

All 32 original workload trials complete successfully: one warmup and seven repetitions per variant/device. Acceptance fails **12 of 16 unchanged budgets**. Readiness, thread switch, first history load, application gzip, font transfer and post-GC heap fail on both devices. Second/third history loads pass. This report predates removal of continuous Fire and the ordinary-dictation follow-up; it does not measure that later source.

Native application gzip is 360563 B versus a 222117 B limit. Font transfer is 826876 B versus about 293 KB. Heap is about 21 MB versus a 15.4 MB limit. Original Studio fonts remain active; no budgets or trials were waived.

Three of four separately excluded diagnostic trials pass. Native desktop CPU diagnostics reject a negative timestamp delta (sample1585,11456 nodes,1879 samples/deltas). The strict validator is unchanged. These diagnostic trials never enter the measured summaries.

Six original artifact files are retained without content edits; gzip restores exact original bytes. Provenance records original/stored sizes, SHA-256, source artifact names and run identity. Module metadata and diagnostics support investigation; they do not replace budget measurements. This evidence does not close M7 or authorize promotion. Vanilla stays default.
