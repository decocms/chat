# Opt-in checkpoint deployment

PR #1 merged as `3a73dffaf9fe3ff66045c08515a50714fc89060a`. Both Cloudflare production build checks (Worker and site) succeeded. [Commit checks](https://github.com/decocms/chat/commit/3a73dffaf9fe3ff66045c08515a50714fc89060a/checks) identify the builds. Read-only anonymous GETs of the Svelte entry, sole generated stylesheet and service worker returned HTTP 200 and exact verified-build hashes; assets.json retains timestamps, byte counts and hashes.

This proves deployment and those three asset bytes only. It does not prove authenticated coexistence, bidirectional live updates, login continuation or rollback. Gui's agent confirmed deployment/public responses in room #2638 but lacks Gui's authenticated browser session too; production functional acceptance remains pending. Vanilla remains the default; this checkpoint is not full-plan acceptance.
