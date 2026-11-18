import { tv, type VariantProps } from "tailwind-variants";

/** Ported 1:1 from @decocms/ui `composer.tsx`. `compact` is one line, for side panels and threads. */
export const composerVariants = tv(
  {
    base: "group/composer bg-card text-card-foreground relative z-10 flex w-full rounded-2xl shadow-[inset_0_0_0_1px_var(--vb-hairline),0_4px_16px_0_#0000000d] transition-shadow focus-within:shadow-[inset_0_0_0_1px_var(--vb-input),0_6px_20px_0_#00000014]",
    variants: {
      size: {
        full: "min-h-30 flex-col",
        compact: "items-center gap-1 py-1.5 pr-1.5 pl-1",
      },
    },
    defaultVariants: { size: "full" },
  },
  { twMerge: false },
);

/** `agent` is plan mode, `info` web search and deep research, `highlight` create image. */
export const composerModeVariants = tv(
  {
    base: "group/mode focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors disabled:cursor-not-allowed [&_svg]:size-3.5",
    variants: {
      tone: {
        agent:
          "bg-brand-purple-tint text-brand-purple-dark dark:bg-brand-purple/20 dark:text-brand-purple",
        info: "bg-brand-blue-tint text-brand-blue-dark dark:bg-brand-blue/20 dark:text-brand-blue",
        highlight:
          "bg-brand-yellow-tint text-brand-yellow-dark dark:bg-brand-yellow/20 dark:text-brand-yellow",
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
  12: "h-[12%]",
  13: "h-[13%]",
  14: "h-[14%]",
  15: "h-[15%]",
  16: "h-[16%]",
  17: "h-[17%]",
  18: "h-[18%]",
  19: "h-[19%]",
  20: "h-[20%]",
  21: "h-[21%]",
  22: "h-[22%]",
  23: "h-[23%]",
  24: "h-[24%]",
  25: "h-[25%]",
  26: "h-[26%]",
  27: "h-[27%]",
  28: "h-[28%]",
  29: "h-[29%]",
  30: "h-[30%]",
  31: "h-[31%]",
  32: "h-[32%]",
  33: "h-[33%]",
  34: "h-[34%]",
  35: "h-[35%]",
  36: "h-[36%]",
  37: "h-[37%]",
  38: "h-[38%]",
  39: "h-[39%]",
  40: "h-[40%]",
  41: "h-[41%]",
  42: "h-[42%]",
  43: "h-[43%]",
  44: "h-[44%]",
  45: "h-[45%]",
  46: "h-[46%]",
  47: "h-[47%]",
  48: "h-[48%]",
  49: "h-[49%]",
  50: "h-[50%]",
  51: "h-[51%]",
  52: "h-[52%]",
  53: "h-[53%]",
  54: "h-[54%]",
  55: "h-[55%]",
  56: "h-[56%]",
  57: "h-[57%]",
  58: "h-[58%]",
  59: "h-[59%]",
  60: "h-[60%]",
  61: "h-[61%]",
  62: "h-[62%]",
  63: "h-[63%]",
  64: "h-[64%]",
  65: "h-[65%]",
  66: "h-[66%]",
  67: "h-[67%]",
  68: "h-[68%]",
  69: "h-[69%]",
  70: "h-[70%]",
  71: "h-[71%]",
  72: "h-[72%]",
  73: "h-[73%]",
  74: "h-[74%]",
  75: "h-[75%]",
  76: "h-[76%]",
  77: "h-[77%]",
  78: "h-[78%]",
  79: "h-[79%]",
  80: "h-[80%]",
  81: "h-[81%]",
  82: "h-[82%]",
  83: "h-[83%]",
  84: "h-[84%]",
  85: "h-[85%]",
  86: "h-[86%]",
  87: "h-[87%]",
  88: "h-[88%]",
  89: "h-[89%]",
  90: "h-[90%]",
  91: "h-[91%]",
  92: "h-[92%]",
  93: "h-[93%]",
  94: "h-[94%]",
  95: "h-[95%]",
  96: "h-[96%]",
  97: "h-[97%]",
  98: "h-[98%]",
  99: "h-[99%]",
  100: "h-[100%]",
};

export function composerLevelHeight(level: number): string {
  const percent = Math.round(Math.min(100, Math.max(12, level * 100)));
  return LEVEL_HEIGHTS[percent] ?? "h-[12%]";
}
