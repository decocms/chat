import { tv, type VariantProps } from "tailwind-variants";

export const emptyStateVariants = tv(
  {
    base: "tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-4 tw:text-center",
    variants: {
      size: {
        /** The whole view is empty. */
        page: "tw:py-16",
        /** A list or chart inside a card or panel. */
        inline: "tw:py-8",
      },
    },
    defaultVariants: { size: "page" },
  },
  { twMerge: false },
);

export const emptyStateIconVariants = tv(
  {
    base: "tw:flex tw:size-10 tw:items-center tw:justify-center tw:rounded-xl tw:[&_svg]:size-5 tw:[&_svg]:stroke-[1.33]",
    variants: {
      tone: {
        default: "tw:bg-muted tw:text-muted-foreground",
        error: "tw:bg-destructive/10 tw:text-destructive",
      },
    },
    defaultVariants: { tone: "default" },
  },
  { twMerge: false },
);

export type EmptyStateVariants = VariantProps<typeof emptyStateVariants> &
  VariantProps<typeof emptyStateIconVariants>;
