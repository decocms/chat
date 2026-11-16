import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `composer.tsx`. `compact` is one line, for side panels and threads. */
export const composerVariants = tv(
  {
    base: "tw:group/composer tw:bg-card tw:text-card-foreground tw:relative tw:z-10 tw:flex tw:w-full tw:rounded-2xl tw:shadow-[inset_0_0_0_1px_var(--vb-hairline),0_4px_16px_0_#0000000d] tw:transition-shadow tw:focus-within:shadow-[inset_0_0_0_1px_var(--vb-input),0_6px_20px_0_#00000014]",
    variants: {
      size: {
        full: "tw:min-h-30 tw:flex-col",
        compact: "tw:items-center tw:gap-1 tw:py-1.5 tw:pr-1.5 tw:pl-1",
      },
    },
    defaultVariants: { size: "full" },
  },
  { twMerge: false },
);

/** `agent` is plan mode, `info` web search and deep research, `highlight` create image. */
export const composerModeVariants = tv(
  {
    base: "tw:group/mode tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:inline-flex tw:h-7 tw:shrink-0 tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-full tw:px-2.5 tw:text-xs tw:font-medium tw:transition-colors tw:disabled:cursor-not-allowed tw:[&_svg]:size-3.5",
    variants: {
      tone: {
        agent:
          "tw:bg-brand-purple-tint tw:text-brand-purple-dark tw:dark:bg-brand-purple/20 tw:dark:text-brand-purple",
        info: "tw:bg-brand-blue-tint tw:text-brand-blue-dark tw:dark:bg-brand-blue/20 tw:dark:text-brand-blue",
        highlight:
          "tw:bg-brand-yellow-tint tw:text-brand-yellow-dark tw:dark:bg-brand-yellow/20 tw:dark:text-brand-yellow",
      },
    },
    defaultVariants: { tone: "agent" },
  },
  { twMerge: false },
);

export type ComposerVariants = VariantProps<typeof composerVariants>;
export type ComposerModeVariants = VariantProps<typeof composerModeVariants>;

/** Inline styles are not allowed here, so a recording bar takes its height, in whole percent, from this table. */
const LEVEL_HEIGHTS: Record<number, string> = {
  12: "tw:h-[12%]",
  13: "tw:h-[13%]",
  14: "tw:h-[14%]",
  15: "tw:h-[15%]",
  16: "tw:h-[16%]",
  17: "tw:h-[17%]",
  18: "tw:h-[18%]",
  19: "tw:h-[19%]",
  20: "tw:h-[20%]",
  21: "tw:h-[21%]",
  22: "tw:h-[22%]",
  23: "tw:h-[23%]",
  24: "tw:h-[24%]",
  25: "tw:h-[25%]",
  26: "tw:h-[26%]",
  27: "tw:h-[27%]",
  28: "tw:h-[28%]",
  29: "tw:h-[29%]",
  30: "tw:h-[30%]",
  31: "tw:h-[31%]",
  32: "tw:h-[32%]",
  33: "tw:h-[33%]",
  34: "tw:h-[34%]",
  35: "tw:h-[35%]",
  36: "tw:h-[36%]",
  37: "tw:h-[37%]",
  38: "tw:h-[38%]",
  39: "tw:h-[39%]",
  40: "tw:h-[40%]",
  41: "tw:h-[41%]",
  42: "tw:h-[42%]",
  43: "tw:h-[43%]",
  44: "tw:h-[44%]",
  45: "tw:h-[45%]",
  46: "tw:h-[46%]",
  47: "tw:h-[47%]",
  48: "tw:h-[48%]",
  49: "tw:h-[49%]",
  50: "tw:h-[50%]",
  51: "tw:h-[51%]",
  52: "tw:h-[52%]",
  53: "tw:h-[53%]",
  54: "tw:h-[54%]",
  55: "tw:h-[55%]",
  56: "tw:h-[56%]",
  57: "tw:h-[57%]",
  58: "tw:h-[58%]",
  59: "tw:h-[59%]",
  60: "tw:h-[60%]",
  61: "tw:h-[61%]",
  62: "tw:h-[62%]",
  63: "tw:h-[63%]",
  64: "tw:h-[64%]",
  65: "tw:h-[65%]",
  66: "tw:h-[66%]",
  67: "tw:h-[67%]",
  68: "tw:h-[68%]",
  69: "tw:h-[69%]",
  70: "tw:h-[70%]",
  71: "tw:h-[71%]",
  72: "tw:h-[72%]",
  73: "tw:h-[73%]",
  74: "tw:h-[74%]",
  75: "tw:h-[75%]",
  76: "tw:h-[76%]",
  77: "tw:h-[77%]",
  78: "tw:h-[78%]",
  79: "tw:h-[79%]",
  80: "tw:h-[80%]",
  81: "tw:h-[81%]",
  82: "tw:h-[82%]",
  83: "tw:h-[83%]",
  84: "tw:h-[84%]",
  85: "tw:h-[85%]",
  86: "tw:h-[86%]",
  87: "tw:h-[87%]",
  88: "tw:h-[88%]",
  89: "tw:h-[89%]",
  90: "tw:h-[90%]",
  91: "tw:h-[91%]",
  92: "tw:h-[92%]",
  93: "tw:h-[93%]",
  94: "tw:h-[94%]",
  95: "tw:h-[95%]",
  96: "tw:h-[96%]",
  97: "tw:h-[97%]",
  98: "tw:h-[98%]",
  99: "tw:h-[99%]",
  100: "tw:h-[100%]",
};

export function composerLevelHeight(level: number): string {
  const percent = Math.round(Math.min(100, Math.max(12, level * 100)));
  return LEVEL_HEIGHTS[percent] ?? "tw:h-[12%]";
}
