/** "O que precisa de você" written as one or two lines (Gui #2602): the Book answers needs.summary with a needsSummary
 *  event; the room controller forwards it here, keyed by room and thread. */
import { writable } from "svelte/store";
import type { RoomEvent } from "../../../shared/events";
export const needsSummaries = writable<Record<string, string>>({});
export function needsSummaryEvent(roomId: string, event: RoomEvent) {
  if (event.t === "needsSummary")
    needsSummaries.update((all) => ({
      ...all,
      [`${roomId}|${event.thread}`]: event.text,
    }));
}
