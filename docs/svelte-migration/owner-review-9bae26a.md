# Finite source reviews at 9bae26a

These 52 records review exact source bytes at `9bae26acdbd06fb5886ea307ee8e2077de12f763`. The documentation checkout starts at `dc2fa82`; all 412 scanned source hashes match that checkout. The manifest contains full candidate keys and source hashes. Each row is **source-reviewed**, not action-verified. Test links identify existing, relevant regression source; this documentation task executed no tests, scanner, compiler or browser. Existing runtime receipts are not promoted automatically to these keys.

The 111 historical owner objects remain unchanged. Six added owners cover three new candidate-bearing modules and three zero-candidate modules: `directTypes.ts` defines internal transport contracts; `DeferredDocumentCard.svelte` owns the bounded lazy component lifecycle; `DocumentCard.svelte` composes the existing read-only card presentation and fallback. Zero named candidates does not mean these components have no callbacks or responsibilities.

<a id="url-variant"></a>

## shared/uiVariant.ts

Existing regression sources: [scripts/ui-variant.test.ts](../../scripts/ui-variant.test.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `uiVariant` (4) | Resolves only the explicit UI query choice; no account-wide preference mutation. |
| functions: `uiShellPath` (10) | Selects the maintained shell path without changing API routing. |
| functions: `uiNavigationUrl` (15) | Preserves query/hash for known same-origin application navigation; external/API destinations remain distinct. |

<a id="connection-identity"></a>

## src/connectionIdentity.ts

Existing regression sources: [scripts/rpc-routes.test.ts](../../scripts/rpc-routes.test.ts), [scripts/mcp-connections.test.ts](../../scripts/mcp-connections.test.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `sameAuthority` (26) | Compares stored connection identity, owner, scope and URL; retired encrypted fields confer no authority. |
| functions: `connectionIdentity` (34) | Returns only schema-valid viewer-scoped identity or signed-in fallback; no credential unseal/export. |
| functions: `read` (39) | Reads the current owned snapshot; backend identity reads additionally recheck caller membership after connection lookup. |
| functions: `inspect` (58) | Always consults the requesting person’s OAuth state, preserving server-mode fallback. |

<a id="apps-authority"></a>

## svelte/features/apps/authority.ts

Existing regression sources: [scripts/native-apps.test.ts](../../scripts/native-apps.test.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `createAppsAuthority` (3) | Owns one irreversible denial latch per Book connection and notifies captured listeners. |
| functions: `appMembershipFailure` (35) | Recognizes the scoped membership-denial contract rather than treating every remote 403 as membership loss. |
| functions: `appSessionFailure` (42) | Recognizes global session loss without mistaking remote sign-in failures for logout. |

<a id="apps-direct"></a>

## svelte/features/apps/direct.ts

Existing regression sources: [scripts/native-direct-mcp.test.ts](../../scripts/native-direct-mcp.test.ts), [scripts/native-direct-mcp-browser.ts](../../scripts/native-direct-mcp-browser.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `ownedAwait` (28) | Settles the owned wait on abort and removes the listener after completion. |
| functions: `cleanup` (30) | Removes only this wait’s abort listener. |
| functions: `abort` (31) | Rejects this owned wait without changing another request’s signal. |
| functions: `createDirectMcp` (52) | Owns direct/proxy mode and SDK sessions within the existing RoomScope. |
| functions: `owns` (74) | Requires the captured generation/connection authority before accepting delivery. |
| functions: `check` (80) | Rejects stale or aborted work before dispatch or after awaited setup. |
| functions: `resetSession` (83) | Closes the prior SDK session before replacement. |
| functions: `close` (91) | Closes the captured transport without automatic replay through the Worker. |
| functions: `mode` (99) | Projects the mode for the current canonical connection. |
| functions: `stateValue` (110) | Publishes mode state without exporting identity credentials. |
| functions: `signature` (111) | Detects relevant canonical connection changes for invalidation. |
| functions: `invalidate` (112) | Retires the affected connection’s cached setup/session. |
| functions: `dispose` (122) | Permanently revokes this owner and releases retained resources. |
| functions: `ensure` (131) | Lazily obtains identity and SDK setup with conservative request-start expiry and ownership checks. |
| functions: `proxy` (280) | Uses the existing server path only for designated setup/server-mode cases, never replaying an already dispatched tool call. |
| dom: `addEventListener` (35) | AbortSignal addEventListener owns cancellation cleanup; this scanner category does not imply application DOM rendering. |

<a id="apps-direct-sdk"></a>

## svelte/features/apps/directSdk.ts

Existing regression sources: [scripts/native-direct-mcp.test.ts](../../scripts/native-direct-mcp.test.ts), [scripts/native-direct-mcp-browser.ts](../../scripts/native-direct-mcp-browser.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `connectDirectSdk` (18) | Creates the installed SDK client with constrained URL/method/headers, omitted credentials and refused redirects. |
| functions: `current` (28) | Checks the captured connection/session owner before continuing SDK work. |
| functions: `check` (29) | Rejects stale or aborted work before dispatch or after awaited setup. |
| functions: `dispose` (159) | Permanently revokes this owner and releases retained resources. |

<a id="chat-privacy"></a>

## svelte/features/chat/privacy.ts

Existing regression sources: [scripts/native-chat.test.ts](../../scripts/native-chat.test.ts), [scripts/native-apps.test.ts](../../scripts/native-apps.test.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `permissionAsk` (3) | Identifies permission questions from the canonical message shape. |
| functions: `messageById` (7) | Searches canonical messages and origins for permission-parent lookup. |
| functions: `privateAskForOther` (10) | Suppresses another reader’s private question without modifying canonical state. |
| functions: `permissionReply` (14) | Resolves replies through the canonical parent before applying visibility. |
| functions: `visibleMessage` (19) | Applies the same private question/reply and historical live-mode filtering to a single message. |
| functions: `visibleChatMessages` (29) | Projects only visible messages while leaving the source room unchanged. |

<a id="chat-time"></a>

## svelte/features/chat/time.ts

Existing regression sources: [scripts/native-chat.test.ts](../../scripts/native-chat.test.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `resetChatTime` (5) | Releases both locale formatter caches on identity/language lifecycle reset. |
| functions: `chatTime` (9) | Caches the locale-specific short-time formatter while retaining invalid-date fallback. |
| functions: `chatDateTime` (23) | Caches the full timestamp formatter separately from short-time display. |

<a id="rich-file-index"></a>

## svelte/features/rich-text/roomFiles.ts

Existing regression sources: [scripts/rich-file-index.test.ts](../../scripts/rich-file-index.test.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `collectRoomFiles` (5) | Collects canonical file metadata first, then message/origin references with ID deduplication. |
| functions: `roomFileFingerprint` (13) | Fingerprints the actual metadata used by rich-file projection, including versions. |
| functions: `sameScope` (34) | Compares the immutable account/room/root/navigation ownership tuple. |
| functions: `createRichFileIndex` (43) | Caches within one authorized scope and refuses partial or stale canonical-reference reuse. |
| functions: `clear` (58) | Drops retained projection references without inventing replacement canonical data. |
| functions: `dispose` (62) | Permanently revokes this owner and releases retained resources. |

<a id="root-room-session"></a>

## svelte/features/root-room/session.ts

Existing regression sources: [scripts/root-room-session.test.ts](../../scripts/root-room-session.test.ts). These references are source associations, not a claim that each helper has a standalone behavioral test.

| Candidate and scanned line | Source review disposition |
| --- | --- |
| functions: `createRootRoomSession` (26) | Owns canonical room reduction, bounded cache and connection-generation lifecycle. |
| functions: `blank` (37) | Builds the empty public snapshot rather than retaining the departing private room. |
| functions: `read` (52) | Reads the current owned snapshot; backend identity reads additionally recheck caller membership after connection lookup. |
| functions: `owns` (53) | Requires the captured generation/connection authority before accepting delivery. |
| functions: `leave` (55) | Revokes the captured connection and clears room publication before invoking teardown callbacks. |
| functions: `terminal` (61) | Publishes terminal access state only after synchronous owner revocation. |
| functions: `receive` (77) | Reduces canonical delivery with current-owner checks and denial veto before cache/publication. |

## Remaining closure work

The amendment does not refresh the 1,381 candidates whose historical module hashes changed. Their owners remain explicit but their source review needs renewal. All action verification remains open, including screen states, English/Portuguese, light/dark, keyboard/mobile, asynchronous failure and disposal behavior. External providers, physical devices, fonts/performance and production deployment require their own evidence. M0/F56 remain open. Endpoint operation/auth/error classification is maintained separately in [API coverage](api-coverage.md).
