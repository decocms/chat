/** Doc versions (Gui #2666): the Book answers doc.versions / doc.version with these events; the room controller
 *  forwards them here and DocumentVersions draws the picker for the doc on screen. One room at a time per tab. */
import { writable } from "svelte/store";
import type { RoomEvent } from "../../../shared/events";
export type DocVersionList = Extract<RoomEvent, { t: "docVersions" }>;
export type DocVersion = Extract<RoomEvent, { t: "docVersion" }>;
export const docVersionList = writable<DocVersionList | null>(null);
export const docVersionOpen = writable<DocVersion | null>(null);
export function docVersionEvent(event: RoomEvent) {
  if (event.t === "docVersions") docVersionList.set(event);
  else if (event.t === "docVersion") docVersionOpen.set(event);
}
