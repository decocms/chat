import { tv, type VariantProps } from "tailwind-variants";

export const listRowVariants = tv(
  {
    base: "flex w-full min-w-0 items-center gap-3",
    variants: {
      variant: {
        /** A row in a card: a 32px tile, a regular title. */
        default: "py-2",
        /** A row in a list: hairline under it, a round lead, a medium title. */
        divided: "border-border border-b py-2.5 last:border-b-0",
      },
      /** Opens something: hover tint and the focus ring. Pair with `href` or `child`. */
      interactive: {
        true: "hover:bg-accent aria-[current=true]:bg-accent aria-[current=page]:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 cursor-pointer px-2 text-left transition-colors",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "default", interactive: true, class: "rounded-[0.625rem]" },
    ],
    defaultVariants: { variant: "default", interactive: false },
  },
  { twMerge: false },
);

export const listRowLeadVariants = tv(
  {
    base: "bg-muted flex shrink-0 items-center justify-center overflow-hidden [&_svg]:shrink-0",
    variants: {
      variant: {
        default: "size-8 rounded-[0.625rem] [&_svg]:size-4",
        divided: "size-7 rounded-full [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default" },
  },
  { twMerge: false },
);

export type ListRowVariants = VariantProps<typeof listRowVariants>;
