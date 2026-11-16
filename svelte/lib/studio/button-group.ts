import { tv, type VariantProps } from "tailwind-variants";

export const buttonGroupVariants = tv(
  {
    base: "tw:flex tw:w-fit tw:items-stretch tw:[&>*]:focus-visible:z-10 tw:[&>*]:focus-visible:relative tw:[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit tw:[&>input]:flex-1 tw:has-[>[data-slot=button-group]]:gap-2 tw:has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-lg",
    variants: {
      orientation: {
        horizontal:
          "tw:[&>*:not(:first-child)]:rounded-l-none tw:[&>*:not(:first-child)]:border-l-0 tw:[&>*:not(:last-child)]:rounded-r-none",
        vertical:
          "tw:flex-col tw:[&>*:not(:first-child)]:rounded-t-none tw:[&>*:not(:first-child)]:border-t-0 tw:[&>*:not(:last-child)]:rounded-b-none",
      },
    },
    defaultVariants: { orientation: "horizontal" },
  },
  { twMerge: false },
);

export type ButtonGroupVariants = VariantProps<typeof buttonGroupVariants>;
