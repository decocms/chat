import { tv, type VariantProps } from "tailwind-variants";

export const cardVariants = tv(
  {
    base: "bg-card text-card-foreground rounded-surface shadow-edge flex flex-col gap-4",
    variants: {
      size: {
        /** A section on a page: settings, a tab's panel. */
        default: "p-5",
        /** One thing in a grid: a project, a connection, an app. */
        tile: "gap-3 p-4",
        /** Edge-to-edge rows or media; the children bring their own padding. */
        flush: "p-0",
      },
      /** Opens something: tints on hover and takes the focus ring. */
      interactive: {
        true: "transition-[background-color] duration-[160ms] ease-[var(--vb-ease-out-cubic)] hover:bg-[color-mix(in_oklch,var(--vb-card),var(--vb-foreground)_3%)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 cursor-pointer text-left",
        false: "",
      },
    },
    defaultVariants: { size: "default", interactive: false },
  },
  { twMerge: false },
);

export type CardVariants = VariantProps<typeof cardVariants>;
