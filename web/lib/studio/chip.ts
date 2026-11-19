import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `chip.tsx`: `sm` leads with a 12px icon and reads as meta; `lg` is the app launcher pill, leading with a 26px tile. */
export const chipVariants = tv(
  {
    base: "bg-card shadow-edge inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full [&_svg]:pointer-events-none [&_svg]:shrink-0 [a&]:hover:bg-accent [button&]:hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 [button&]:cursor-pointer [button&]:disabled:cursor-not-allowed",
    variants: {
      size: {
        sm: "text-muted-foreground h-6 gap-1.5 px-2 text-xs [&>svg]:size-3",
        lg: "text-foreground h-9 gap-2 px-3.5 py-1 text-sm font-medium [&>svg]:size-4 has-[>[data-slot=project-icon]]:pl-1 has-[>img]:pl-1",
      },
    },
    defaultVariants: { size: "sm" },
  },
  { twMerge: false },
);

export type ChipVariants = VariantProps<typeof chipVariants>;
