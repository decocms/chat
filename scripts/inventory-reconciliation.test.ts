import { expect, test } from "bun:test";
import { reconcileInventory } from "./inventory-reconciliation";

const hash = "a".repeat(64),
  changed = "b".repeat(64);
function inventory() {
  return {
    sourceRevision: "current-revision",
    workingTreeDirty: false,
    sourceFingerprint: "fingerprint",
    sourceHashes: [
      { file: "svelte/example.ts", sha256: hash },
      { file: "vanilla/example.js", sha256: hash },
    ],
    functions: [{ file: "svelte/example.ts", line: 3, name: "open", lines: 4 }],
    network: [
      {
        file: "svelte/example.ts",
        line: 8,
        callee: "api.$post",
        method: "POST",
        target: "input",
        kind: "inferred-rpc",
      },
    ],
    endpoints: [
      {
        file: "svelte/example.ts",
        line: 9,
        method: "POST",
        path: '"/example"',
      },
    ],
    typeEscapes: [
      { file: "svelte/example.ts", line: 10, kind: "interop candidate" },
    ],
    dom: [
      { file: "svelte/example.ts", line: 11, operation: "addEventListener" },
    ],
    styles: [{ file: "svelte/example.ts", line: 12, kind: "style candidate" }],
    firstPartyJavaScript: ["vanilla/example.js"],
  };
}
function ownership() {
  return {
    schemaVersion: 1,
    sourceRevision: "owner-snapshot",
    owners: [
      {
        id: "native-example",
        disposition: "native-feature",
        purpose: "Native example owner",
        features: ["F56"],
        wiring: ["root/example"],
        checks: ["example.test.ts"],
        files: { "svelte/example.ts": hash },
      },
    ],
    reviews: [],
  };
}

test("enumerates every category, preserves exact identities/metadata and leaves action proof pending", () => {
  const result = reconcileInventory(inventory(), ownership());
  expect(result.entries).toHaveLength(7);
  expect(result.counts).toMatchObject({
    moduleMapped: 6,
    unknown: 1,
    actionVerified: 0,
    actionPending: 7,
  });
  expect(result.entries[1].candidate).toMatchObject({
    callee: "api.$post",
    kind: "inferred-rpc",
    method: "POST",
  });
  expect(result.entries.at(-1)).toMatchObject({
    file: "vanilla/example.js",
    moduleStatus: "unknown-pending",
    owner: null,
  });
  expect(result.f56Status).toBe("pending");
});
test("duplicate raw candidates retain unique occurrence identities instead of disappearing", () => {
  const input = inventory();
  input.functions.push({ ...input.functions[0] });
  const result = reconcileInventory(input, ownership());
  expect(result.entries).toHaveLength(8);
  expect(result.entries[0].key).not.toBe(result.entries[1].key);
  expect(result.entries[1].occurrence).toBe(1);
});
test("changed and newly introduced modules remain explicitly pending", () => {
  const input = inventory();
  input.sourceHashes[0].sha256 = changed;
  const result = reconcileInventory(input, ownership());
  expect(result.counts.moduleChanged).toBe(6);
  expect(result.entries[0].moduleStatus).toBe("module-changed-pending");
  expect(result.counts.unknown).toBe(1);
});
test("per-action proof requires the exact candidate key, source hash and evidence", () => {
  const input = inventory(),
    manifest = ownership();
  const first = reconcileInventory(input, manifest).entries[0];
  const reviews = [
    {
      key: first.key,
      sourceRevision: input.sourceRevision,
      sourceHash: hash,
      status: "action-verified",
      evidence: ["exact-revision/runtime-receipt.json"],
    },
  ];
  expect(
    reconcileInventory(input, { ...manifest, reviews }).entries[0].actionStatus,
  ).toBe("action-verified");
  expect(
    reconcileInventory(input, {
      ...manifest,
      reviews: [{ ...reviews[0], status: "source-reviewed" }],
    }).counts.actionPending,
  ).toBe(7);
  input.sourceHashes[0].sha256 = changed;
  const stale = reconcileInventory(input, { ...manifest, reviews });
  expect(stale.entries[0].actionStatus).toBe("pending");
  expect(stale.entries[0].staleReview).not.toBeNull();
  expect(stale.f56Status).toBe("pending");
  input.sourceHashes[0].sha256 = hash;
  input.sourceRevision = "new-dependency-revision";
  const differentRevision = reconcileInventory(input, { ...manifest, reviews });
  expect(differentRevision.entries[0].actionStatus).toBe("pending");
  expect(differentRevision.entries[0].staleReview).not.toBeNull();
});
test("unrecognized categories, missing source identities and ambiguous owner rules are rejected", () => {
  expect(() =>
    reconcileInventory({ ...inventory(), futureCandidates: [] }, ownership()),
  ).toThrow("Unrecognized inventory array");
  expect(() =>
    reconcileInventory({ ...inventory(), sourceHashes: [] }, ownership()),
  ).toThrow("no source hash");
  const manifest = ownership();
  expect(() =>
    reconcileInventory(inventory(), {
      ...manifest,
      owners: [...manifest.owners, manifest.owners[0]],
    }),
  ).toThrow("Ambiguous ownership");
});
