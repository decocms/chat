import { writable, type Readable } from "svelte/store";
import { CALL_THREAD } from "../../../shared/call";

/** How many threads you opened last go to the top of the sidebar's list. */
export const RECENT_THREADS = 3;
/** Rooms kept per account; the oldest visit drops out past this. */
const ROOMS_KEPT = 200;

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type RoomVisit = {
  /** The thread you were in when you left the room ("main" included). */
  last: string;
  /** The threads (not main) you opened last, newest first. */
  recent: string[];
  at: number;
};
type Visits = Record<string, RoomVisit>;

const key = (account: string) => `vb.visits.${account}`;

function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

function parse(raw: string | null): Visits {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const visits: Visits = {};
    for (const [room, entry] of Object.entries(value)) {
      const visit = entry as Partial<RoomVisit> | null;
      if (
        typeof visit?.last === "string" &&
        Array.isArray(visit.recent) &&
        visit.recent.every((id) => typeof id === "string") &&
        typeof visit.at === "number"
      )
        visits[room] = {
          last: visit.last,
          recent: visit.recent.slice(0, RECENT_THREADS),
          at: visit.at,
        };
    }
    return visits;
  } catch {
    return {};
  }
}

/**
 * The recent list changes only when a thread outside it opens: moving between
 * the three already on top keeps their order, so the row you click stays put.
 */
export function recordRecent(recent: readonly string[], thread: string) {
  if (thread === "main" || thread === CALL_THREAD || thread.startsWith("pre:"))
    return [...recent];
  if (recent.includes(thread)) return [...recent];
  return [thread, ...recent].slice(0, RECENT_THREADS);
}

/**
 * Where you were in each room on this device, so coming back to a room opens
 * the thread you left and the sidebar lists your last threads first. Device
 * storage only: it is a convenience, and it reads empty when storage is off.
 */
export function createRoomVisits(
  storage: Storage | null = browserStorage(),
  now = () => Date.now(),
) {
  let account: string | null = null;
  let visits: Visits = {};
  const state = writable<{ account: string | null; visits: Visits }>({
    account,
    visits,
  });
  function load(next: string) {
    if (account === next) return;
    account = next;
    try {
      visits = parse(storage?.getItem(key(next)) ?? null);
    } catch {
      visits = {};
    }
    state.set({ account, visits });
  }
  function save() {
    if (!account) return;
    const rooms = Object.entries(visits);
    if (rooms.length > ROOMS_KEPT)
      visits = Object.fromEntries(
        rooms.sort((a, b) => b[1].at - a[1].at).slice(0, ROOMS_KEPT),
      );
    try {
      storage?.setItem(key(account), JSON.stringify(visits));
    } catch {
      // Without device storage the visits last until the tab closes.
    }
    state.set({ account, visits });
  }
  return {
    state: state as Readable<{ account: string | null; visits: Visits }>,
    /** A thread of the room is on screen. */
    enter(owner: string, roomId: string, thread: string) {
      // The room's old call chat (before each call had its own thread) is never where a room reopens: a person
      // left in it came back to it on every visit (Gimenes, 2026-11-25, "não sai").
      if (thread.startsWith("pre:") || thread === CALL_THREAD) return;
      load(owner);
      const prior = visits[roomId];
      if (prior?.last === thread) return;
      visits = {
        ...visits,
        [roomId]: {
          last: thread,
          recent: recordRecent(prior?.recent ?? [], thread),
          at: now(),
        },
      };
      save();
    },
    /** The thread to reopen when you come back to the room without a link to one. */
    last(owner: string, roomId: string) {
      load(owner);
      const last = visits[roomId]?.last ?? null;
      return last === CALL_THREAD ? null : last;
    },
    recent(owner: string, roomId: string): readonly string[] {
      load(owner);
      return visits[roomId]?.recent ?? [];
    },
  };
}
export type RoomVisits = ReturnType<typeof createRoomVisits>;

/** One per tab: the room host and the sidebar read the same visits. */
export const roomVisits = createRoomVisits();
