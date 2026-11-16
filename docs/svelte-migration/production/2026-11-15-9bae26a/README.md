# Token-retirement checkpoint deployment

Main `9bae26acdbd06fb5886ea307ee8e2077de12f763` includes the verified runtime and
typed token-retirement maintenance. Both Cloudflare production builds succeeded.
[Commit checks](https://github.com/decocms/chat/commit/9bae26acdbd06fb5886ea307ee8e2077de12f763/checks)
also show successful Ubuntu/macOS repository, layout and complete native
application browser checks. The exact source checkpoint's security and HMR
receipts remain linked in the completion report.

Read-only anonymous GETs of `svelte-preview/app.js`, `svelte-preview/ui.css` and
`sw.js` returned HTTP 200 with exact tracked hashes. assets.json preserves the
check timestamp, byte counts and expected/actual hashes. This proves deployment
and those three asset bytes only. Authenticated production coexistence, login
continuation and rollback acceptance remain pending. Vanilla stays the default;
the performance experiments are not included in this deployed checkpoint.
