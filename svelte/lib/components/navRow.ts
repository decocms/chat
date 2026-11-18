import { tv, type VariantProps } from "tailwind-variants";

/**
 * A navigation row: a room, a DM, a thread or a view, one line tall (a status
 * line can make it two). `sidebar` is the room sidebar's row, `list` the phone
 * sheets' bigger touch row. Current = `aria-current` ("page", or "true" for a
 * row whose open page is a child under it) or `aria-pressed` on a toggle, so
 * the state lives in the markup, not in a class.
 */
export const navRow = tv({
  base: "tw:flex tw:w-full tw:min-w-0 tw:cursor-pointer tw:items-center tw:border-0 tw:bg-transparent tw:text-left tw:font-sans tw:no-underline tw:outline-none tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring",
  variants: {
    variant: {
      sidebar:
        "tw:min-h-9 tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1 tw:text-sm tw:text-sidebar-foreground tw:hover:bg-sidebar-accent tw:aria-[current=page]:bg-sidebar-accent tw:aria-[current=page]:font-medium tw:aria-[current=true]:bg-sidebar-accent tw:aria-[current=true]:font-medium tw:aria-pressed:bg-sidebar-accent tw:aria-pressed:font-medium",
      list: "tw:min-h-12 tw:gap-3 tw:rounded-control tw:px-2 tw:text-foreground tw:hover:bg-accent tw:aria-[current=page]:bg-accent tw:aria-[current=true]:bg-accent",
    },
    faded: { true: "tw:text-muted-foreground" },
  },
  defaultVariants: { variant: "sidebar" },
});
export type NavRowVariant = NonNullable<VariantProps<typeof navRow>["variant"]>;
