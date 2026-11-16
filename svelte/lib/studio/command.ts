import { tv, type VariantProps } from "tailwind-variants";

/** Ported from @decocms/ui `command.tsx`: the menu-row recipe, exported so a row OUTSIDE a `Command` is the same row. Bits UI marks the highlighted row with a bare `data-selected`, where cmdk wrote `data-selected="true"`. */
export const commandItemVariants = tv(
  {
    base: "tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:relative tw:flex tw:min-h-8 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:select-none tw:data-[disabled]:pointer-events-none tw:data-[disabled]:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4",
    variants: {
      highlight: {
        selected:
          "tw:data-[selected]:bg-accent tw:data-[selected]:text-accent-foreground",
        hover: "tw:w-full tw:hover:bg-accent tw:hover:text-accent-foreground",
      },
      size: {
        default: "",
        lg: "tw:min-h-11 tw:gap-3 tw:rounded-lg tw:px-2.5 tw:py-2",
      },
    },
    defaultVariants: { highlight: "selected", size: "default" },
  },
  { twMerge: false },
);

export type CommandItemVariants = VariantProps<typeof commandItemVariants>;

/** What `Command` shares with its parts: how many rows currently match, which Bits UI does not expose to `Command.Empty` before the first row registers. */
export const COMMAND_CONTEXT = Symbol("studio-command");
export type CommandContext = { readonly count: number };
