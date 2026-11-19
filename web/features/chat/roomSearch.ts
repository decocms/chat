import { writable } from "svelte/store";

/** What the room's search field holds: typed in the top bar, listed in the Search pane beside the chat. */
export const roomSearchQuery = writable("");

/** A message this room holds that matches every word of the query (accents and case ignored). */
export function matchesQuery(text: string, query: string) {
  const fold = (value: string) =>
    value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const haystack = fold(text);
  return words.every((word) => haystack.includes(word));
}
