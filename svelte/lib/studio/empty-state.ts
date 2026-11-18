import { tv, type VariantProps } from "tailwind-variants";

export const emptyStateVariants = tv(
  {
    base: "flex flex-col items-center justify-center gap-4 text-center",
    variants: {
      size: {
        /** The whole view is empty. */
        page: "py-16",
        /** A list or chart inside a card or panel. */
        inline: "py-8",
      },
    },
    defaultVariants: { size: "page" },
  },
  { twMerge: false },
);

export const emptyStateIconVariants = tv(
  {
    base: "flex size-10 items-center justify-center rounded-xl [&_svg]:size-5 [&_svg]:stroke-[1.33]",
    variants: {
      tone: {
        default: "bg-muted text-muted-foreground",
        error: "bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { tone: "default" },
  },
  { twMerge: false },
);

export type EmptyStateVariants = VariantProps<typeof emptyStateVariants> &
  VariantProps<typeof emptyStateIconVariants>;
