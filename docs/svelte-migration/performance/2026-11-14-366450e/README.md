# Current complete controlled benchmark: budgets failed

[Run 43623490530](https://github.com/decocms/chat/actions/runs/43623490530)
tests source `366450e14a641f38d529150bd7174b6648a5e0be` directly.
All original 32 trials complete; **12 of 16 budget comparisons fail**.
Original reports, raw samples, build attribution and module metadata are copied
unchanged. [provenance.json](provenance.json) records their exact hashes.

| Metric | Mobile native / limit | Desktop native / limit |
| --- | --- | --- |
| Entry ready, ms | 2080.6 / 1309.32 | 2069.1 / 1362.84 |
| Thread switch, ms | 640.7 / 399.24 | 561 / 449.4 |
| Initial application gzip reference, B | 356916 / 220207 | 356916 / 220207 |
| Font transfer, B | 826876 / 293032 | 826876 / 293034 |
| Settled JS heap, B | 21002584 / 15431400 | 20883676 / 15446884 |

First history loads also fail; history pages two and three pass. No threshold
has changed. Application bytes improve from the prior native checkpoint, while
this cohort still fails acceptance. Whole emitted graph size is not this metric.

Four additional diagnostic trials are excluded from every acceptance summary.
Three complete; native desktop diagnostics fail at entry with `cpu-invalid`.
That diagnostic failure does not invalidate or replace the original 32 trials.
The mobile native CPU profile matches 1713 of 2323 samples to observed assets
and exact source/served hashes. Repeated `hhmm` calls account for approximately
173 ms across retained frames, motivating reuse of the browser time formatter.
The profile also identifies work in a shared generated Field chunk; that chunk
name alone does not establish which original component caused the cost.
The private heap snapshot is summarized numerically and deleted, not retained.

The report's leading `Status: passed` describes workload execution. Its explicit
performance verdict and the workflow exit status are failed. This is synthetic
frontend evidence; production, real providers and hardware remain separate gates.
