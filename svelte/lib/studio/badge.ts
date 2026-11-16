import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `badge.tsx`: a status, a count or a tag. Entities (a goal, an app) are `Chip`s, not badges. */
const NEUTRAL =
  "tw:bg-muted tw:text-foreground tw:[a&]:hover:bg-secondary-hover";

export const badgeVariants = tv(
  {
    base: "tw:inline-flex tw:items-center tw:justify-center tw:rounded-full tw:text-xs tw:font-medium tw:w-fit tw:whitespace-nowrap tw:shrink-0 tw:[&>svg]:size-3 tw:gap-1.5 tw:[&>svg]:pointer-events-none tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:transition-[color,background-color] tw:overflow-hidden tw:[button&]:cursor-pointer tw:[button&]:disabled:cursor-not-allowed",
    variants: {
      variant: {
        default: NEUTRAL,
        neutral: NEUTRAL,
        secondary: NEUTRAL,
        success: "tw:bg-success/10 tw:text-success tw:[a&]:hover:bg-success/15",
        warning: "tw:bg-warning/10 tw:text-warning tw:[a&]:hover:bg-warning/15",
        destructive:
          "tw:bg-destructive/10 tw:text-destructive tw:[a&]:hover:bg-destructive/15",
        agent:
          "tw:bg-brand-purple-tint tw:text-brand-purple-dark tw:dark:bg-brand-purple/20 tw:dark:text-brand-purple",
        lime: "tw:bg-brand-lime-tint tw:text-brand-green-dark tw:dark:bg-brand/20 tw:dark:text-brand",
        info: "tw:bg-brand-blue-tint tw:text-brand-blue-dark tw:dark:bg-brand-blue/20 tw:dark:text-brand-blue",
        outline:
          "tw:bg-card tw:shadow-edge tw:text-foreground tw:[a&]:hover:bg-accent tw:[a&]:hover:text-accent-foreground",
        muted:
          "tw:bg-muted tw:text-muted-foreground tw:[a&]:hover:bg-secondary-hover",
        brand:
          "tw:bg-brand/30 tw:text-foreground tw:[a&]:hover:bg-brand/40 tw:[button&]:hover:bg-brand/40",
      },
      size: {
        sm: "tw:h-4 tw:gap-1 tw:px-1.5 tw:text-[0.6875rem]",
        default: "tw:h-5 tw:px-2",
        lg: "tw:h-6 tw:px-2.5 tw:text-sm tw:[&>svg]:size-3.5",
        control: "tw:h-7 tw:gap-1.5 tw:pr-3 tw:pl-1.5",
        icon: "tw:size-5",
        segmented:
          "tw:h-7 tw:gap-0 tw:rounded-lg tw:bg-card tw:p-0 tw:shadow-edge",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
