import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** The scales the Studio theme adds to Tailwind's own, so conflicting classes still resolve to the last one. */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["2xs"],
      radius: ["button", "control", "surface", "4xl"],
      shadow: [
        "edge",
        "edge-raised",
        "edge-destructive",
        "edge-warning",
        "edge-success",
        "soft",
        "lift",
        "border",
        "hairline",
        "glass",
        "glass-panel",
      ],
    },
  },
});

export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
