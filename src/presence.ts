// A person's online dot in their DM contacts' lists (src/person.ts). Pure rules, so the Person DO stays small and the
// tests need no runtime. Online = the person's Person DO holds at least one open app socket (/ws-me).

/** How long the last app socket can be gone before the contacts hear "offline": a reload or a short drop says nothing. */
export const PRESENCE_GRACE = 30_000;
/** While online, the owner says so again this often: it repairs a lost message and keeps the receivers' copy fresh. */
export const PRESENCE_REFRESH = 30 * 60_000;
/** A stored "online" older than this reads as offline (two refreshes missed: the owner's DO lost its sockets unheard). */
export const PRESENCE_STALE = 75 * 60_000;

/** What a Person DO last told its contacts about itself. */
export type Announced = { online: boolean; at: number };
/** What a Person DO keeps about one contact (`p:<email>`). */
export type ContactPresence = { online: boolean; at: number };

/** What the Person DO does after a socket event: tell the contacts (`announce`), and where its alarm goes
 *  (`alarm`: a time, `null` = delete it, `undefined` = leave it as it is). */
export type PresencePlan = { announce?: boolean; alarm?: number | null };

/**
 * One step of the owner's presence. `sockets` = the open app sockets after the event.
 * - open: the first socket after an announced offline says "online"; a socket inside the grace period cancels it.
 * - close: the last socket starts the grace period.
 * - alarm: no socket = "offline" (also after sockets lost without a close); sockets = the periodic refresh.
 */
export function planPresence(
  event: "open" | "close" | "alarm",
  sockets: number,
  announced: Announced | undefined,
  now: number,
): PresencePlan {
  const on = !!announced?.online;
  if (event === "open") {
    if (!on) return { announce: true, alarm: now + PRESENCE_REFRESH };
    // Already online: only cancel a pending offline. The refresh stays on the last announcement's clock.
    return { alarm: Math.max(now, announced.at + PRESENCE_REFRESH) };
  }
  if (event === "close") return sockets > 0 ? {} : { alarm: now + PRESENCE_GRACE };
  if (sockets > 0) return { announce: true, alarm: now + PRESENCE_REFRESH };
  return on ? { announce: false, alarm: null } : { alarm: null };
}

/** A contact's dot: online only when the stored state says so and is recent. */
export const isOnline = (state: ContactPresence | undefined, now: number) =>
  !!state?.online && now - state.at < PRESENCE_STALE;
