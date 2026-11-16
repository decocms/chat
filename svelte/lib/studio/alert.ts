import { tv, type VariantProps } from "tailwind-variants";

export const alertVariants = tv(
  {
    base: "tw:relative tw:w-full tw:rounded-lg tw:border tw:border-border tw:px-4 tw:py-3 tw:text-sm tw:flex tw:items-start tw:gap-3 tw:[&>svg]:size-4 tw:[&>svg]:flex-shrink-0 tw:[&>svg]:mt-0.5 tw:[&>svg]:text-current",
    variants: {
      variant: {
        default: "tw:bg-card tw:text-card-foreground",
        destructive:
          "tw:bg-destructive/5 tw:text-destructive tw:border-destructive/25 tw:[&>svg]:text-current tw:*:data-[slot=alert-description]:text-destructive/90",
        warning:
          "tw:bg-warning/5 tw:text-warning tw:border-warning/25 tw:[&>svg]:text-current tw:*:data-[slot=alert-description]:text-warning/90",
        success:
          "tw:bg-success/5 tw:text-success tw:border-success/25 tw:[&>svg]:text-current tw:*:data-[slot=alert-description]:text-success/90",
        info: "tw:bg-card tw:text-card-foreground tw:border-border tw:[&>svg]:text-current tw:*:data-[slot=alert-description]:text-muted-foreground/90",
      },
    },
    defaultVariants: { variant: "default" },
  },
  { twMerge: false },
);

export type AlertVariants = VariantProps<typeof alertVariants>;
