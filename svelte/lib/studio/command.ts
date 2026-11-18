import { tv, type VariantProps } from "tailwind-variants";

/** Ported from @decocms/ui `command.tsx`: the menu-row recipe, exported so a row OUTSIDE a `Command` is the same row. Bits UI marks the highlighted row with a bare `data-selected`, where cmdk wrote `data-selected="true"`. */
export const commandItemVariants = tv(
  {
    base: "[&_svg:not([class*='text-'])]:text-muted-foreground relative flex min-h-8 cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    variants: {
      highlight: {
        selected:
          "data-[selected]:bg-accent data-[selected]:text-accent-foreground",
        hover: "w-full hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "",
        lg: "min-h-11 gap-3 rounded-lg px-2.5 py-2",
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
