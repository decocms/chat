import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `project-icon.tsx`: the project's colour at 14% behind its icon, drawn in the full colour. */
export const projectIconVariants = tv(
  {
    base: "inline-flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:stroke-[1.5]",
    variants: {
      color: {
        blue: "bg-project-blue/14 text-project-blue",
        green: "bg-project-green/14 text-project-green",
        purple: "bg-project-purple/14 text-project-purple",
        red: "bg-project-red/14 text-project-red",
        amber: "bg-project-amber/14 text-project-amber",
      },
      size: {
        sm: "size-5 rounded-full [&_svg]:size-3",
        default: "size-7 rounded-lg [&_svg]:size-4",
      },
    },
    defaultVariants: { color: "blue", size: "default" },
  },
  { twMerge: false },
);

export type ProjectIconVariants = VariantProps<typeof projectIconVariants>;
