# Anonymous production asset receipt: f28c297

Deployed main: `f28c297e233a7629db0b8afc59ad565dbf68b8ee`. Both Cloudflare builds succeeded ([commit checks](https://github.com/vibegui/vibebook.dev/commit/f28c297e233a7629db0b8afc59ad565dbf68b8ee/checks)). The exact [anonymous read-only receipt](assets.json), checked at `2026-11-15T07:43:51.473Z`, is retained byte-for-byte with its SHA256 and size in [provenance](provenance.json). No production requests or build/deploy actions were rerun for this documentation.

All three responses returned HTTP 200 and match the checked-in source bytes:

| Asset | Bytes | SHA256 |
| --- | ---: | --- |
| `svelte-preview/app.js` | 580 | `969d897c152c732443730efe6803aaf16e0d5f77da69f5894fd46899d944bbfe` |
| `svelte-preview/ui.css` | 65,297 | `bd9fcd9c7106c637edb907d35a3dc4e1c5c702d7fa3936ae538b9e7572a26fe1` |
| `sw.js` | 17,140 | `80559c131cecdc0371262a69cbb70a1c0b8823a578a072459036fa65b9d867b7` |

Main [repository](https://github.com/vibegui/vibebook.dev/actions/runs/43691086481), [design-system](https://github.com/vibegui/vibebook.dev/actions/runs/43691086476) and [application](https://github.com/vibegui/vibebook.dev/actions/runs/43691086479) workflows all completed successfully. The separate [joint run at the same exact source](../../managed-browser/2026-11-15-f28c297/README.md) also passed.

This proves these three anonymous asset bodies, not every lazy asset, authenticated application behavior, production binding/secret correctness, coexistence, rollback, physical devices, performance or final maintainer acceptance. Vanilla remains default and the Svelte application remains opt-in.
