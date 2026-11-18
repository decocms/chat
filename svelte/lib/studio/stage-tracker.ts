import { tv } from "tailwind-variants";

export type StageState = "done" | "current" | "upcoming";

export const stageVariants = tv(
  {
    base: "inline-flex h-[1.625rem] shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap",
    variants: {
      state: {
        done: "bg-card shadow-edge text-muted-foreground",
        current: "bg-brand-lime-tint text-brand-green-dark",
        upcoming: "bg-card shadow-edge text-subtle-foreground",
      },
    },
  },
  { twMerge: false },
);

export const stageNumberVariants = tv(
  {
    base: "tabular-nums flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
    variants: {
      state: {
        done: "bg-primary text-primary-foreground",
        current: "bg-brand-lime-tint text-brand-green-dark",
        upcoming: "bg-muted text-muted-foreground",
      },
    },
  },
  { twMerge: false },
);

export function stageStateAt(index: number, current: number): StageState {
  return index < current ? "done" : index === current ? "current" : "upcoming";
}
