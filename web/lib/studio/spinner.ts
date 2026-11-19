import { tv, type VariantProps } from "tailwind-variants";

/** Ported from @decocms/ui `spinner.tsx`. Studio slows a spinner under reduced motion instead of stopping it, since it carries information. */
export const spinnerVariants = tv(
  {
    base: "animate-spin shrink-0 motion-reduce:[animation-duration:1.5s]! motion-reduce:[animation-iteration-count:infinite]!",
    variants: {
      size: {
        "2xs": "size-3",
        xs: "size-4",
        sm: "size-6",
        default: "size-7",
        lg: "size-8",
        icon: "size-6",
      },
    },
    defaultVariants: { size: "default" },
  },
  { twMerge: false },
);

export type SpinnerVariants = VariantProps<typeof spinnerVariants>;
