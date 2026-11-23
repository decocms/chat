import { tv, type VariantProps } from "tailwind-variants";

/** A 4px bar: purple by default, warning when behind target, ink for neutral work such as an upload. The fill is a native progress value, since inline styles are not allowed here. */
export const progressIndicatorVariants = tv(
  {
    base: "block h-full w-full flex-1 appearance-none border-0 bg-transparent [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-r-full [&::-webkit-progress-value]:bg-current [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-200 [&::-webkit-progress-value]:ease-[var(--vb-ease-out-cubic)] [&::-moz-progress-bar]:rounded-r-full [&::-moz-progress-bar]:bg-current [&::-moz-progress-bar]:transition-[width] [&::-moz-progress-bar]:duration-200 [&::-moz-progress-bar]:ease-[var(--vb-ease-out-cubic)]",
    variants: {
      tone: {
        default: "text-brand-purple",
        warning: "text-warning",
        dark: "text-primary",
        success: "text-success",
      },
    },
    defaultVariants: { tone: "default" },
  },
  { twMerge: false },
);

export type ProgressIndicatorVariants = VariantProps<
  typeof progressIndicatorVariants
>;
