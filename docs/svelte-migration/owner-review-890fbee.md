# Additive M0 owner source review at 890fbee

This is a **non-frozen, source-only** review of seven modules at exact source revision `890fbee856ce99b2acb72cb0a47d7ccae03956a5`. It is not a current-main scan, action verification, provider/hardware acceptance, performance acceptance or M0 completion. Later source changes require another exact-byte review.

The new combined [manifest](inventory-owners-890fbee.json) is based on [a47f0dc](inventory-owners-a47f0dc.json), SHA-256 `6bd4c73f084e7a9274263b16c4f5dc487f49a90a36d9002511e252d03f59bf75`. Its first 98 original owner objects and all 400 historical file/hash entries remain exactly unchanged from [c6112e8](inventory-owners-c6112e8.json), SHA-256 `6e707b2932f8b7bed2f9750aca71b0dae897561baf3c672e5386d3a086d743ee`. The six other a47 supplemental owners also remain unchanged. Only the changed supplemental `fireAudio.ts` and `r2FileResponse.ts` entries are refreshed, preserving their owner IDs; five new owner IDs cover the three new dictation/voice files, backend speech normalization and the UI variant switch. There are 111 owners and 413 uniquely owned files. Historical entries, including retired paths, are preserved records rather than assertions that their old bytes still match.

`reviews` remains empty. No exact per-candidate review keys are supplied by this module-level review, and ownership cannot manufacture action verification. Use the existing reconciler with this new manifest and a fresh separately captured inventory; changed historical hashes and unverified actions must remain pending. Neither earlier manifest nor any frozen inventory/reconciliation output is modified. The parent supplied a fresh clean 890fbee inventory reporting five unmapped files and 20 candidates; this amendment maps those five files but deliberately does not promote those candidates.

Every disposition below means **source reviewed at the stated bytes**. Complete module source, the listed wiring and specific test source were read. No test, compiler, browser, dependency installation or provider request was run for this review. Small Node JSON/hash assertions checked manifest assembly invariants, and a narrow Node formatter handled only these two new documentation artifacts; neither executes application behavior.

## svelte/features/composer/dictation.ts

- New owner: `amendment:890:ordinary-dictation` (F17).
- SHA-256: `141affbb329fe34f579f6ab63161b0aeb6e83ea137591fc6b24dfae6c95a6cfc`.
- Wiring read: `NativeComposer.svelte`, `speech.ts`, `fireAudio.ts` in the composer feature; `svelte/features/room-scope/controller.ts`.
- Test source traced: `scripts/native-fire.test.ts`, `scripts/dictation-audio.test.ts`, the ordinary media/refinement, empty capture-only Enter, recognition fallback and late-result cases in `scripts/ui-panels.test.ts`.

Read the complete optional recognition preview, bounded native recording, preview freeze and Whisper refinement owner. Generation and expected draft revision fence late permission, chunks, native stop and provider results; cancellation releases native resources. The permission/provider deadlines are 20 seconds and the native-stop watchdog is five seconds. `finish()` returns an owned text/revision snapshot after at most eight seconds total across stop and refinement; its timeout aborts refinement before returning the owned fallback. A missing native-stop confirmation cancels the intent without sending. Recognition-only completion freezes the local preview immediately.

The controller has no message-dispatch capability. NativeComposer serializes the waiting submission intent, displays loading, rechecks text/revision and captured room authority, and calls the existing draft sender. Its captured authority check precedes reads of outgoing reactive props; the unchanged connected-outgoing-control regression source in `scripts/native-home-dom.test.ts` was also inspected. Source fixtures cover edit/scope/dispose cancellation, no late overwrite, empty capture-only drafts, delayed stop within the eight-second budget, and preservation of normal typed submission. These source descriptions are not execution receipts.

## svelte/features/composer/voiceApi.ts

- New owner: `amendment:890:voice-api` (F17).
- SHA-256: `529537b2b15e81125a8c14258d4da6f8517ea1f7b50c3b4061016e9366eaaee0`.
- Wiring read: `svelte/features/room-scope/controller.ts`, `svelte/lib/client/api.ts`, `shared/schemas.ts`, `svelte/lib/client/api.typetest.ts`.
- Test source traced: the typed Whisper adapter fixture in `scripts/native-fire.test.ts`.

Read the inferred STT RPC call, binary content type, abort signal and no-store request, JSON failure normalization and `SttResult` validation. Validated 401/403 bodies classify session/membership failures; the room scope applies those outcomes only while its captured owner is current, and supplies a bounded room/member/epic prompt. The adapter has no Fire switch or automatic message endpoint. Fixtures describe rejection of HTML, wrong-shape and forbidden responses, and validated text forwarding. Server authorization, binary size enforcement and actual provider behavior remain separate responsibilities.

## svelte/features/composer/voiceTypes.ts

- New owner: `amendment:890:voice-port` (F17).
- SHA-256: `44ebf3ff9ee9463ce06fa108af570855236278d74070902b3349a56db436def9`.
- Wiring read: `svelte/features/composer/types.ts`, `NativeComposer.svelte`, `svelte/features/room-scope/controller.ts`.
- Test source traced: the same owner/actual-component transcription fixtures listed above.

