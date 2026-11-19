import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `input.tsx`. Red with `aria-invalid`, green with `data-valid`. */
export const inputVariants = tv(
  {
    base: [
      "text-foreground placeholder:text-subtle-foreground selection:bg-primary selection:text-primary-foreground flex w-full min-w-0 text-sm pointer-coarse:text-[16px] transition-[color,background-color,box-shadow] outline-none",
      "file:text-foreground file:inline-flex file:h-7 file:border-border file:border-0 file:bg-transparent file:text-sm file:font-medium",
      "disabled:pointer-events-none disabled:cursor-not-allowed disabled:text-subtle-foreground disabled:placeholder:text-subtle-foreground",
      "read-only:text-muted-foreground",
      "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2",
      "aria-invalid:bg-destructive/10 aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)]",
      "data-valid:bg-success/10 data-valid:shadow-[inset_0_0_0_1px_var(--vb-success)]",
      "rounded-[var(--vb-studio-control-radius,0.625rem)] bg-[var(--vb-studio-input-background)] shadow-edge hover:bg-sidebar read-only:bg-sidebar",
    ],
    variants: {
      size: {
        default: "h-[var(--vb-studio-control-height,2.25rem)] px-3 py-1",
        sm: "h-8 px-3 py-1",
      },
    },
    defaultVariants: { size: "default" },
  },
  { twMerge: false },
);

export type InputVariants = VariantProps<typeof inputVariants>;
