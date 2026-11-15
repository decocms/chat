# Four excluded heap source-association diagnostics

This diagnostic run identifies V8 function/constructor source associations, not allocation sites, retaining modules, retained bytes or performance improvement. It contains zero original trials and four excluded diagnostics, one per frontend/device. The runner exited 1, `measuredCohortPreserved` is true and all 16 budgets remain unverified. No original 32-trial cohort was replayed or replaced, and its performance failures remain unresolved.

Exact source `94a312e0cabda23398ec074705c0a9e9bbce518c` passed [all 24 source gates and preview freshness on both operating systems, plus Ubuntu layout](https://github.com/vibegui/vibebook.dev/actions/runs/43695717484). The preceding exact helper source `ddfee1236b2fe9e200a90ac96e037e259d935d02` also passed [its original repository CI](https://github.com/vibegui/vibebook.dev/actions/runs/43695476620). Application/public trees and dependencies remain identical to baseline `485ca0c`; only diagnostic tooling changed. No application candidate was measured or promoted by this collection.

Strict CPU validation passed both vanilla trials and native desktop. Native mobile retains its `delta-negative` failure. All four private heaps were summarized and source-associated; this independent result does not override CPU failure. The raw snapshots were removed by the existing capture cleanup and are not retained here. Declared seven repetitions and one warmup in the unchanged report were not executed.

| Native snapshot coverage | Mobile | Desktop |
| --- | ---: | ---: |
| All heap nodes | 482,255 | 483,509 |
| Source-associated nodes | 69,937 | 69,939 |
| Associated self-size bytes | 2,049,572 | 2,049,628 |
| Unattributed self-size bytes | 22,883,781 | 22,826,153 |
| All closures | 70,359 | 70,363 |
| Source-associated closures | 65,001 | 65,003 |

About 92% of native closures are associated, but most snapshot self-size bytes remain unattributed. Snapshot self size is not the performance heap-budget measurement or retained size. Vanilla association is much less complete: 152 of 5,498 / 5,503 closures are associated. Inline HTML scripts are deliberately ineligible; unmatched and builtin sources also remain unattributed. Association counts therefore cannot establish a complete frontend-to-frontend allocation comparison or assign the unattributed bytes to these source groups.

| Largest native closure source groups (emitted asset) | Mobile count | Desktop count |
| --- | ---: | ---: |
| `/svelte-preview/Button-DnqFw9Ee.js` | 29,552 | 29,552 |
| `/svelte-preview/mount-B9Wx5HbG.js` | 14,458 | 14,458 |
| `/svelte-preview/copy-DDLelU9j.js` | 9,458 | 9,458 |
| `/svelte-preview/api-BNReHrjQ.js` | 2,229 | 2,231 |

These are emitted-source groups, not component instance counts, allocation ownership, retaining paths or proof that changing a group will recover its self size. The copy chunk contains multiple modules; its count cannot be assigned entirely to RichNodes. The API chunk includes the Zod runtime; the count does not isolate Zod's individual functions. The total native/vanilla closure counts are independent node-type summary observations, not evidence that a framework caused their difference. Low vanilla associated bytes do not imply zero cost, and associated bytes cannot be compared across variants as a cost difference. Exact hashes, group self sizes, other groups, and both vanilla results remain in the original `source-association-summary.json`. Retention independently checked every total and reported top group against the original diagnostics.

`diagnostics.json.gz` and `metrics.json.gz` preserve exact downloaded bytes. `provenance.json` records compressed/original SHA-256 values, sizes and the independent summary checks. The original report, exit status, derived summary and reviewed private driver/preparation/protocol/root approval are unchanged. Preparation's “not executed” and pending-CI wording describes its historical stage; subsequent CI and execution are recorded separately. The retained baseline/current canonical diagnostic sources are preparation inputs, not captured application script source or executable workflow registrations.

Both complete decompressed JSON documents and the derived summary passed sanitation review: no raw profiles, signed deltas, nodes/edges/locations arrays, source text, heap strings, credentials, private URLs or absolute filesystem paths. Remaining origins are loopback and public Google Fonts; public asset hashes, sanitized CPU frames and fixed aggregate buckets remain intact. No discarded historical raw heap was reconstructed or relabeled. `SHA256SUMS` covers every file except itself. No browser, build, compiler, diagnostic or benchmark ran during retention; this source-association evidence does not grant performance acceptance.
