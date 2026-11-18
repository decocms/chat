import { expect, test } from "bun:test";
import { buttonVariants } from "../svelte/lib/studio/button";
import { cn } from "../svelte/lib/studio/utils";

test("namespaced variants merge semantic radius, colors and size overrides", () => {
  const classes = cn(
    buttonVariants({ variant: "outline" }),
    "rounded-md h-11 bg-secondary",
  ).split(" ");
  expect(classes).toContain("rounded-md");
  expect(classes).not.toContain("rounded-[var(--vb-studio-button-radius)]");
  expect(classes).toContain("h-11");
  expect(classes).not.toContain("h-8");
  expect(classes).toContain("bg-secondary");
  expect(classes).not.toContain("bg-card");
  expect(cn("shadow-edge", "shadow-soft")).toBe("shadow-soft");
  expect(cn("rounded-control", "rounded-surface")).toBe("rounded-surface");
  expect(cn("text-sm", "text-2xs")).toBe("text-2xs");
});
