# Current source inventory at 890fbee

Exact source: `890fbee856ce99b2acb72cb0a47d7ccae03956a5`. Captured in a clean detached checkout on BugMachine using the committed scanner, then reconciled with the existing CLI. Node 22.23.5 and Bun 1.4.4; no source/build files were changed. The original frozen inventory, baseline and owner records retain their recorded SHA-256 hashes.

The scan covers **406 files**: 2049 function candidates, 177 network calls, 93 endpoint declarations, zero explicit-any/suppression candidates, 400 DOM operations and 121 style candidates. A zero explicit-any count does not mean every assertion or boundary is validated. Preserved vanilla and server HTML are included in the relevant counts.

Before the finite owner amendment: 1470 candidate entries mapped to matching module bytes, 1350 had changed bytes, 20 were unmapped. After: **1500 matching, 1340 changed, zero unmapped**. All **2840 candidate entries remain pending in this registry**; action-verified and per-candidate source-reviewed record counts are both zero. Independent unit/browser evidence is retained separately and is not negated by this missing per-key linkage. Module ownership and seven module-level source reviews do not manufacture execution evidence. Historical owner hashes are preserved, so changed historical modules correctly remain pending.

The original inventory and before/after reconciliation JSON are retained under gzip, with exact original/stored sizes and SHA-256 in provenance.json. The [combined owner manifest](../inventory-owners-890fbee.json) and [finite source review](../owner-review-890fbee.md) explain the five new owners and two refreshed supplemental entries. This snapshot predates main 6697819 document integration and cannot verify its later source.

Reproduce from source 890fbee into **new** output paths:

```sh
bun scripts/migration-inventory.ts --out /path/to/new-inventory.json
bun scripts/reconcile-inventory.ts --inventory /path/to/new-inventory.json --owners /path/to/inventory-owners-890fbee.json --out /path/to/new-reconciliation.json
```

The owner manifest is additive documentation assembled after the scanned source; supply that exact file explicitly. The CLI refuses existing explicit outputs and the frozen inventory/baseline destinations. This is traceability evidence, not M0, F56 or full-migration acceptance.
