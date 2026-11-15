# Typed token-runtime retirement follow-up

Prepared from main `3a73dff`, conditional on Gui's runtime patch `48f9d4c` being published or reviewed and integrated. This change deliberately does not edit his `src/mcpconn.ts` or `public/app.html`. Do not activate the narrowed runtime schema independently of the server patch: the old runtime could still project `auth: token` for a historical row.

Room #2638 and #2641 describe the patch: RPC uses only the viewer's OAuth `tokenFor`, removes pasted-secret unsealing and the legacy protocol argument, and public connections always report identity mode. The existing `retireTokens` clears old encrypted columns and notifies the owner once. That migration remains unchanged; no new cleanup, data deletion, secret decoding or credential forwarding is introduced here.

The coordinated authority decision is that residual `enc`/`iv` values are historical data, not current credential authority. Identity eligibility compares connection id, room, owner, scope and URL, with the existing fresh membership/private-connection checks before and after asynchronous work. It always looks up the current viewer's OAuth grant, including on a historical row. A grant selects `direct:false, why:signed_in`; otherwise a five-minute JWT identifies the **current viewer**, exact room and stored audience. It cannot reuse or promote the former owner's pasted credential. These changes are intentional identity-mode operation, not a claim that the background cleanup has already completed. Adding `401 sign_in` merely because columns remain would confuse migration state with OAuth and would not prevent the existing proxy setup fallback.

Public contracts no longer accept `Connection.auth: token` or `why: token`. Native Apps removes the impossible token branch and obsolete explanatory text while retaining normal sign-in controls and signed-in/CORS setup fallback. Direct session caching, operation cancellation, reader consent, private document ports and no-replay-after-dispatch behavior are unchanged.

Source regressions cover historical rows both with and without a viewer OAuth grant; OAuth lookup must occur even when encrypted columns remain. A cleanup update during signing no longer changes authority. The actual identity signer fixture checks current-viewer claims, stored audience, five-minute expiry and absence of credential properties; existing signature verification remains in the suite. Shared/runtime and inferred-type cases reject retired token modes. Historical stored-row validation/deletion, malformed credential-pair refusal and the existing migration/owner notification are retained.

No formatter, test, API declaration compiler, full typecheck, browser, push or deploy was run during preparation. Required combined gates after the runtime prerequisite: relevant RPC/MCP/direct protocol suites, inferred API/UI/backend/tooling checks, actual direct-MCP and OAuth/browser paths, and fresh built assets before publication. Previously passing checkpoint evidence is not relabeled as evidence for this patch.

## Exact local runtime handoff

Room #2644 supplied attachment `48193036af3b4b91` (`patch-48f9d4c.md`). Only its single literal diff fence was extracted as data. The format-patch header identifies `48f9d4c0f8b1bdbfbb9727807b93d07ad1cd1872`; path inspection and `git apply --check` allowed only `src/mcpconn.ts` and `public/app.html`. Literal patch SHA256: `7acd4bff9c83fe5ce2d2f9c436a1f0e4e78fa2ca360f236878994b1a5aab6e47`.

`git am` applied it atop `3a73dff` as `7d66937`, retaining Guilherme Rodrigues's author metadata and co-author trailer. The new committer differs, so this is not represented as the original commit hash. Both the original attachment and applied diff have stable patch ID `f31f5d1b340552bd6f1ff2bf0ed09b09d5074ac6`. Typed commits were then cherry-picked without conflicts as `1ea9759` and `4b03fa4`. This local combined tree does not authorize or claim publication/deployment of Gui's pending commit.

The additional actual `rpc`/`publicConn` fixture uses historical `enc`/`iv` getters that throw if accessed. Its controlled provider checks that no Authorization header is sent without a personal OAuth grant, that grant lookup is bound to the requester/resource, and that the real signer emits current-viewer/room/audience claims without credential fields. Its global fetch spy is restored in `finally`. This is a service/provider boundary fixture, not a live remote MCP or browser test. Combined execution receipts follow separately; no compiler, DOM or browser execution is implied.

Combined local execution on 2026-11-15, Bun 1.4.4, sequential isolated processes:

- `bun test scripts/rpc-routes.test.ts`: 40 pass, 371 assertions, 5.30s.
- `bun test scripts/mcp-connections.test.ts`: 12 pass, 141 assertions, 1.75s, including actual RPC/public projection with throwing historical-field getters.
- `bun test scripts/native-direct-mcp.test.ts`: 10 pass, 89 assertions, 2.82s, including actual SDK JSON/SSE/no-replay constraints and retired-mode schema rejection.

All three completed with zero failures (62 tests / 601 assertions). The newly added RPC fixture was Node-formatted; `git diff --check` passes. These are local boundary/protocol results only, not full strict typing, DOM, browser, asset freshness, publication or deployment acceptance. No production resources or credentials were accessed.
