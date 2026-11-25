// A DM's call ringing me, wherever I am in the app (the personal channel's {t:"ring"}, src/book.ts ringStart). The
// call itself is the app's (hub.ts): answering joins it from wherever I am.
import { writable } from "svelte/store";

export type IncomingRing = {
  book: string;
  from: string;
  name: string;
  avatar: number | null;
  until: number;
};
/** The ring of the moment: one at a time, the newest wins. */
export const incomingRing = writable<IncomingRing | null>(null);
/** A notice from the personal channel: a ring starts (with `from`), or that room's ring stopped. */
export function ringNotice(notice: {
  book: string;
  from?: string;
  until?: number;
  name?: string;
  avatar?: number | null;
}) {
  if (notice.from && notice.until && notice.until > Date.now())
    incomingRing.set({
      book: notice.book,
      from: notice.from,
      name: notice.name || notice.from.split("@")[0]!,
      avatar: notice.avatar ?? null,
      until: notice.until,
    });
  else
    incomingRing.update((ring) => (ring?.book === notice.book ? null : ring));
}
/** The ring's sound: the app's chime, again every few seconds while it rings. */
export const RING_REPEAT_MS = 3_000;
