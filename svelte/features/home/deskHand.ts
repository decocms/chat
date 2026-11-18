import { claudeWait, type Wait } from "./model";

/**
 * The desk home's hand of cards, from the Studio prototype. The waits stand as
 * a fan at the foot of the first screen, always an odd number (1, 3, 5 or 7)
 * so the one that matters most stands in the middle, highest; the next ones
 * alternate right and left, each pair a little lower and more turned. On a
 * phone they stand as a pile. Scrolling deals every wait into a grid.
 *
 * Positions are authored as Tailwind classes (the style policy keeps all
 * presentation in classes); only the deal itself animates, from script.
 */
/** Your Claude blocked on you first, then people's asks, then your tasks in review; newest first inside each. */
export function byImportance(waits: readonly Wait[]): Wait[] {
  const rank = (wait: Wait) =>
    claudeWait(wait) ? 0 : wait.ref.startsWith("t") ? 2 : 1;
  return [...waits].sort((a, b) => rank(a) - rank(b) || b.ts - a.ts);
}

/** How many cards the fan shows: odd, at most seven. */
export const fanSize = (n: number) => {
  const most = Math.min(n, 7);
  return most % 2 ? most : Math.max(most - 1, 0);
};

/** Where card i stands in the fan: 0 in the middle, then right, left, right… (0 for cards not in the fan). */
export const fanSlot = (i: number) =>
  i === 0 ? 0 : i % 2 ? Math.ceil(i / 2) : -Math.ceil(i / 2);

// Desktop fan, by slot: 46px apart, 16px lower and 3.5° more turned per step, slightly smaller.
const FAN: Record<number, string> = {
  0: "tw:z-20",
  1: "tw:z-[19] tw:translate-x-[46px] tw:translate-y-[16px] tw:rotate-[3.5deg] tw:scale-[0.955]",
  [-1]: "tw:z-[19] tw:translate-x-[-46px] tw:translate-y-[16px] tw:rotate-[-3.5deg] tw:scale-[0.955]",
  2: "tw:z-[18] tw:translate-x-[92px] tw:translate-y-[32px] tw:rotate-[7deg] tw:scale-[0.91]",
  [-2]: "tw:z-[18] tw:translate-x-[-92px] tw:translate-y-[32px] tw:rotate-[-7deg] tw:scale-[0.91]",
  3: "tw:z-[17] tw:translate-x-[138px] tw:translate-y-[48px] tw:rotate-[10.5deg] tw:scale-[0.865]",
  [-3]: "tw:z-[17] tw:translate-x-[-138px] tw:translate-y-[48px] tw:rotate-[-10.5deg] tw:scale-[0.865]",
};
// Phone pile, by depth: each card behind peeks 13px over the one in front, a little smaller and fainter.
const PILE = [
  "tw:max-md:z-20 tw:max-md:translate-x-0 tw:max-md:translate-y-[52px] tw:max-md:rotate-0 tw:max-md:scale-100 tw:max-md:opacity-100 tw:max-md:pointer-events-auto",
  "tw:max-md:z-[19] tw:max-md:translate-x-0 tw:max-md:translate-y-[39px] tw:max-md:rotate-[-2.5deg] tw:max-md:scale-[0.95] tw:max-md:opacity-[0.88] tw:max-md:pointer-events-auto",
  "tw:max-md:z-[18] tw:max-md:translate-x-0 tw:max-md:translate-y-[26px] tw:max-md:rotate-[2deg] tw:max-md:scale-[0.9] tw:max-md:opacity-[0.76] tw:max-md:pointer-events-auto",
  "tw:max-md:z-[17] tw:max-md:translate-x-0 tw:max-md:translate-y-[13px] tw:max-md:rotate-[-2.5deg] tw:max-md:scale-[0.85] tw:max-md:opacity-[0.64] tw:max-md:pointer-events-auto",
  "tw:max-md:z-[16] tw:max-md:translate-x-0 tw:max-md:translate-y-0 tw:max-md:rotate-[2deg] tw:max-md:scale-[0.8] tw:max-md:opacity-[0.52] tw:max-md:pointer-events-auto",
];
const HIDDEN =
  "tw:z-0 tw:translate-y-[80px] tw:opacity-0 tw:pointer-events-none";
const PILE_HIDDEN =
  "tw:max-md:z-0 tw:max-md:opacity-0 tw:max-md:pointer-events-none";

/** The classes that place card i of n in the fan (desktop) and the pile (phone). */
export function fanClasses(i: number, n: number) {
  const shown = fanSize(n);
  return [
    i < shown ? FAN[fanSlot(i)]! : HIDDEN,
    i < PILE.length ? PILE[i]! : PILE_HIDDEN,
  ].join(" ");
}
/** Whether card i of n can be reached in the fan (desktop) or pile (phone). */
export const inFan = (i: number, n: number, phone: boolean) =>
  phone ? i < PILE.length : i < fanSize(n);
