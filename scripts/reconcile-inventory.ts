import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { projectRoot } from "../svelte/build/clientBoundary";
import { inventoryOutput } from "./inventory-output";
import { reconcileInventory } from "./inventory-reconciliation";

/** Separate current input/output files; never rewrites frozen inventory/baseline records. */
export async function reconcileInventoryFiles(
  args: readonly string[],
  root = projectRoot,
) {
  const [inputFlag, input, ownerFlag, owners, outputFlag, file, ...extra] =
    args;
  if (
    inputFlag !== "--inventory" ||
    !input ||
    ownerFlag !== "--owners" ||
    !owners ||
    outputFlag !== "--out" ||
    !file ||
    extra.length
  )
    throw new Error(
      "Usage: bun scripts/reconcile-inventory.ts --inventory <current.json> --owners <owners.json> --out <reconciliation.json>",
    );
  const output = inventoryOutput(["--out", file], root);
  const result = reconcileInventory(
    JSON.parse(await readFile(resolve(root, input), "utf8")),
    JSON.parse(await readFile(resolve(root, owners), "utf8")),
  );
  await mkdir(dirname(output.file), { recursive: true });
  await writeFile(output.file, JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  return result.counts;
}

if (import.meta.main)
  console.log(await reconcileInventoryFiles(process.argv.slice(2)));
