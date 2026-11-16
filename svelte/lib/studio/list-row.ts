import { tv, type VariantProps } from "tailwind-variants";

export const listRowVariants = tv(
  {
    base: "tw:flex tw:w-full tw:min-w-0 tw:items-center tw:gap-3",
    variants: {
      variant: {
        /** A row in a card: a 32px tile, a regular title. */
        default: "tw:py-2",
        /** A row in a list: hairline under it, a round lead, a medium title. */
        divided: "tw:border-border tw:border-b tw:py-2.5 tw:last:border-b-0",
      },
      /** Opens something: hover tint and the focus ring. Pair with `href` or `child`. */
      interactive: {
        true: "tw:hover:bg-accent tw:aria-[current=true]:bg-accent tw:aria-[current=page]:bg-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:cursor-pointer tw:px-2 tw:text-left tw:transition-colors",
        false: "",
      },
    },
    compoundVariants: [
      { variant: "default", interactive: true, class: "tw:rounded-[0.625rem]" },
    ],
    defaultVariants: { variant: "default", interactive: false },
  },
  { twMerge: false },
);

export const listRowLeadVariants = tv(
  {
    base: "tw:bg-muted tw:flex tw:shrink-0 tw:items-center tw:justify-center tw:overflow-hidden tw:[&_svg]:shrink-0",
    variants: {
      variant: {
        default: "tw:size-8 tw:rounded-[0.625rem] tw:[&_svg]:size-4",
        divided: "tw:size-7 tw:rounded-full tw:[&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default" },
  },
  { twMerge: false },
);

export type ListRowVariants = VariantProps<typeof listRowVariants>;
