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
  0: "z-20",
  1: "z-[19] translate-x-[46px] translate-y-[16px] rotate-[3.5deg] scale-[0.955]",
  [-1]: "z-[19] translate-x-[-46px] translate-y-[16px] rotate-[-3.5deg] scale-[0.955]",
  2: "z-[18] translate-x-[92px] translate-y-[32px] rotate-[7deg] scale-[0.91]",
  [-2]: "z-[18] translate-x-[-92px] translate-y-[32px] rotate-[-7deg] scale-[0.91]",
  3: "z-[17] translate-x-[138px] translate-y-[48px] rotate-[10.5deg] scale-[0.865]",
  [-3]: "z-[17] translate-x-[-138px] translate-y-[48px] rotate-[-10.5deg] scale-[0.865]",
};
// Phone pile, by depth: each card behind peeks 13px over the one in front, a little smaller and fainter.
const PILE = [
  "max-md:z-20 max-md:translate-x-0 max-md:translate-y-[52px] max-md:rotate-0 max-md:scale-100 max-md:opacity-100 max-md:pointer-events-auto",
  "max-md:z-[19] max-md:translate-x-0 max-md:translate-y-[39px] max-md:rotate-[-2.5deg] max-md:scale-[0.95] max-md:opacity-[0.88] max-md:pointer-events-auto",
  "max-md:z-[18] max-md:translate-x-0 max-md:translate-y-[26px] max-md:rotate-[2deg] max-md:scale-[0.9] max-md:opacity-[0.76] max-md:pointer-events-auto",
  "max-md:z-[17] max-md:translate-x-0 max-md:translate-y-[13px] max-md:rotate-[-2.5deg] max-md:scale-[0.85] max-md:opacity-[0.64] max-md:pointer-events-auto",
  "max-md:z-[16] max-md:translate-x-0 max-md:translate-y-0 max-md:rotate-[2deg] max-md:scale-[0.8] max-md:opacity-[0.52] max-md:pointer-events-auto",
];
const HIDDEN = "z-0 translate-y-[80px] opacity-0 pointer-events-none";
const PILE_HIDDEN = "max-md:z-0 max-md:opacity-0 max-md:pointer-events-none";

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
