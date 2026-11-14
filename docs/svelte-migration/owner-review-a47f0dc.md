# Additive M0 owner source review at a47f0dc

This is a **non-frozen, source-only** review of eight modules at source revision `a47f0dc6b947fb0a6d4c8c2b48a20a9089fdd162`. It is not a current-main scan, runtime action approval, F56 acceptance or M0 completion. Later byte changes, including the ongoing continuous Fire port, require another review.

The combined [manifest](inventory-owners-a47f0dc.json) uses the existing schema/CLI. Its first 98 owner objects and all 400 historical file/hash entries are unchanged from [c6112e8](inventory-owners-c6112e8.json), whose SHA-256 is `6e707b2932f8b7bed2f9750aca71b0dae897561baf3c672e5386d3a086d743ee`. Only eight new owner IDs/files are appended. Assembly revision is not a re-review of the historical entries. No historical hash is refreshed. `reviews` remains empty: per-candidate keys need a fresh exact inventory; ownership and this module-level source review cannot manufacture action verification.

The earlier private 366450e14a64 inventory/reconciliation was inspected for format/context: only markdownSource from this cohort existed there, unmapped. Those files are not rewritten. Current reconciliation will still mark changed historical modules pending and keeps all unverified actions pending. No reconciler/CLI extension is needed; pass the new manifest through the existing `--owners` option after capturing a fresh inventory to a new private path.

Every disposition below is **source-reviewed at the stated bytes**. Test names/source wiring were inspected; this review runs no test/compiler/browser and does not turn fixture descriptions into execution receipts.

## svelte/features/rich-text/markdownSource.ts

- Owner: `amendment:a47:markdown-source` (F29, F31, F48).
- SHA-256: `e510bbf13374e986e0d5a78ae5383726cf640781b3c87b0beac509194537f848`.
- Wiring read: `svelte/features/rich-text/markdownTree.ts`, `svelte/features/rich-text/project.ts`, `svelte/features/documents/preview.ts`.
- Test source traced: `scripts/native-documents.test.ts`, `scripts/rich-text.test.ts`.

Read complete tokenizer/remaining-input mapping, exact raw-slice comparison, nested quote/list offset verification and depth/token limits. Traced tests: skipped Markdown definitions, exact legal paragraph spans, CRLF/lone-CR and nested quote/loose-list rewrites. This does not grant raw HTML execution.

## src/requestBytes.ts

- Owner: `amendment:a47:request-bytes` (F17, F32, F56).
- SHA-256: `47460ad4470ea1903221441172e80cc4d2da15f74783d15d9690fe31443df262`.
- Wiring read: `src/api.ts`, `src/speechToText.ts`.
- Test source traced: `scripts/rpc-routes.test.ts`, `scripts/fire-authority.test.ts`.

Read maximum validation, actual-chunk authority, pre-copy overflow refusal, empty input and finally cancellation/release. Traced actual-handler tests: chunked/falsely-small headers stop before a third chunk, oversized headers avoid reading, and STT chunk overflow cancels. Publication authorization is owned by API/services/Book, not this helper.

## src/connectionRows.ts

- Owner: `amendment:a47:connection-rows` (F46, F47, F56).
- SHA-256: `3a62ab75b6db7e648aaa615d523ce0e4ab3e02774a2f664a9960e7f62bec9966`.
- Wiring read: `src/mcpconn.ts`, `shared/schemas.ts`.
- Test source traced: `scripts/mcp-connections.test.ts`, `scripts/rpc-routes.test.ts`.

Read required original identity/scope and HTTP(S) URL guard, credential-pair consistency, nullable historical creation time, title fallback to actual host and cache normalization. Separate deletion identity omits unrelated scope/display/URL fields. Traced actual SQLite listing/get/delete isolation, private-peer and owner-negative fixtures.

## src/providerMetadata.ts

