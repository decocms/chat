import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `chip.tsx`: `sm` leads with a 12px icon and reads as meta; `lg` is the app launcher pill, leading with a 26px tile. */
export const chipVariants = tv(
  {
    base: "tw:bg-card tw:shadow-edge tw:inline-flex tw:w-fit tw:shrink-0 tw:items-center tw:whitespace-nowrap tw:rounded-full tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[a&]:hover:bg-accent tw:[button&]:hover:bg-accent tw:transition-colors tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:[button&]:cursor-pointer tw:[button&]:disabled:cursor-not-allowed",
    variants: {
      size: {
        sm: "tw:text-muted-foreground tw:h-6 tw:gap-1.5 tw:px-2 tw:text-xs tw:[&>svg]:size-3",
        lg: "tw:text-foreground tw:h-9 tw:gap-2 tw:px-3.5 tw:py-1 tw:text-sm tw:font-medium tw:[&>svg]:size-4 tw:has-[>[data-slot=project-icon]]:pl-1 tw:has-[>img]:pl-1",
      },
    },
    defaultVariants: { size: "sm" },
  },
  { twMerge: false },
);

export type ChipVariants = VariantProps<typeof chipVariants>;
