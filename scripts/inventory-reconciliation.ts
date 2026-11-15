import { createHash } from "node:crypto";
import * as z from "zod/mini";

const located = { file: z.string(), line: z.number() };
const candidates = {
  functions: z.array(
    z.looseObject({ ...located, name: z.string(), lines: z.number() }),
  ),
  network: z.array(
    z.looseObject({
      ...located,
      callee: z.string(),
      target: z.string(),
      method: z.string(),
    }),
  ),
  endpoints: z.array(
    z.looseObject({ ...located, method: z.string(), path: z.string() }),
  ),
  typeEscapes: z.array(z.looseObject({ ...located, kind: z.string() })),
  dom: z.array(z.looseObject({ ...located, operation: z.string() })),
  styles: z.array(z.looseObject({ ...located, kind: z.string() })),
};
const inventorySchema = z.looseObject({
  sourceRevision: z.string(),
  workingTreeDirty: z.boolean(),
  sourceFingerprint: z.string(),
  sourceHashes: z.array(z.object({ file: z.string(), sha256: z.string() })),
  firstPartyJavaScript: z.array(z.string()),
  ...candidates,
});
const reviewSchema = z.object({
  key: z.string(),
  sourceRevision: z.string(),
  sourceHash: z.string(),
  status: z.enum(["source-reviewed", "action-verified"]),
  evidence: z.array(z.string()),
});
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  sourceRevision: z.string(),
  owners: z.array(
    z.object({
      id: z.string(),
      disposition: z.enum([
        "native-feature",
        "native-tooling",
        "backend-service",
        "shared-contract",
        "preserved-vanilla",
        "generated-artifact",
      ]),
      purpose: z.string(),
      features: z.array(z.string()),
      wiring: z.array(z.string()),
      checks: z.array(z.string()),
      files: z.record(z.string(), z.string()),
    }),
  ),
  reviews: z.array(reviewSchema),
});
type Owner = z.infer<typeof manifestSchema>["owners"][number];
type RawCandidate =
  z.infer<typeof inventorySchema>[keyof typeof candidates][number] | string;
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Enumerate every supplied candidate; ownership is not per-action verification. No source scan or writes. */
export function reconcileInventory(input: unknown, ownership: unknown) {
  const inventory = inventorySchema.parse(input),
    manifest = manifestSchema.parse(ownership);
  const allowedArrays = new Set([
    "sourceHashes",
    "firstPartyJavaScript",
    ...Object.keys(candidates),
  ]);
  for (const [field, value] of Object.entries(inventory))
    if (Array.isArray(value) && !allowedArrays.has(field))
      throw new Error(
        `Unrecognized inventory array ${field}; extend reconciliation explicitly`,
      );
  const owners = new Map<string, Owner>();
  for (const owner of manifest.owners)
    for (const file of Object.keys(owner.files)) {
      if (owners.has(file)) throw new Error(`Ambiguous ownership for ${file}`);
      owners.set(file, owner);
    }
  const hashes = new Map<string, string>();
  for (const source of inventory.sourceHashes) {
    if (hashes.has(source.file))
      throw new Error(`Duplicate source hash for ${source.file}`);
    hashes.set(source.file, source.sha256);
  }
  const reviews = new Map<string, z.infer<typeof reviewSchema>>();
  for (const review of manifest.reviews) {
    if (!review.evidence.length)
      throw new Error(`Review ${review.key} has no evidence`);
    if (reviews.has(review.key))
      throw new Error(`Duplicate candidate review ${review.key}`);
    reviews.set(review.key, review);
  }
  const occurrences = new Map<string, number>();
  const enumerate = (category: string, candidate: RawCandidate) => {
    const file = typeof candidate === "string" ? candidate : candidate.file;
    if (
      typeof candidate !== "string" &&
      (!Number.isInteger(candidate.line) || candidate.line < 1)
    )
      throw new Error(`Invalid candidate location for ${file}`);
    const sourceHash = hashes.get(file);
    if (!sourceHash) throw new Error(`Candidate ${file} has no source hash`);
    const signature = `${category}:${file}:${digest(JSON.stringify(candidate))}`;
    const occurrence = occurrences.get(signature) ?? 0;
    occurrences.set(signature, occurrence + 1);
    const key = `${signature}:${occurrence}`;
    const owner = owners.get(file),
      review = reviews.get(key);
    const moduleStatus = !owner
      ? "unknown-pending"
      : owner.files[file] === sourceHash
        ? "module-mapped"
        : "module-changed-pending";
    const currentReview =
      review?.sourceHash === sourceHash &&
      review.sourceRevision === inventory.sourceRevision;
    const actionStatus = currentReview ? review.status : "pending";
    reviews.delete(key);
    return {
      key,
      category,
      file,
      sourceHash,
      occurrence,
      candidate,
      moduleStatus,
      owner: owner
        ? {
            id: owner.id,
            disposition: owner.disposition,
            purpose: owner.purpose,
            features: owner.features,
            wiring: owner.wiring,
            checks: owner.checks,
          }
        : null,
      actionStatus,
      evidence: actionStatus === "pending" ? [] : (review?.evidence ?? []),
      staleReview: review && !currentReview ? review : null,
      pendingReason: !owner
        ? "Assign and review this exact source owner"
        : moduleStatus === "module-changed-pending"
          ? "Owner snapshot predates these source bytes; refresh its review"
          : actionStatus === "pending"
            ? "Module ownership alone does not verify this action/route/interop candidate"
            : null,
    };
  };
  const entries = [
    ...Object.keys(candidates).flatMap((category) =>
      inventory[category as keyof typeof candidates].map((candidate) =>
        enumerate(category, candidate),
      ),
    ),
    ...inventory.firstPartyJavaScript.map((candidate) =>
      enumerate("firstPartyJavaScript", candidate),
    ),
  ];
  return {
    schemaVersion: 1,
    f56Status: "pending",
    inventoryRevision: inventory.sourceRevision,
    inventoryFingerprint: inventory.sourceFingerprint,
    inventoryWorkingTreeDirty: inventory.workingTreeDirty,
    ownerSnapshotRevision: manifest.sourceRevision,
    note: "Exact supplied-candidate enumeration, not a final source scan or F56/runtime/provider/M0 acceptance. Evidence must be reviewed at its stated source bytes.",
    counts: {
      entries: entries.length,
      moduleMapped: entries.filter(
        (entry) => entry.moduleStatus === "module-mapped",
      ).length,
      moduleChanged: entries.filter(
        (entry) => entry.moduleStatus === "module-changed-pending",
      ).length,
      unknown: entries.filter(
        (entry) => entry.moduleStatus === "unknown-pending",
      ).length,
      actionVerified: entries.filter(
        (entry) => entry.actionStatus === "action-verified",
      ).length,
      sourceReviewed: entries.filter(
        (entry) => entry.actionStatus === "source-reviewed",
      ).length,
      actionPending: entries.filter(
        (entry) => entry.actionStatus !== "action-verified",
      ).length,
    },
    unmatchedReviews: [...reviews.values()],
    unmappedSources: inventory.sourceHashes.filter(
      (source) => !owners.has(source.file),
    ),
    entries,
  };
}
