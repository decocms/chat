# F56 exact-candidate reconciliation tooling — source snapshot c6112e8

Status: **pending, not F56 or M0 acceptance**. This follow-up supplies reviewable ownership data and a separate exact-candidate ledger pipeline. It does not generate the final current inventory, replace either frozen record, verify every action, or certify provider/runtime/deployment behavior.

## What is retained

[inventory-owners-c6112e8.json](inventory-owners-c6112e8.json) records explicit source-file hashes and 98 ownership groups at source `c6112e8`. Four hundred source paths are attributed to a native feature/tooling owner, backend purpose, browser-safe shared contract, generated source, or maintained vanilla A/B rationale. The authored group descriptions, feature IDs, wiring references and relevant test filenames are module ownership context, **not a claim that every function or route in those modules was independently behaviorally verified**. `reviews` is deliberately empty.

The manifest uses explicit files/hashes, not wildcard acceptance of future modules. A new source file remains unknown; changed source bytes retain the proposed owner but require refresh. At `c6112e8`, `svelte/legacy/host.d.ts` contained only `export {}` and stale transitional comments, with no source import or JavaScript implementation found. It is unmapped in this historical owner snapshot and was [removed in a separate bounded follow-up](retired-host-declaration.md); a later inventory should no longer contain it. This is not evidence of a running legacy host or missing native feature. Unmapped source files remain explicit in `unmappedSources`, even when they contain no function/action candidates.

Root's subsequent `6febd25` source includes `svelte/features/rich-text/markdownSource.ts`, which is absent from this `c6112e8` snapshot. Its known native rich-text/document projection purpose does not silently add it to the old owner manifest: it remains `unknown-pending` until an exact-byte owner review is recorded. Later Fire, AppFrame or default-App protocol edits similarly require a changed-source review; no pending peer/HMR source is preaccepted here.

The [pure reconciliation model](../../scripts/inventory-reconciliation.ts) emits **one entry per supplied inventory candidate** across functions, network calls, route candidates, type-escape candidates, DOM candidates, style candidates, and authored-JavaScript file candidates. Each entry retains the original candidate, category, exact file, source hash, candidate identity hash and duplicate occurrence number. Duplicated candidates are preserved rather than silently deduplicated. Unrecognized future candidate arrays, missing source identities and conflicting owner assignments fail explicitly.

Every entry distinguishes:

- `module-mapped`: source bytes match an attributed module in this snapshot; actions remain pending by default.
- `module-changed-pending`: an attributed file has different source bytes and needs review refresh.
- `unknown-pending`: no explicit source owner is assigned.
- `pending` / `source-reviewed` / `action-verified`: a separate action-review dimension. Explicit action records require the exact candidate key, matching source hash and nonempty evidence. Stale/unmatched reviews are retained for inspection and never promoted. Even a source review does not count as action verification.

The report always retains `f56Status: pending`. A module mapping, a candidate count, or an action record supplied by an author cannot automatically grant full-plan acceptance. `source-reviewed` entries remain in `actionPending`. Runtime/provider/manual proof must be inspected at its own exact revision and scope.

## Run only after parent commits the final source

Root owns the final source snapshot, actual generation, remote verification and byte-hash guard. From the committed clean source, first use the safe separate inventory command, then consume that exact file:

```sh
inventory_revision=$(git rev-parse --short=12 HEAD)
bun scripts/migration-inventory.ts --out "docs/svelte-migration/inventory-current-${inventory_revision}.json"
bun scripts/reconcile-inventory.ts \
  --inventory "docs/svelte-migration/inventory-current-${inventory_revision}.json" \
  --owners docs/svelte-migration/inventory-owners-c6112e8.json \
  --out "docs/svelte-migration/inventory-reconciliation-${inventory_revision}.json"
```

Both outputs are separate, exclusively created files. Existing explicit output paths and frozen `inventory.json` / `baseline.json` targets are refused. Keep/compare historical hashes before and after. Do not overwrite historical artifacts to turn this old owner snapshot into apparent final-head evidence. An input with `workingTreeDirty: true` stays visibly dirty in the report; it is not a final clean-source receipt. Root should inspect that each original candidate appears exactly once per occurrence, then review changed/unknown sources and per-action evidence.

The reconciliation input's revision/fingerprint and the ownership snapshot revision are retained separately. A final inventory generated after additional ports may correctly contain many `module-changed-pending` or `unknown-pending` entries. Refresh those owner/action records deliberately against the new bytes; do not hide the mismatch by merely editing the revision label.

## Concrete inventory scope correction

The earlier current scanner omitted `public/app.html`, where maintained current-main Fire, live-card/file, inline App and mobile actions reside. The current generator now reads it alongside `public/app-svelte.html`, with the original global file/line offsets for executable inline scripts. External `src` scripts and non-JavaScript JSON/import-map payloads are excluded from AST parsing. Quoted attribute delimiters and `data-src` metadata do not become false script boundaries. The whole HTML document is never fed to the JavaScript parser. Default vanilla presentation/string-rendering candidates remain attributed to the preserved default, not granted as native styling exceptions.

The Hono scanner still yields syntactic route candidates; mounts/base paths, dynamic strings, external protocols and cross-file factories need the [API coverage matrix](api-coverage.md) and actual route review. This ledger retains each route's method/path/location identity and backend module purpose, but does not manufacture inferred mount prefixes or authorization proof.

## Explicit remaining limitations

- `typeEscapes` currently enumerates `AnyKeyword` and suppression candidates, not all `as` / angle-bracket / double assertions. Zero entries cannot establish the M1 assertion-removal condition. For example, `src/fire.ts` contains an `ArrayBuffer` assertion outside that scan; no unsafe JSON cast is claimed merely from its presence.
- Source/function ownership does not establish all current-main behavior parity. Fire focus/provider intelligence and nested App/File rendering are still being integrated/verified by their active owners. This snapshot audit found no additional concrete frontend hole beyond those tracked ports; it did not rerun all routes/actions or their hardware/provider cases.
- The generator's candidate scan is not a complete import graph or source-function proof. Generated-asset tooling, protocol/native binary boundaries and narrow vendor interop need their explicit mapped scope. The source-owner snapshot and prior F01–F56 map are review inputs, not final per-action evidence.
- Every matrix row still needs final revision-specific state/error/permission/reload/remote-update references, and final browser/manual/provider/deployment/rollback/maintainer acceptance. Existing performance failures and original limits remain unchanged.

## Bounded verification and registration

Run the small fixture checks with `bun test scripts/inventory-reconciliation.test.ts scripts/inventory-sections.test.ts`; they use synthetic data and never scan the current repository or write either frozen record. Existing generator/scanner tests remain relevant. Add the new model/CLI/tests to tooling/format registration when integrating. No full compiler, browser, final inventory or production source change is part of this author check.
