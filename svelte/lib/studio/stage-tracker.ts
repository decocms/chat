import { tv } from "tailwind-variants";

export type StageState = "done" | "current" | "upcoming";

export const stageVariants = tv(
  {
    base: "tw:inline-flex tw:h-[1.625rem] tw:shrink-0 tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2 tw:text-xs tw:font-medium tw:whitespace-nowrap",
    variants: {
      state: {
        done: "tw:bg-card tw:shadow-edge tw:text-muted-foreground",
        current: "tw:bg-brand-lime-tint tw:text-brand-green-dark",
        upcoming: "tw:bg-card tw:shadow-edge tw:text-subtle-foreground",
      },
    },
  },
  { twMerge: false },
);

export const stageNumberVariants = tv(
  {
    base: "tw:tabular-nums tw:flex tw:size-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-medium tw:transition-colors",
    variants: {
      state: {
        done: "tw:bg-primary tw:text-primary-foreground",
        current: "tw:bg-brand-lime-tint tw:text-brand-green-dark",
        upcoming: "tw:bg-muted tw:text-muted-foreground",
      },
    },
  },
  { twMerge: false },
);

export function stageStateAt(index: number, current: number): StageState {
  return index < current ? "done" : index === current ? "current" : "upcoming";
}
