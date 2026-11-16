import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `input.tsx`. Red with `aria-invalid`, green with `data-valid`. */
export const inputVariants = tv(
  {
    base: [
      "tw:text-foreground tw:placeholder:text-subtle-foreground tw:selection:bg-primary tw:selection:text-primary-foreground tw:flex tw:w-full tw:min-w-0 tw:text-sm tw:transition-[color,background-color,box-shadow] tw:outline-none",
      "tw:file:text-foreground tw:file:inline-flex tw:file:h-7 tw:file:border-border tw:file:border-0 tw:file:bg-transparent tw:file:text-sm tw:file:font-medium",
      "tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed tw:disabled:text-subtle-foreground tw:disabled:placeholder:text-subtle-foreground",
      "tw:read-only:text-muted-foreground",
      "tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2",
      "tw:aria-invalid:bg-destructive/10 tw:aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)]",
      "tw:data-valid:bg-success/10 tw:data-valid:shadow-[inset_0_0_0_1px_var(--vb-success)]",
      "tw:rounded-[var(--vb-studio-control-radius,0.625rem)] tw:bg-[var(--vb-studio-input-background)] tw:shadow-edge tw:hover:bg-sidebar tw:read-only:bg-sidebar",
    ],
    variants: {
      size: {
        default:
          "tw:h-[var(--vb-studio-control-height,2.25rem)] tw:px-3 tw:py-1",
        sm: "tw:h-8 tw:px-3 tw:py-1",
      },
    },
    defaultVariants: { size: "default" },
  },
  { twMerge: false },
);

export type InputVariants = VariantProps<typeof inputVariants>;
