# Migration inventory and ownership

Published baseline: `d3e1473`; full-plan starting commit: `9579bc4`. The generated `inventory.json` is produced by `bun scripts/migration-inventory.ts`. It records source locations and candidates, not a clean-code or style-policy certification.

Initial scan: 64 source files, 708 named functions/arrow bindings, 70 network/typed-transport/message call candidates, 80 static router declarations, 56 explicit-any/suppression candidates, 238 DOM operations and 104 style candidates. Counts change as implementation moves; the baseline commit and protected-asset hashes stay frozen in `baseline.json`.

## Runtime and source boundaries

- Default vanilla: `public/app.html`, preserved Inbox source in `vanilla/inbox/`, existing Inbox bundle `public/svelte/ui.js`, editor `public/collab.js`, manifest and service worker. No preview source import is permitted in the vanilla UI build.
- Current Svelte preview: `svelte/bootstrap.ts` mounts `features/application/NativeApplication.svelte`, which directly composes AppShell and RoomShell. ApplicationServices, RootRoomSession, RoomScope and RoomLayout own their typed responsibilities. The legacy host, production mount registry and `public/app-svelte.css` are removed; the editor is a lazy Vite module under `features/documents/`. The sole authored CSS entry is `svelte/styles/tailwind.css`.
- Shared: JSON schema/contracts, UI-selection helpers and protocol types. No server implementation belongs in a browser module graph.
- Backend: Hono routes, Book/DocRoom/Person, persistence and domain services. `src/auth.ts`, `src/sandbox.ts` and `src/mcpconn.ts` contain additional mounted routes beyond the main Worker file. Router/auth/binary/agent/external protocol declarations require classification in the RPC coverage matrix.
- Third-party: CodeMirror/Yjs, headless UI behavior, rich-content parser/sanitizer and external app/terminal protocols. Dependencies do not excuse first-party custom CSS or unsafe casts.

## Major extractions

| Existing responsibility | Native destination | Boundary evidence |
| --- | --- | --- |
| `EN`, `t`, language and theme helpers | typed locale/theme modules | no legacy host import, locale/theme component tests |
| route/history/hash, home/room switcher and cache | native root/router/navigation | Back/reload/deep-link/room lifecycle tests |
| HTTP helper and many direct fetches | inferred application RPC client | operation matrix plus request/response type tests |
| WebSocket reducers/connection callbacks | owned typed room session | reducer/late callback/reconnect regressions retained |
| composer, emoji, upload and replies | native composer and chat feature modules | typing/draft/send/error/upload behavior |
| raw header/sidebar/document/mobile controls | native shell + atomic primitives | keyboard/viewport and state-retention tests |
| editor, iframe/app and terminal DOM ownership | small typed vendor/protocol adapters | disposal, permission and origin checks |
| legacy CSS strings/styles and palette | one Tailwind source + Studio tokens | source/artifact audit and visual comparisons |
| sandbox/MCP/account/agent controls | native feature components + inferred service clients | full parity rows F39–F48 |
| push/install/device lock | native feature services/components | current vanilla parity and permission states |

## Known gaps and audit limits

Native push/install UI and its typed service owners are now composed directly. Final production/platform checks remain required. Static route scanning includes HTML, auth, assets, development-only and external protocol surfaces, not just JSON RPC; loops/mounted groups must also be reviewed. Message-channel calls are inventoried alongside transport candidates and need classification. Style matches in sanitized/user-content strings may be legitimate data, but application styling cannot be hidden inside them. Explicit-any candidates include backend modules outside the UI protocol; every remaining candidate needs a scope/interop rationale before M1 closes.

Historical inventory capture at clean source `b247805` contains 339 sources and no first-party JavaScript in the scanned backend/shared/preview/editor/vanilla source roots. It identifies 31 explicit-any candidates, all in backend modules; these still require individual scope/interop classification. The 65 style candidates include independent server/vanilla HTML, user-content examples and vendor adapters; the successful full preview style audit covers 287 preview/editor sources and its emitted CSS/font integrity. Neither candidate counts nor passing typing alone certify every M1/M2 condition.

A frozen Studio workspace reference and controlled 5,000-message benchmark evidence are committed. Historical hybrid/partial-app measurements remain labeled as such. Final native-root theme/accessibility, integrated browser, performance and deployment acceptance are still pending.

## Vanilla separation proof

`check:vanilla` checks the preserved TypeScript/Svelte sources and builds the default Inbox into a temporary directory. `vanilla-build.json` records the module graph and protected-asset fingerprints. The build includes `vanilla/inbox/Inbox.svelte` and its entry only, with no project-owned `svelte/` modules; default assets are not rewritten. The variant-boundary plugin rejects cross-implementation runtime imports in either direction, including aliases and symlinks.

## Current captured source: 890fbee

The [clean 890fbee snapshot and exact provenance](inventory-current-2026-11-15-890fbee/README.md)
cover 406 files: 2,049 function candidates, 177 network calls, 93 endpoint
 declarations, zero explicit-any/suppression candidates, 400 DOM operations and
121 style candidates. The explicit-any scan does not enumerate every type
assertion or prove every external boundary; preserved vanilla/server HTML and
vendor integration require their recorded classifications.

The [new combined owner manifest](inventory-owners-890fbee.json) and
[seven-module source review](owner-review-890fbee.md) preserve the original 98
owner objects and 400 frozen hashes. Five newly inventoried files now have
owners, and two supplemental entries have current reviewed bytes. Reconciliation
has zero unmapped candidates: 1,500 entries match their owner hashes and 1,340
have changed since those historical reviews. All 2,840 entries still await
per-action verification; no action was promoted merely because a module or test
file exists. M0 and F56 remain open. This snapshot predates main 6697819's
subsequent document-feature integration.
