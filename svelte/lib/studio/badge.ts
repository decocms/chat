import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `badge.tsx`: a status, a count or a tag. Entities (a goal, an app) are `Chip`s, not badges. */
const NEUTRAL = "bg-muted text-foreground [a&]:hover:bg-secondary-hover";

export const badgeVariants = tv(
  {
    base: "inline-flex items-center justify-center rounded-full text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 transition-[color,background-color] overflow-hidden [button&]:cursor-pointer [button&]:disabled:cursor-not-allowed",
    variants: {
      variant: {
        default: NEUTRAL,
        neutral: NEUTRAL,
        secondary: NEUTRAL,
        success: "bg-success/10 text-success [a&]:hover:bg-success/15",
        warning: "bg-warning/10 text-warning [a&]:hover:bg-warning/15",
        destructive:
          "bg-destructive/10 text-destructive [a&]:hover:bg-destructive/15",
        agent:
          "bg-brand-purple-tint text-brand-purple-dark dark:bg-brand-purple/20 dark:text-brand-purple",
        lime: "bg-brand-lime-tint text-brand-green-dark dark:bg-brand/20 dark:text-brand",
        info: "bg-brand-blue-tint text-brand-blue-dark dark:bg-brand-blue/20 dark:text-brand-blue",
        outline:
          "bg-card shadow-edge text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        muted: "bg-muted text-muted-foreground [a&]:hover:bg-secondary-hover",
        brand:
          "bg-brand/30 text-foreground [a&]:hover:bg-brand/40 [button&]:hover:bg-brand/40",
      },
      size: {
        sm: "h-4 gap-1 px-1.5 text-[0.6875rem]",
        default: "h-5 px-2",
        lg: "h-6 px-2.5 text-sm [&>svg]:size-3.5",
        control: "h-7 gap-1.5 pr-3 pl-1.5",
        icon: "size-5",
        segmented: "h-7 gap-0 rounded-lg bg-card p-0 shadow-edge",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
