import { tv, type VariantProps } from "tailwind-variants";

/** A status, a count or a tag. Entities (a goal, an app) are `Chip`s, not badges.
 *  Every badge is the same white pill with an edge (like `Chip` and the outline controls). A tone does not paint the
 *  pill: it sets `--badge-tone`, which colours a 6px dot before the text (or the leading icon, when there is one).
 *  `BadgeDot` uses the same colour, so an explicit dot does not double the automatic one. */
const PLAIN = "text-foreground [a&]:hover:bg-accent [button&]:hover:bg-accent";
const TONED = `${PLAIN} before:size-1.5 before:shrink-0 before:rounded-full before:bg-(--badge-tone) before:content-[''] has-[>svg]:before:hidden has-[>[data-slot=badge-dot]]:before:hidden [&>svg]:text-(--badge-tone)`;

export const badgeVariants = tv(
  {
    base: "inline-flex items-center justify-center rounded-full bg-card shadow-edge text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1.5 [&>svg]:pointer-events-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 transition-[color,background-color] overflow-hidden [button&]:cursor-pointer [button&]:disabled:cursor-not-allowed",
    variants: {
      variant: {
        default: PLAIN,
        neutral: PLAIN,
        secondary: PLAIN,
        outline: PLAIN,
        muted:
          "text-muted-foreground [a&]:hover:bg-accent [button&]:hover:bg-accent",
        success: `${TONED} [--badge-tone:var(--color-success)]`,
        warning: `${TONED} [--badge-tone:var(--color-warning)]`,
        destructive: `${TONED} [--badge-tone:var(--color-destructive)]`,
        agent: `${TONED} [--badge-tone:var(--color-brand-purple-text)]`,
        lime: `${TONED} [--badge-tone:var(--color-brand-soft)] dark:[--badge-tone:var(--color-brand)]`,
        info: `${TONED} [--badge-tone:var(--color-notice)]`,
        brand: `${TONED} [--badge-tone:var(--color-brand-soft)] dark:[--badge-tone:var(--color-brand)]`,
      },
      size: {
        sm: "h-4.5 gap-1 px-1.5 text-[0.6875rem]",
        default: "h-5.5 px-2",
        lg: "h-6 px-2.5 text-sm [&>svg]:size-3.5",
        control: "h-7 gap-1.5 pr-3 pl-1.5",
        icon: "size-5 before:hidden",
        segmented: "h-7 gap-0 rounded-lg p-0 before:hidden",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
  { twMerge: false },
);

export type BadgeVariants = VariantProps<typeof badgeVariants>;
