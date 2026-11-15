# Current inventory: deployed source 9bae26a

The original AST scanner and reconciler ran on a clean BugMachine checkout at `9bae26acdbd06fb5886ea307ee8e2077de12f763`. This documentation amendment starts at `dc2fa82`; all 412 scanned source hashes match that checkout. Commit ancestry alone is not the byte-match evidence: the captured `sourceHashes` were checked against every local source file.

The scan contains 2,085 function, 179 network, 94 endpoint, zero type-escape, 403 DOM and 121 style candidates: 2,882 candidate keys. The original reconciliation has 1,477 matching module hashes, 1,381 changed module hashes and 24 unknown keys, with zero source-reviewed or action-verified records. The gzip files preserve exact original bytes; [provenance.json](provenance.json) records both original and stored SHA256/size. Earlier frozen inventories and owner manifests remain unchanged.

The [amended manifest](../inventory-owners-9bae26a.json) preserves all 111 historical owner objects and adds six file owners. Three files account for the 24 unknown keys; the other three have no named candidates but still need explicit ownership. [Finite source reviews](../owner-review-9bae26a.md) link 52 exact candidate keys to source rationale and relevant existing regression source. No test was executed for this amendment, and no action is promoted to verified.

An amended run of the **original** reconciler is pending. Expected counts are 1,501 module-mapped, 1,381 module-changed, zero unknown, 52 source-reviewed, zero action-verified and 2,830 action-pending. These are expectations, not a retained execution receipt. Preserve the before-output and write a new after-output:

```sh
bun scripts/reconcile-inventory.ts --inventory /path/to/exact/current.json --owners docs/svelte-migration/inventory-owners-9bae26a.json --out /new/path/reconciliation-after.json
```

[review-queue.json](review-queue.json) records six new sources and 22 changed sources relative to the 890fbee capture. Candidate identity churn is 1,128 added keys and 1,086 removed keys; source locations and hashes affect keys, so these numbers do not count added or removed product features. The 1,381 changed candidates need renewed source review. The remaining action queue must connect actual behavior, error states and lifecycle coverage, rather than reuse module-level ownership as acceptance.

M0/F56 remain open. This finite amendment does not certify language/theme/mobile parity, provider or hardware behavior, performance budgets, deployment, or production acceptance. Zero type-escape candidates is a scanner result, not proof of every runtime boundary.
