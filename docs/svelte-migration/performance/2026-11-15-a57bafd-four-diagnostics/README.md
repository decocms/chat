# Playback experiment inactive: no meaningful diagnostic gain

The idempotent playback candidate remains isolated and inactive. One excluded diagnostic per frontend/device pair provides no meaningful improvement signal and cannot establish latency causality or performance acceptance. No original 32-trial cohort was replayed, shortened or replaced; the original performance budget failures remain unresolved.

Candidate `a57bafd40734855f65e64a4e127b3dc64ce1e469` passed [all 24 source gates and preview freshness on both operating systems, plus Ubuntu layout](https://github.com/vibegui/vibebook.dev/actions/runs/43693244863). Its canonical driver, six diagnostic helpers and dependencies match baseline `485ca0c`; the only application source change is playback. Source correctness and functional evidence do not establish a performance benefit.

Root executed the reviewed private driver once: zero original trials, four excluded diagnostics, `measuredCohortPreserved: true`, and exit 1. All 16 budgets remain unverified. Both vanilla trials passed strict CPU validation; both native trials failed with `delta-negative`. The separate signed-timestamp interpretation recorded six available phases without suppressing strict failures. The two native thread-switch phases were not reached after entry rejection. The declared seven repetitions and one warmup in the untouched report were not executed.

| Native entry diagnostic intervals (µs) | Baseline mobile | Candidate mobile | Baseline desktop | Candidate desktop |
| --- | ---: | ---: | ---: | ---: |
| All verified geometry `K` frames | 442,731 | 450,663 | 283,795 | 280,376 |
| Entire entry interval | 3,057,792 | 3,029,617 | 3,138,689 | 3,142,104 |

These are interpreted inter-sample intervals from **N=1 per frontend/device**, not validated strict CPU self time or proof of a change in readiness/latency. Geometry totals sum every verified `K` frame at old zero-based `0:7227` / new `0:7287`; they are neither the largest single frame nor the entire Field asset total. The root-derived comparison is preserved unchanged in `a57bafd-diagnostic-comparison.json`. Retention independently recomputed native geometry/entry totals against both original diagnostic documents. `source-position-witness.json` records verified emitted asset hashes, function starts and `root.clientWidth` positions without retaining script source or raw profiles.

The downloaded `diagnostics.json.gz` and `metrics.json.gz` are retained byte-for-byte, with compressed and decompressed SHA-256 values in `provenance.json`. Original report, exit status, reviewed private driver, preparation manifest/protocol/diffs/checksums and root approval are unchanged. Preparation's “not executed” and pending-CI statements describe the earlier preparation stage; `final-ci.json` and these actual results establish subsequent events. No original artifact was rewritten.

Both complete decompressed documents passed the recorded sanitation scan: no raw profiles/deltas, source text, heap strings, credentials, private URLs or absolute filesystem paths. Remaining origins are the loopback fixture and public Google Fonts. Retained frame provenance, counts, diagnostic intervals and heap aggregates remain intact. The explicitly retained driver/fixture preparation source is review evidence, not captured application script source. `SHA256SUMS` covers every retained file except itself. No browser, compiler, build, diagnostic or benchmark was run during retention; no candidate promotion follows.
