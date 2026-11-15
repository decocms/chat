# Proposed scoped Studio font-transfer amendment

Status: **proposal only; not approved or active**. This document requests one explicit user decision under [the migration plan's performance amendment rule](../svelte-full-migration-plan.md), line 169. It grants no exception itself. No font, stylesheet, runtime, benchmark, validator or threshold is changed by this proposal.

The proposed tradeoff is to preserve the exact frozen Studio normal/italic Inter and CommitMono files and their required rendered roles, while replacing only the native initial font-transfer ceiling with **900 KiB total (921,600 bytes)**. This is a fixed ceiling, not an unlimited allowance or an extra 900 KiB above vanilla. All requested font dependencies, including font stylesheets, response overhead and any additional font requests, remain counted by the existing measurement. The 146 cohort observed 826,876 bytes, leaving **94,724 bytes (92.50390625 KiB)** of headroom. Larger or additional faces are not implicitly authorized.

## Evidence and reason

The retained [14646bc run](https://github.com/vibegui/vibebook.dev/actions/runs/43665138953) completed all 32 original trials: one warmup and seven measured trials per variant/device, plus four separate diagnostic trials excluded from acceptance. Performance acceptance failed 12 of 16 budgets. Its fourteen measured native trials each recorded exactly three distinct cold font requests once, all completed HTTP 200, with no cache hits or duplicate URLs. Each trial transferred 826,876 bytes. [The evidence receipt](font-budget-proposal/146-evidence.md) and [machine audit](font-budget-proposal/146-font-audit.json) preserve every one of those 42 request records and identify the full original artifact by hash.

| Exact frozen Studio face | File bytes | Observed cold transfer per native trial |
| --- | ---: | ---: |
| Normal Inter variable | 352,240 | 352,020 |
| Italic Inter variable | 387,976 | 387,858 |
| CommitMono variable | 86,768 | 86,998 |
| Total | 826,984 | 826,876 |

Transfer is the retained CDP network value, not the sum of file sizes: compression and response overhead differ. The source files' sizes and SHA-256 digests match the frozen manifest. The sole Tailwind entry registers these three faces; no second stylesheet, speculative preload, fourth unused family or duplicate request was found. Seeded agent Markdown includes emphasis and inline/fenced code, so italic and Mono serve required roles on both devices. Removing them, synthesizing italic, substituting a system font or hiding content would change the typography/workload.

The original formula is native font transfer ≤ vanilla +100 KiB. In this exact cohort it gives 292,896 bytes on desktop and 293,029 on mobile. **Normal Inter alone transferred 352,020 bytes**, already exceeding those complete aggregate allowances by 59,124 and 58,991 bytes respectively. Preserving these exact files while meeting that formula is therefore contradictory even before italic and Mono are counted. Both variants still require complete observed font evidence; unlike typography is not relabeled as a matched-font experiment.

Earlier derivatives do not resolve that contradiction. [The retained forensic results](font-forensics/2026-11-14-general-core-result.md) reject CSS partitions even when both faces contain original data: decomposed Greek/Cyrillic marks fall back and change pixels and geometry. Earlier cmap-trimmed candidates changed quote rasterization. The whole-Latin core alone was 309,200 bytes and remained over the aggregate ceiling before other faces. [The inactive weight-range experiment](font-forensics/2026-11-14-weight-range-numeric.md) changed GPOS structure, lacked renderer-equivalence proof, and normal plus unchanged Mono still exceeded the old cap. None is approved for reuse. The original font files remain required; this proposal contains no new subset or font-processing experiment.

## Scope that would remain binding

Only the `entry.fontTransferBytes` limit would change, after explicit approval and a separately reviewed implementation. The following remain unchanged:

- Latency: native median readiness, thread switching and each history load ≤ max(1.20 × vanilla, vanilla +50 ms).
- Application HTML/JS/CSS gzip: native ≤ vanilla +30 KiB; font bodies remain separate.
- Post-GC heap: native ≤ vanilla +8 MiB on the common fixture.
- Original workload, cold contexts, four-times CPU throttle, warmups, seven measured trials per variant/device, canonical readiness, paired cohort completeness, lifecycle/cleanup, accessibility, privacy and security checks.
- Missing, failed, blocked or fallback-only font evidence remains unverified. The proposed fixed native ceiling does not turn incomplete native or vanilla observations into a pass.
- Studio file hashes, loaded families, weights, optical behavior, role metrics, geometry, raster fidelity, notices and semantic typography stay protected. Existing rejection evidence remains binding.
- Historical results and their original failed budget rows remain unchanged. A later approved rule must be identified as a new rule on a new exact-revision run, not silently applied to old reports.

This proposal would not make the migration complete or make its other failed budgets pass. Under the original 146 results, changing two font rows alone would still leave ten of sixteen budgets failed. That arithmetic is explanatory, not a new acceptance assessment or a rerun.

## Approval and subsequent validation

Root review and **explicit user approval** are prerequisites to changing the plan, budget assessor, tests or completion report. Approval must state the fixed 921,600-byte cap, its font-only scope, the exact Studio-file requirement and unchanged remaining criteria. Record the approving message/date and amendment link; an agent's source review is not that approval.

If approved, implement a narrow assessor/test update separately, preserve the old historical reports, and run a fresh full matched seven-trial cohort at the new exact source revision. It must record all actual font requests, unchanged asset hashes/roles and all other budget outcomes, and retain failed or unverified observations. The existing independent Studio/theme/browser gates remain required. If approval is declined, retain the original font rule and report it failed until a genuinely fidelity-equivalent optimization is proved. Neither outcome authorizes activation of a rejected derivative.
