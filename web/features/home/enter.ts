/**
 * A one-time entrance for a short list: opacity and a 6px rise, 240ms on the
 * strong ease-out (--vb-ease-out-quint), 40ms between items. Reduced motion
 * keeps the fade and drops the rise. Tailwind needs the delays as literal classes.
 */
const DELAYS = [
  "[animation-delay:0ms]",
  "[animation-delay:40ms]",
  "[animation-delay:80ms]",
  "[animation-delay:120ms]",
  "[animation-delay:160ms]",
  "[animation-delay:200ms]",
  "[animation-delay:240ms]",
  "[animation-delay:280ms]",
  "[animation-delay:320ms]",
  "[animation-delay:360ms]",
] as const;
export const enter = (index: number) =>
  `animate-in [animation-fill-mode:backwards] duration-[240ms] ease-[var(--vb-ease-out-quint)] [--tw-enter-opacity:0] [--tw-enter-translate-y:6px] motion-reduce:[--tw-enter-translate-y:0] ${DELAYS[Math.min(index, DELAYS.length - 1)]}`;
