# Separate same-source module metadata recovery

The two original cohorts supplied TEST_APP_REVISION after their builds. The
original unlabelled module metadata remains preserved and rejected in each
cohort directory. Neither primary metrics nor original metadata was edited.

Fresh metadata-only builds ran at frozen source revisions:

| Original cohort | Rebuilt source | Successful workflow |
| --- | --- | --- |
| Deployed-source control | `3a73dffaf9fe3ff66045c08515a50714fc89060a` | [43676600858](https://github.com/vibegui/vibebook.dev/actions/runs/43676600858) |
| Semantic-parser/geometry candidate | `60bb255a9941489ff20f664a7a1bb8a464001c93` | [43676613408](https://github.com/vibegui/vibebook.dev/actions/runs/43676613408) |

The unchanged `scripts/ui-chunk-attribution.ts` validator, run with pinned
Bun 1.4.4, accepted both rebuilt Svelte reports against each original metrics
file. Both select `observed-entry-requests-hash-and-revision-matched`, with
55 requested entry assets. Exact source revision and observed asset hashes
must match; no validation was bypassed. Rebuilt module inputs and resulting
observed-entry attribution are retained losslessly with hashes in provenance.json.

The control has 16 attributed packages, including parse5; the candidate has
15 and excludes parse5 from observed entry requests. Package rendered byte
contributions are raw module evidence, not gzip savings. The measured requested
application gzip difference is separately retained in the original reports.
This auxiliary recovery changes no trial, diagnostic CPU validity, performance
budget or acceptance result. Both original cohorts still fail 12 of 16 budgets.
