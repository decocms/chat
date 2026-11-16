import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `project-icon.tsx`: the project's colour at 14% behind its icon, drawn in the full colour. */
export const projectIconVariants = tv(
  {
    base: "tw:inline-flex tw:shrink-0 tw:items-center tw:justify-center tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg]:stroke-[1.5]",
    variants: {
      color: {
        blue: "tw:bg-project-blue/14 tw:text-project-blue",
        green: "tw:bg-project-green/14 tw:text-project-green",
        purple: "tw:bg-project-purple/14 tw:text-project-purple",
        red: "tw:bg-project-red/14 tw:text-project-red",
        amber: "tw:bg-project-amber/14 tw:text-project-amber",
      },
      size: {
        sm: "tw:size-5 tw:rounded-full tw:[&_svg]:size-3",
        default: "tw:size-7 tw:rounded-lg tw:[&_svg]:size-4",
      },
    },
    defaultVariants: { color: "blue", size: "default" },
  },
  { twMerge: false },
);

export type ProjectIconVariants = VariantProps<typeof projectIconVariants>;
