import { tv, type VariantProps } from "tailwind-variants";

/**
 * A navigation row: a room, a DM, a thread or a view, one line tall (a status
 * line can make it two). `sidebar` is the room sidebar's row, `list` the phone
 * sheets' bigger touch row, `chats` the phone home's chat list, sized like
 * WhatsApp's (a 56px avatar, a 17px name, two 15px lines of preview). Current = `aria-current` ("page", or "true" for a
 * row whose open page is a child under it) or `aria-pressed` on a toggle, so
 * the state lives in the markup, not in a class.
 */
export const navRow = tv({
  base: "flex w-full min-w-0 cursor-pointer items-center border-0 bg-transparent text-left font-sans no-underline outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring",
  variants: {
    variant: {
      sidebar:
        "min-h-9 gap-2 rounded-lg px-2 py-1 text-sm text-sidebar-foreground hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=true]:bg-sidebar-accent aria-[current=true]:font-medium aria-pressed:bg-sidebar-accent aria-pressed:font-medium",
      list: "min-h-12 gap-3 rounded-control px-2 text-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=true]:bg-accent",
      chats:
        "min-h-20 gap-3 rounded-control px-2 py-2 text-foreground hover:bg-accent aria-[current=page]:bg-accent aria-[current=true]:bg-accent",
    },
    faded: { true: "text-muted-foreground" },
  },
  defaultVariants: { variant: "sidebar" },
});
export type NavRowVariant = NonNullable<VariantProps<typeof navRow>["variant"]>;

/** The row's name and its status line under it, per variant. */
export const NAV_ROW_TEXT = {
  sidebar: { label: "truncate", meta: "truncate text-xs leading-4" },
  list: { label: "truncate", meta: "truncate text-xs leading-4" },
  // The preview keeps room for two lines, so every row is as tall and its name sits in the same place.
  chats: {
    label: "truncate text-lg leading-6 font-medium",
    meta: "line-clamp-2 min-h-10 text-base leading-5 break-words",
  },
} as const satisfies Record<NavRowVariant, { label: string; meta: string }>;
