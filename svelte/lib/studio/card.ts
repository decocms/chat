import { tv, type VariantProps } from "tailwind-variants";

export const cardVariants = tv(
  {
    base: "tw:bg-card tw:text-card-foreground tw:rounded-surface tw:shadow-edge tw:flex tw:flex-col tw:gap-4",
    variants: {
      size: {
        /** A section on a page: settings, a tab's panel. */
        default: "tw:p-5",
        /** One thing in a grid: a project, a connection, an app. */
        tile: "tw:gap-3 tw:p-4",
        /** Edge-to-edge rows or media; the children bring their own padding. */
        flush: "tw:p-0",
      },
      /** Opens something: tints on hover and takes the focus ring. */
      interactive: {
        true: "tw:transition-[background-color] tw:duration-[160ms] tw:ease-[var(--vb-ease-out-cubic)] tw:hover:bg-[color-mix(in_oklch,var(--vb-card),var(--vb-foreground)_3%)] tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:cursor-pointer tw:text-left",
        false: "",
      },
    },
    defaultVariants: { size: "default", interactive: false },
  },
  { twMerge: false },
);

export type CardVariants = VariantProps<typeof cardVariants>;
