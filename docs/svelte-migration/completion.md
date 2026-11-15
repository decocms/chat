# Full migration acceptance report

Status: **in progress, not accepted**. This report tracks evidence against
`../svelte-full-migration-plan.md`; it does not replace its conditions. Vanilla
remains the default and Svelte requires `?ui=svelte`.

The consolidated migration [PR #1](https://github.com/vibegui/vibebook.dev/pull/1)
merged as `3a73dffaf9fe3ff66045c08515a50714fc89060a`. PR #2 is closed, with its
work preserved in #1; no migration PR remains open. Both production builds
succeeded and [three deployed asset hashes match](production/2026-11-15-3a73dff/README.md).
This is an opt-in checkpoint. Authenticated production coexistence/rollback and
maintainer acceptance remain unverified.

Main `a7e8ac9` is integrated. The direct-MCP checkpoint at `fe9584c` passes a
fresh native build and [all 24 mandatory source gates](verification/fe9584c-direct-mcp-source.json),
including the new actual-SDK protocol tests. The inferred identity endpoint
validates and rechecks membership/connection authority around signing. The native
client owns short-lived credentials and SDK sessions within its RoomScope;
initialization can fall back, but a started tool call cannot replay through the
proxy. Default direct requests also omit cookies and refuse redirects. Reader
consent remains required. Matching generated assets are refreshed. The
[complete real Worker/browser cohort](managed-browser/2026-11-15-fe9584c/README.md)
and all four published functional workflows pass, as do main's repository and
browser workflows. Both variants verify the actual identity signature/claims,
reader approval, one effect and one failed direct call, no replay via the Worker
and no forwarded cookies. Twelve display profiles, twenty lifecycle cycles and
the existing document/consent regressions pass. The [first HMR failure and unchanged
passing retry](app-hmr/2026-11-15-affadd2/README.md) are retained separately; no
cause or product fix is claimed. Legacy token/OAuth fallback remains temporarily
compatible with this deployed main; Gui's runtime token-removal follow-up and
the matching typed-contract port are prepared separately and not yet integrated.

Performance remains unaccepted. The latest retained complete cohort is still
`14646bc`, with 12 of 16 original budgets failed. A fresh unchanged control at
deployed `3a73dff` is running. The [font-budget amendment](font-budget-amendment-proposal.md)
is a proposal only, awaiting explicit user approval; no plan or validator limit
has changed. Layout and Markdown-parser experiments remain isolated and have
not been deployed or accepted as performance improvements.

## Earlier checkpoints

The entries below retain their original source scopes and historical limitations.
Their pending statements do not replace the current checkpoint status above.

Current native document integration at `7516b84` passes a fresh build, [all 24 source gates](verification/7516b84-document-answer-source.json), and the [complete real Worker/browser cohort](managed-browser/2026-11-15-7516b84/README.md). Both variants deliver `open_doc` to two own tabs, refuse missing/deleted epics, render/update read-only cards without message writes, and retain two real R2/private-channel App versions inside the doc. Existing reader consent, stock SDK and replacement-authority audits, all twelve display profiles and twenty lifecycle cycles pass. The [same-epic vanilla failure](managed-browser/2026-11-15-de5570e-document-failure/README.md) and [remote-App consent regression](managed-browser/2026-11-15-1809c28-consent-failure/README.md) were reproduced and fixed without weakening their assertions. Matching assets are refreshed; published-head CI and production verification remain required. This is an opt-in checkpoint, not full-plan acceptance.

Published `14646bc` passes all four functional workflows: [repository](https://github.com/vibegui/vibebook.dev/actions/runs/43665113323), [integrated browser](https://github.com/vibegui/vibebook.dev/actions/runs/43665121253), [App security](https://github.com/vibegui/vibebook.dev/actions/runs/43665126747), and [HMR](https://github.com/vibegui/vibebook.dev/actions/runs/43665132079). Its [complete performance cohort](performance/2026-11-15-14646bc/README.md) executes all 32 original trials but fails **12 of 16 unchanged budgets**. Two of four excluded diagnostic trials pass; both native diagnostics fail and remain retained. Readiness, thread switch, first history load, application gzip, original Studio font transfer and heap fail on both devices. Second and third history loads pass. This checkpoint predates direct-MCP integration; it does not verify that later source or imply a framework-only comparison across runs.

Earlier `890fbee` [functional evidence](managed-browser/2026-11-15-890fbee/README.md) and its [performance cohort](performance/2026-11-15-890fbee/README.md) remain retained. That cohort failed 10 of 16 unchanged budgets before document integration. No later-source or framework-only speedup is claimed, and no acceptance budget is waived.

The [clean inventory](inventory-current-2026-11-15-890fbee/README.md) covers 406 files and maps every supplied candidate to an owner. Its per-candidate registry still lacks review records; that does not erase independent unit/browser evidence. M0/F56 final closure, remaining feature/environment checks, performance and maintainer acceptance stay open.

Earlier checked source `a96ac43` passes a fresh build and [all 24 repository gates](verification/a96ac43-whisper-finish-source.json), including actual Composer Enter/Whisper DOM cases and the unchanged RoomShell removal-before-DOM-flush regression. Ordinary dictation is integrated: Enter waits at most eight seconds for an owned refinement, with visible loading and cancellation/revision fences. Main `cd47d1c` is merged. Matching preview assets are refreshed. Published-head browser, HMR, security and freshness checks remain required; the complete `350e4cb` browser proof below predates this follow-up.

The previous complete [performance cohort at dfbdbdc](performance/2026-11-15-dfbdbdc/README.md) executes all 32 original trials but fails **12 of 16 unchanged budgets**. Application gzip is 360563 B against 222117 B; font transfer is 826876 B against about 293 KB. Readiness, thread switch, first history and heap also fail on both devices. Three of four excluded diagnostics pass; native desktop rejects a negative CPU timestamp delta. Original JSON/report/module metadata and exact hashes are retained. This cohort predates the ordinary-dictation conversion and does not measure its later source. No acceptance budget is waived.

Main `dcdb3d2` was merged at `4de282a` following Gui's approved
voice simplification (room messages 2568–2575). Continuous Fire is retired;
ordinary microphone/hold-Space dictation fills a draft and Enter sends to the
normal Claude. Native conversion and its independent source review are complete at the source level; final published-head checks remain open. Cards, uploaded HTML opening beside the chat, historical messages and
the `fire_card` rewrite tool remain supported. The backend retirement checkpoint
`ea617ae` passes all four `test:rpc` suites on BugMachine (164 tests, 1735
assertions), including the retired route's 404/no-effects regression and retained
STT bounds, authorization and late-membership fences. This targeted result does
not verify the final native conversion or its generated preview.

Ordinary dictation source `350e4cb` passes a fresh build, [all 24 source gates](verification/350e4cb-ordinary-dictation-source.json), and the [complete Worker/browser cohort](managed-browser/2026-11-15-350e4cb/README.md). All twelve profiles, twenty lifecycle cycles, document interoperation, both App authority audits and actual Chromium microphone cancellation pass. The generated preview matches this source. The subsequent main `cd47d1c` is merged at `f1f2914`; its native Enter-waits-for-Whisper follow-up and visible loading state are in progress. Neither historical cohort verifies that pending follow-up.

Historical combined tested source `bf147df` passes a fresh build, all 24 repository
gates and the [complete actual-Worker browser cohort](managed-browser/2026-11-14-bf147df/README.md).
All twelve language/theme/viewport profiles now pass, including usable short-phone
chat and contained composer. The real Chromium synthetic-input audit verifies
retained microphone pointer capture, native sampling, explicit Fire-on/off and
input-track/context cleanup. Twenty lifecycle cycles, native/default document
collaboration and both variants' App authority/consent audits pass. The
[exact source receipt](verification/bf147df-continuous-fire-source.json) and
[preview asset receipt](preview-build-2026-11-14.json) bind the refreshed build
to this source. Published-head `dfbdbdc` passes [repository checks](https://github.com/vibegui/vibebook.dev/actions/runs/43654891131), [integrated browser](https://github.com/vibegui/vibebook.dev/actions/runs/43654899052), [App security](https://github.com/vibegui/vibebook.dev/actions/runs/43654907958), and [HMR](https://github.com/vibegui/vibebook.dev/actions/runs/43654914150). Its new [performance cohort](https://github.com/vibegui/vibebook.dev/actions/runs/43654920935) is pending. These checks predate the voice workflow change below.

Published source `587de12` passes the full [repository workflow](https://github.com/vibegui/vibebook.dev/actions/runs/43642706919),
including Linux/macOS source gates, generated-asset consistency and the layout
job. Its [retained browser result](managed-browser/2026-11-14-587de12-short-viewport/README.md)
passes the R2 Viewer, all core phases, lifecycle and App audits, but fails four
short-phone profiles. Eight of twelve profiles pass. The mobile notice-height
fix is integrated and requires a new actual browser run.

The earlier complete integrated browser, HMR and App transport security workflows
at `9f58378` pass; [original safe JSON and exact provenance](managed-browser/2026-11-14-9f58378/README.md)
remain historical evidence, not proof of later revisions. The `139573a`
checkpoint passed generated-asset consistency but failed HMR because the new AI
binding triggered Wrangler remote authentication.
[Explicit local mode and owned child-exit observation](source-hmr-local-worker.md)
fix the reproduced HMR failure; the managed passing run verifies that fix.

Historical source `649f773` passed preview builds and repository source gates
on Linux/macOS but failed freshness and the R2 Viewer. The [exact source
receipt](verification/649f773-managed-source.json) and [failed browser
JSON](managed-browser/2026-11-14-649f773-failure/README.md) are retained. The
current preview was refreshed from that run's original build artifact; [the asset
receipt](preview-build-2026-11-14.json) records preserved default-asset hashes.
The published `587de12` result above verifies recovery of those two failures.

Combined source `7bbbf6f` passes
a fresh build and all 24 gates on BugMachine, including strict Svelte/backend/
tooling, actual Composer DOM regressions, the media adapter and structural-sharing
cases. [The exact source receipt](verification/7bbbf6f-continuous-fire-source.json)
does not substitute for the currently running complete Worker/browser audit.

The earlier complete [performance cohort](performance/2026-11-14-139573a/README.md)
executes all 32 original trials but fails **11 of 16 budget comparisons**.
Application gzip is 358662 B against a 220947 B limit; fonts are 826876 B against
approximately 293031 B. Readiness, thread switch and heap fail on both devices;
first history load fails on mobile. Three of four separate excluded diagnostic
trials complete; native mobile diagnostics fail with `cpu-invalid`. Neither
execution success nor diagnostics waive acceptance budgets. The original JSON,
report and module metadata are retained with exact hashes.

The previous integration baseline was main `5027d7d`, merged at `b82d9aa`.
The [native continuous Fire port](native-continuous-fire.md) is integrated at
`70ab4a5`: swipe-up locks recording, independent final chunks feed a bounded
serialized queue, and the actual capture adapter shares a resumed stream/level
source with scoped cleanup. Source review accepted the discard, watchdog and
long-hold continuation fixes. The merged pure cohort passes 34 tests / 176
assertions; strict type and actual Composer DOM gates pass at `7bbbf6f`, while
the full Chromium audit remains pending. Both home variants expose Nova UI; native selection uses the atomic
Studio Switch. Fire-off cursor handoff is ported into the typed handler, with
an actual SQLite regression proving room/account isolation and late-membership
rejection. All 34 focused RPC tests pass 336 assertions. The independent R2
response helper narrows the actual SDK range union; six focused tests pass 153
assertions for full, ignored, suffix, offset, bounded and HEAD response behavior.
Final combined type and browser checks remain required after these follow-ups.
Fire now uses a dedicated Haiku runner tab and Workers AI transcription, with
an owned recording and authenticated state boundary. Messages include the
actual alongside-file context. Uploaded HTML opens beside chat; room apps and
agent `app_open` select Apps. Agent-selected remote apps still require reader
Open/Allow before initialization. Direct reader Open and local room apps retain
their existing grants. Compact room-app attachment rows and the Haiku-aware
duplicate-listener warning are ported.

Combined source `43bedea` passes a fresh native build and **all 24 repository
gates**, including actual DOM regressions, UI/tooling/backend TypeScript,
runtime RPC/authority tests, client boundaries, style and formatting policies.
[The exact source receipt](verification/43bedea-current-main-source.json) and
[matching preview build](preview-build-2026-11-14.json) record provenance.
The refreshed preview preserves the maintained default assets during refresh.
Adversarial review found and resolved pending-enable, late-recorder and
ACK/canonical races. Focused runner tests pass, while real microphone/Whisper
and dedicated runner hardware remain separate acceptance requirements.

The [complete combined real-Worker browser cohort](native-application-browser/2026-11-14-43bedea/README.md)
also passes: core flows, twenty lifecycle cycles, eight profiles and independent
inline App OAuth/stock SDK/reader-approval/replacement/full-width checks in both
variants. It includes the newer actual MCP `app_open` reader gate and unchanged
provider counters before reader approval. Original safe JSON and hashes are
retained. Pushed-head CI and HMR still need revalidation; real speech, runner
hardware, production and measured performance acceptance remain open.
The earlier [targeted App proof](inline-app-browser/2026-11-14-main-3b86/README.md)
is retained separately and is not substituted for the full cohort.

Combined backend-boundary source `1de343e` passes a fresh native build and all
24 repository gates on BugMachine. The [exact source receipt](verification/1de343e-backend-boundaries-source.json)
includes the streamed-body limits, authenticated file publication fence, runtime
connection row projections, and provider metadata validation. This source-only
proof does not replace the separate browser, performance or production gates.

The [source/build receipt](verification/5a7f2c1-current-main-source.json)
records the all-24-gate producer of the committed preview at `366450e`.
Later source changes require another build, generated asset refresh and browser
cohort. [The current ledger](change-ledger.md) retains the outstanding behavior
and acceptance obligations.

Original Studio fonts remain active. Both inactive partition candidates were
rejected by actual fidelity/transfer evidence, retained under
[font forensics](font-forensics/2026-11-14-general-core-result.md).
No font or performance amendment is assumed. The immutable current inventory,
full source-owner ledger, final assets and acceptance cohorts must be refreshed
after these new ports land. Incremental implementation and targeted tests do not
close the migration acceptance conditions.

| Gate | Current evidence | Remaining proof |
| --- | --- | --- |
| M0 inventory/parity | `inventory.json`, `feature-parity.md`, `change-ledger.md`, frozen Studio references | Complete current feature/state/route verification references and reconcile final main |
| M1 strict architecture | Separate strict projects, schema contracts, client-boundary negative fixtures; repository gates pass Linux/macOS at `d8b99e5` | Final-head full checks and remaining boundary/interop assertion audit |
| M2 inferred RPC | `api-coverage.md`, generated Hono declarations and negative type fixtures | Final coverage audit and runtime failure cases for every migrated operation |
| M3 Tailwind | Sole authored entry `svelte/styles/tailwind.css`, full style audit; approved scoped xterm exception | Final-head source and emitted graph checks |
| M4 Studio theme | Frozen public/authenticated references, original self-hosted Inter/CommitMono assets, semantic token projection and eight passing real application profiles | Final-head interactive states, full token comparison and final visual acceptance |
| M5 atomic/accessibility | Owned atomic components and interaction tests; eight passing real application profiles with keyboard/focus and zero axe violations | Final-head regression, 768px visual evidence and manual screen-reader checks |
| M6 native application | Native root and feature owners; host/production registry removed; seven real Worker phases and 20 socket/editor lifecycle cycles pass | Full parity matrix, final-head retention analysis, remaining provider/error/permission workflows and persistence acceptance |
| M7 development/regression/performance | Frozen-install Linux/macOS CI, actual source HMR, real Worker browser workflow, complete 32-trial desktop/mobile performance evidence | Final generated artifacts, final-head HMR/browser cohort and passing measured budgets |
| M8 publish/coexistence | Independent vanilla build/default routing retained | Successful deployment, authenticated production side-by-side collaboration, rollback and maintainer acceptance |

## Historical native application browser failures

[Run 43558762566](https://github.com/vibegui/vibebook.dev/actions/runs/43558762566)
tests PR head `3357e09` through GitHub's merge revision
`9a4eb2a6e9a1224b27283c5b140a6e3950762177`. The retained
[results](native-app-integration/current-root/2026-11-14/results.json) and
[runner receipt](native-app-integration/current-root/2026-11-14/runner.json)
report a **failed overall run**, with these passing real Worker phases:

- Supported HTTP/MCP fixture setup through Book, D1 and R2, with variant/version checks.
- Home/room/thread/Back navigation with application-owned room/thread drafts.
- Native UI compose, real Worker ACK/canonical WebSocket update and second native client.
- Unpinned reading anchor preserved across full Board and a hidden peer update, followed by repin and own-send checks.
- R2 Viewer and actual browser Back/Forward.
- Bidirectional native/vanilla live Unicode document edits through Yjs/DocRoom, including the real MCP markdown mirror.
- Mobile sidebar/thread and Viewer/sheet navigation.

Editor lifecycle warmup and cycle 1 passed. Cycle 2 failed its expected socket
count assertion; this run does not retain enough failure-time socket detail to
classify the cause. Twenty cycles are not proven. The later eight-profile and
replacement-app authority cohorts were not reached. No uncaught page errors
were recorded, and owned process cleanup reports zero remaining groups.
This is disposable local Worker evidence, not production or real-provider proof.

The next [run 43560795530](https://github.com/vibegui/vibebook.dev/actions/runs/43560795530),
at head `9a10d09`, again passed the seven core phases. Its added socket diagnostics
observed two Book connections for the same room during lifecycle cycle 1, versus
the required one; personal and Yjs counts were each one. This establishes the
observed count mismatch, but does not yet distinguish failed application disposal
from a delayed transport close handshake. No timeout or lifecycle assertion is
relaxed. The root cause and a passing 20-cycle rerun remain required.

The later [run 43563524139](https://github.com/vibegui/vibebook.dev/actions/runs/43563524139)
at `743a4e0` explicitly completed server close acknowledgements and passed all
seven core phases plus **all twenty lifecycle cycles**, with all 66 observed
closes clean and completed within 27 ms. Its overall result remains failed:
all eight profile runs found Home `link-in-text-block` accessibility violations,
and the replacement-app probe was inconclusive during upload setup. Home palette
comparisons recorded zero mismatches; later Room/font/interaction checks still
need to pass. The inline Home link now has a persistent underline for the rerun.
Original reports and exact artifact identities are retained in
[the run 8 receipt](native-application-browser/2026-11-14-run8/README.md).
See [the socket analysis](socket-close-handshake.md) for the remaining heap and
observer limitations; passing socket/editor assertions are not a blanket
leak-free claim or production acceptance.

## Performance and deployment

The archived [controlled report](performance/2026-11-13/README.md) failed budgets
and predates the native root. Later native runs passed preflight, then
[run 43563593700](https://github.com/vibegui/vibebook.dev/actions/runs/43563593700)
completed both desktop warmups and seven alternating measured runs per variant.
Readiness, thread switch, first history load, initial JS/CSS bytes, font transfer
and post-GC heap all exceeded the agreed desktop budgets. The mobile cohort
stopped on a hidden room-switch control during its first warmup; its medians
remain unverified. Original safe samples and exact source/asset identities are
retained in [the partial native report](performance/2026-11-14-native-desktop-partial.md).
The mobile navigation fixture is corrected for a rerun. The declared workload,
seven measured runs per variant/device and original budgets remain unchanged;
there is no performance acceptance or approved amendment.

Cloudflare preview builds have failed without exposing the provider error in
GitHub output. The current vanilla main was reported deployed by Gui; this is
not proof of the final migration preview deployment. BugMachine's existing
Wrangler login has access to a different account from the project's configured
account, so it does not resolve the missing provider logs. Provider diagnostics
and successful final deployment remain required; an asset artifact is not an
online release.

## Final sign-off

Deployed commit, vanilla/Svelte URLs, final check identifiers, current schema/RPC
audit, Studio/profile/accessibility comparisons, performance samples, tested
rollback, maintainer and acceptance date are **pending**. No open condition is
waived by this report. The full goal remains active.

### Document-channel and deferred-view checkpoint (06b0a7e)

The sole PR now includes deferred native views, an owned serial bootstrap
watcher and document-bound Apps in both frontends. The expanded real Chromium
channel suite passed [43575694148](https://github.com/vibegui/vibebook.dev/actions/runs/43575694148),
including the installed stock SDK, second-origin replacement denial, held
outputs/consent, fresh reopening and permanently revoked subframe history.
[The retained receipt](app-document-browser/2026-11-14-adversarial/README.md)
explicitly excludes actual BFCache admission and application/provider acceptance.

The real Worker run [43575694166](https://github.com/vibegui/vibebook.dev/actions/runs/43575694166)
passes all seven functional phases and 20 lifecycle cycles with no page errors.
It does **not** pass overall: all eight Room profiles stop at delivered-avatar
contrast, and the authenticated room-App's initial read times out. Replacement
authorization is therefore inconclusive in the actual application at this head.
The standalone channel result does not clear this application gate. The contrast
fix and safer frame/navigation diagnostics require reruns.

Repository run [43575694145](https://github.com/vibegui/vibebook.dev/actions/runs/43575694145)
also fails source checks: a stale raw-iframe-src DOM assertion, a font diagnostic
inference error and an Ubuntu provider-test failure caused by another fixture
leaving global fetch mocked. These fixes and a pre-flush embed reopen regression
are being integrated. Committed native preview assets also require regeneration.
No performance, final feature matrix, deployment or migration completion is
claimed by these intermediate checks.
