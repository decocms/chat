import { tv, type VariantProps } from "tailwind-variants";

/** Ported from @decocms/ui `spinner.tsx`. Studio slows a spinner under reduced motion instead of stopping it, since it carries information. */
export const spinnerVariants = tv(
  {
    base: "tw:animate-spin tw:shrink-0 tw:motion-reduce:[animation-duration:1.5s]! tw:motion-reduce:[animation-iteration-count:infinite]!",
    variants: {
      size: {
        "2xs": "tw:size-3",
        xs: "tw:size-4",
        sm: "tw:size-6",
        default: "tw:size-7",
        lg: "tw:size-8",
        icon: "tw:size-6",
      },
    },
    defaultVariants: { size: "default" },
  },
  { twMerge: false },
);

export type SpinnerVariants = VariantProps<typeof spinnerVariants>;