Read the complete internal capability contract: transcription with abort signal, current-owner predicate and synchronous before-leave registration. Room scope supplies it and NativeComposer captures it; it is not a duplicated HTTP DTO or a runtime validator. This owner mapping does not establish that every call site has been exercised.

## svelte/features/composer/fireAudio.ts

- Refreshed supplemental owner: `amendment:a47:fire-audio` (F17, F41).
- Previous SHA-256: `20d186e395b78cc05cdf31680e8bb7f4c4c58ac10c3ee0cb05c463d9564d9392`.
- Reviewed SHA-256: `f887d431b1bc6c9ddf22ae675711c43d1085800e7502ad75bf45c1cb797bf0cc`.
- Wiring read: `NativeComposer.svelte`, `dictation.ts`.
- Test source traced: `scripts/dictation-audio.test.ts`, `scripts/native-fire.test.ts` and the ordinary media cases in `scripts/ui-panels.test.ts`.

Read the complete stream/recorder pool, epoch fencing, shared pending permission, per-capture callback ownership, optional level observers/resume, constructor failure cleanup and terminal factory release. The browser adapter detaches native callbacks before recorder disposal and emits one-second chunks. Ordinary dictation releases tracks before awaiting STT and does not request level sampling; retained optional level support does not imply that continuous Fire remains a product feature.

Direct adapter fixture source exercises shared stream/observer lifetime, rejected-permission retry, release during pending resume/permission, callback suppression after release and actual pool release before pending refinement. Those fixtures invoke the factory through injected native-effect ports. They are not direct execution of `browserFireCapture` against real microphone/codec hardware.

## src/r2FileResponse.ts

- Refreshed supplemental owner: `amendment:a47:r2-file-response` (F34, F35, F56).
- Previous SHA-256: `d13ef7f18bb48784754df4064fe365f611dc1abaa1292963178380ad04daf993`.
- Reviewed SHA-256: `39b493e5faaf010b6a253e08e7ecc642b23434f9d568b5834df3727c276e468a`.
- Wiring read: the authorized file GET in `src/index.ts`, `src/fileHeaders.ts`.
- Test source traced: complete `scripts/file-cache.test.ts`.

Read the complete public SDK Pick union, full/bodyless fallback, defined-value suffix selection, offset/length derivation and 206 response headers. The refreshed bytes distinguish an optional `suffix` property whose value is undefined from a selected suffix range. The route checks membership, delegates Range parsing/body selection to R2 and supplies private file/security headers before this helper constructs the response.

Fixture source uses the production helper through Hono for full, ignored-range, bodyless, suffix/oversized suffix, offset, bounded, length-only, byte-probe and HEAD responses, including the present-but-undefined suffix regression. It does not implement R2 request parsing or establish real Safari/cache behavior.

## src/speechToText.ts

- New owner: `amendment:890:speech-to-text` (F17, F56).
- SHA-256: `a2ba5c3123e389fc7de5a3c02a31fe241b3203d778ab623883823b0d42281ea7`.
- Wiring read: `src/api.ts`, `src/services.ts`, `src/requestBytes.ts`, `shared/schemas.ts`.
- Test source traced: the STT normalizer, bounded byte consumer and binary chunk/tail fixtures in `scripts/fire-authority.test.ts`; STT handler membership/rate/response and late-membership-loss fixtures in `scripts/rpc-routes.test.ts`.

Read the complete server-only helper: actual bounded bytes flow through requestBytes, errors normalize to SpeechAudioError, base64 encoding uses complete three-byte groups with bounded spread arguments, language/prompt hints are bounded and the untrusted Workers AI output is schema-checked before constructing SttResult. Services supplies the named Whisper model and actual AI callback. The typed route owns membership/rate gates and rechecks membership after awaited work; this helper itself is not authorization. Fixtures describe byte-exact base64 at chunk boundaries, absent/malformed/oversized provider text and oversized/empty streamed requests. No real Workers AI request or physical speech accuracy is established here.

## svelte/features/home/UiSwitch.svelte

- New owner: `amendment:890:ui-variant-switch` (F04, F07, F56).
- SHA-256: `5231c9a49593ae4a336cbb9edd4696b5dfc7e43240183806c630ac4cb9d8604c`.
- Wiring read: `HomePanel.svelte`, `svelte/features/onboarding/Onboarding.svelte`, `svelte/lib/ui/Switch.svelte`, `shared/uiVariant.ts`.
- Test source traced: the local-navigation-context/no-global-preference fixture in `scripts/ui-variant.test.ts`.

Read the complete controlled atomic switch, localized accessible label, destruction/connected-target guard and URL navigation. Both home and onboarding supply the language. The helper removes only the UI query selection for recognized same-origin application routes and preserves other query/hash context; the component writes no global preference. The inspected test exercises the actual URL helper, including encoded query data, hash and vanilla default. It does not execute this component's change event or establish browser navigation/accessibility acceptance.

## Separate reconciliation

Capture a fresh inventory and reconciliation under new explicit paths, with `--owners docs/svelte-migration/inventory-owners-890fbee.json`. This amendment supplies only finite module ownership/source-review context at 890fbee. It does not refresh the other historical source hashes, accept runtime candidates, waive failed performance budgets or complete M0.
