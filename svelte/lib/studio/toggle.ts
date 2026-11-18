import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `toggle.tsx`. `segmented` is one option of a `ToggleGroup variant="segmented"`. */
export const toggleVariants = tv(
  {
    base: "inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-muted data-[state=on]:hover:bg-secondary-hover data-[state=on]:text-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 outline-none transition-[color,background-color,box-shadow] whitespace-nowrap cursor-pointer disabled:cursor-not-allowed",
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "bg-card shadow-edge hover:bg-accent hover:text-accent-foreground",
        segmented:
          "text-muted-foreground hover:bg-transparent hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-[0_1px_2px_0_#0000000d] dark:data-[state=on]:bg-accent",
      },
      size: {
        default: "h-8 px-3 min-w-8",
        sm: "h-7 px-2.5 min-w-7",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type ToggleVariants = VariantProps<typeof toggleVariants>;
