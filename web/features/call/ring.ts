// A DM's call ringing me, wherever I am in the app (the personal channel's {t:"ring"}, src/book.ts ringStart), and
// what a click on a call's button asks of the room's call (the room's scene does it: RoomScene).
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
/** Answer or decline a room's call from anywhere (the ring's card, a call line in the chat). The room's scene
 *  takes it once it has that room open. */
export type CallIntent = { room: string; action: "join" | "decline" };
export const callIntent = writable<CallIntent | null>(null);
/** The ring's sound: the app's chime, again every few seconds while it rings. */
export const RING_REPEAT_MS = 3_000;