- Owner: `amendment:a47:provider-metadata` (F05, F56).
- SHA-256: `e01ab2eab61e9f5722d5d64795a4dfee691273610cd2908416fd0587c03c7488`.
- Wiring read: `src/start-room.ts`, `src/route-home.ts`, `src/router.ts`, `src/sandbox.ts`, `src/book.ts`.
- Test source traced: `scripts/provider-metadata.test.ts`.

Read record-only usage/raw traversal, finite numeric/string charge conversion, zero/refund preservation and non-Error message narrowing. Traced actual startRoom, routeMessage, router.gate and checkFreestyleKey fixtures, including a coercion trap. This is not billing/provider intelligence acceptance.

## src/r2FileResponse.ts

- Owner: `amendment:a47:r2-file-response` (F34, F35, F56).
- SHA-256: `d13ef7f18bb48784754df4064fe365f611dc1abaa1292963178380ad04daf993`.
- Wiring read: `src/index.ts`, `src/fileHeaders.ts`.
- Test source traced: `scripts/file-cache.test.ts`.

Read SDK Pick types and suffix discriminator, unchanged full/bodyless fallback and offset/length/206 headers. Traced production-helper/Hono full, ignored-range, metadata-only, suffix/oversized suffix, offset, bounded, length-only, Safari byte-probe and full/ranged HEAD fixtures. R2 input parsing and real Safari are not simulated by these fixtures.

## svelte/features/chat/time.ts

- Owner: `amendment:a47:chat-time` (F11, F15).
- SHA-256: `3ca983ce38d2d1b6897c968057e869d09a61fa6cd7b57b88f9441242bd06cc37`.
- Wiring read: `svelte/features/room-scope/controller.ts`, `svelte/features/room-scope/browser.ts`.
- Test source traced: `scripts/native-chat.test.ts`.

Read one-entry-per-format caches and invalid-date handling; traced both room bridge assignments and visibility/focus reset registration/disposal. Tests compare time/full-date behavior across locales, epoch and date boundaries. No synthetic OS timezone-change execution receipt is asserted.

## svelte/features/chat/production.ts

- Owner: `amendment:a47:production-status` (F15, F25, F49).
- SHA-256: `548a983c74f12b4021e885a049f6469574bcfd9eb8692a15269ff00307e86ab1`.
- Wiring read: `svelte/Chat.svelte`.
- Test source traced: `scripts/native-chat.test.ts`, `scripts/ui-panels.test.ts`.

Read canonical-message-first deduplication, reader/epic timestamp comparison and archived/verified/live semantics. Chat derives the cue without mutating production records. Traced model tests for later human messages, deploy catch-up, archive behavior and origin precedence plus actual endcard DOM source.

## svelte/features/composer/fireAudio.ts

- Owner: `amendment:a47:fire-audio` (F17, F41).
- SHA-256: `20d186e395b78cc05cdf31680e8bb7f4c4c58ac10c3ee0cb05c463d9564d9392`.
- Wiring read: `svelte/features/composer/NativeComposer.svelte`, `svelte/features/composer/fire.ts`.
- Test source traced: `scripts/native-fire.test.ts`, `scripts/ui-panels.test.ts`.

Read capability check, constructor-failure track cleanup, one-second chunks, late-callback ownership and dispose ordering. NativeComposer captures this factory and Fire controller owns permission/session/utterance leases. Tests use injected capture doubles for late permission, deadline and stop-pending suspension; they do NOT directly invoke browserFireCapture. Real microphone/codec behavior remains pending.

## Safe next reconciliation

Use a fresh explicit `--inventory` and `--out` path; the existing output guard refuses frozen outputs and writes with `wx`. Supply `--owners docs/svelte-migration/inventory-owners-a47f0dc.json`. Do not rewrite the frozen baseline or infer reviewed/action status from mapping counts. The next inventory revision and any changed source hashes are authoritative; this amendment deliberately contains no invented candidate reviews.
