# Complete candidate result: budgets still fail

Exact source and served revision: `249e1e95ebde24a4a462f7afdecaad5ceb014658`.
All 32 original trials pass execution: seven alternating measured trials plus
one warmup per variant/device, desktop/mobile at 4x CPU, complete canonical
readiness and the original Studio fonts. Fresh builds, all 24 source gates and
native asset freshness pass before measurement. The task-owned lane was
serialized on BugMachine; ambient host agents remain, so dedicated hardware-lab
causality is not claimed.

Performance acceptance fails **12 of 16 unchanged budgets**. Second and third
history loads pass on both devices; readiness, thread switching, first history,
application gzip, fonts and post-GC heap fail on both devices.

| Metric | Native mobile / limit | Native desktop / limit |
| --- | --- | --- |
| Ready with fonts and two frames | 2792.5 / 2071.44 ms | 2759.1 / 2212.92 ms |
| Thread switch | 920.9 / 628.68 ms | 827.3 / 715.32 ms |
| First history load | 749.1 / 716.88 ms | 782.2 / 737.04 ms |
| Requested application gzip | 328917 / 220629 B | 328917 / 220629 B |
| Cold font transfer | 826876 / 293034 B | 826876 / 293035 B |
| Settled post-GC JS heap | 20819244 / 15433252 B | 20712096 / 15439668 B |

Requested application gzip is only 1874 B below the separate `60bb255` cohort.
The combined candidate remains 108288 B above its current application limit.
Heap and readiness remain materially over budget; these results do not justify
claiming the migration complete or attributing a stable framework-only speedup.
The candidate also includes current token-retirement changes: vanilla gzip is
189909 B versus 189923 B in the older control, so the two source snapshots are
not an isolated experiment on a single rendering change.

Two of four separately excluded diagnostics pass. Both native CPU profiles are
rejected by the original strict `delta-negative` policy. Independent sanitized
initial heap summaries survive those failures, with raw heaps removed. They
are debugging evidence, not the accepted settled-heap measurements. Research
into Chrome's timestamp-order interpretation cannot retrospectively validate
these discarded raw profiles or change their original rejection status.

This runner exported the exact revision **before both builds**. Both original
module reports record the correct SHA. The unchanged strict attribution helper
accepts `observed-entry-requests-hash-and-revision-matched` directly against
the original metrics. No rebuilt/relabelled metadata is needed for this cohort.
Package/module rendered lengths remain raw contribution evidence, not gzip
allocation or causal CPU attribution.

Six original report/module/attribution files and the original safe runner-receipt
archive are retained with exact sizes and hashes in provenance.json. Gzip
restores exact original bytes. The archive retains source/clean-tree/timing and
exit metadata; source-check/build log digests are recorded without publishing
raw logs. The diagnostic report confirms the measured cohort was preserved.

The [four exact-revision functional workflows](../../experiments/2026-11-15-249e1e9/README.md)
pass. This candidate remains isolated and undeployed. The font amendment is
inactive pending explicit approval; no threshold, workload or readiness rule
changed. Vanilla remains the maintained default, and full migration acceptance
stays open.
