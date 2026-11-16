import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `toggle.tsx`. `segmented` is one option of a `ToggleGroup variant="segmented"`. */
export const toggleVariants = tv(
  {
    base: "tw:inline-flex tw:items-center tw:justify-center tw:gap-2 tw:rounded-full tw:text-sm tw:font-medium tw:hover:bg-accent tw:hover:text-foreground tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:data-[state=on]:bg-muted tw:data-[state=on]:hover:bg-secondary-hover tw:data-[state=on]:text-foreground tw:[&_svg]:pointer-events-none tw:[&_svg:not([class*='size-'])]:size-4 tw:[&_svg]:shrink-0 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:outline-none tw:transition-[color,background-color,box-shadow] tw:whitespace-nowrap tw:cursor-pointer tw:disabled:cursor-not-allowed",
    variants: {
      variant: {
        default: "tw:bg-transparent",
        outline:
          "tw:bg-card tw:shadow-edge tw:hover:bg-accent tw:hover:text-accent-foreground",
        segmented:
          "tw:text-muted-foreground tw:hover:bg-transparent tw:hover:text-foreground tw:data-[state=on]:bg-background tw:data-[state=on]:text-foreground tw:data-[state=on]:shadow-[0_1px_2px_0_#0000000d] tw:dark:data-[state=on]:bg-accent",
      },
      size: {
        default: "tw:h-8 tw:px-3 tw:min-w-8",
        sm: "tw:h-7 tw:px-2.5 tw:min-w-7",
        lg: "tw:h-10 tw:px-2.5 tw:min-w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type ToggleVariants = VariantProps<typeof toggleVariants>;
