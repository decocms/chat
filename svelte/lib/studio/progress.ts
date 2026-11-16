import { tv, type VariantProps } from "tailwind-variants";

/** A 4px bar: purple by default, warning when behind target, ink for neutral work such as an upload. The fill is a native progress value, since inline styles are not allowed here. */
export const progressIndicatorVariants = tv(
  {
    base: "tw:block tw:h-full tw:w-full tw:flex-1 tw:appearance-none tw:border-0 tw:bg-transparent tw:[&::-webkit-progress-bar]:bg-transparent tw:[&::-webkit-progress-value]:rounded-r-full tw:[&::-webkit-progress-value]:bg-current tw:[&::-webkit-progress-value]:transition-[width] tw:[&::-webkit-progress-value]:duration-200 tw:[&::-webkit-progress-value]:ease-[var(--vb-ease-out-cubic)] tw:[&::-moz-progress-bar]:rounded-r-full tw:[&::-moz-progress-bar]:bg-current tw:[&::-moz-progress-bar]:transition-[width] tw:[&::-moz-progress-bar]:duration-200 tw:[&::-moz-progress-bar]:ease-[var(--vb-ease-out-cubic)]",
    variants: {
      tone: {
        default: "tw:text-brand-purple",
        warning: "tw:text-warning",
        dark: "tw:text-primary",
      },
    },
    defaultVariants: { tone: "default" },
  },
  { twMerge: false },
);

export type ProgressIndicatorVariants = VariantProps<
  typeof progressIndicatorVariants
>;
