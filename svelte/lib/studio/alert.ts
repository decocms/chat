import { tv, type VariantProps } from "tailwind-variants";

export const alertVariants = tv(
  {
    base: "relative w-full rounded-lg border border-border px-4 py-3 text-sm flex items-start gap-3 [&>svg]:size-4 [&>svg]:flex-shrink-0 [&>svg]:mt-0.5 [&>svg]:text-current",
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "bg-destructive/5 text-destructive border-destructive/25 [&>svg]:text-current *:data-[slot=alert-description]:text-destructive/90",
        warning:
          "bg-warning/5 text-warning border-warning/25 [&>svg]:text-current *:data-[slot=alert-description]:text-warning/90",
        success:
          "bg-success/5 text-success border-success/25 [&>svg]:text-current *:data-[slot=alert-description]:text-success/90",
        info: "bg-card text-card-foreground border-border [&>svg]:text-current *:data-[slot=alert-description]:text-muted-foreground/90",
      },
    },
    defaultVariants: { variant: "default" },
  },
  { twMerge: false },
);

export type AlertVariants = VariantProps<typeof alertVariants>;
