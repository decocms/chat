import { writable } from "svelte/store";
import type { DocumentPane } from "../documents/types";

/** What the room's search looks for: words of the text, a member's own messages, or both. */
export type SearchFilter = { text: string; person: string };
export const NO_SEARCH: SearchFilter = { text: "", person: "" };

/**
 * The room's search, typed in the top bar (on a phone, at the top of the Search pane) and listed in the Search pane.
 * It belongs to one room: another room reads it as empty, so a search does not follow you to the next room.
 */
export const roomSearch = writable<SearchFilter & { room: string }>({
  room: "",
  ...NO_SEARCH,
});

/** The search of `room`, or none when the store holds another room's. */
export function searchOf(
  state: SearchFilter & { room: string },
  room: string,
): SearchFilter {
  return state.room === room
    ? { text: state.text, person: state.person }
    : NO_SEARCH;
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
/** The words a search looks for: like the server's (Book.search), a one-letter word is left out. */
function searchWords(query: string) {
  return fold(query)
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

/** A search lists something: a word of two or more letters, or a person. */
export function searchActive(filter: SearchFilter) {
  return searchWords(filter.text).length > 0 || !!filter.person;
}

/** A message this room holds that matches every word of the query (accents and case ignored). */
export function matchesQuery(text: string, query: string) {
  const words = searchWords(query);
  if (!words.length) return false;
  const haystack = fold(text);
  return words.every((word) => haystack.includes(word));
}

type Searchable = {
  author: string;
  text: string;
  kind?: string | null;
  deleted?: number | null;
  files?: readonly { name: string }[] | null;
};

/**
 * A loaded message the search lists. With a person: only that person's own messages, not the ones their agent
 * posted in their name (kind "agent"). With text: every word in its text or in a file's name. With a person and no
 * text: each of their messages that has text or files.
 */
export function matchesSearch(message: Searchable, filter: SearchFilter) {
  if (message.deleted) return false;
  if (
    filter.person &&
    (message.author !== filter.person || message.kind === "agent")
  )
    return false;
  const names = (message.files ?? []).map((file) => file.name).join("\n");
  if (searchWords(filter.text).length)
    return matchesQuery(`${message.text}\n${names}`, filter.text);
  return !!filter.person && !!(message.text || names);
}

/**
 * The list: the loaded matches and the server's pages, newest first, each message once. While the server has
 * older pages (`more`), a loaded match older than its last page waits for that page, so the list has no gap.
 */
export function mergeHits<T extends { id: number }>(
  local: readonly T[],
  remote: readonly T[],
  more: boolean,
): T[] {
  const frontier =
    more && remote.length ? Math.min(...remote.map((hit) => hit.id)) : 0;
  const seen = new Set<number>();
  return [...local.filter((hit) => hit.id >= frontier), ...remote]
    .filter((hit) => !seen.has(hit.id) && !!seen.add(hit.id))
    .sort((a, b) => b.id - a.id);
}

/** Which pane was beside the chat before the search opened its pane (desktop). */
export type PaneBefore = { visible: boolean; pane: DocumentPane };

/**
 * What the desktop pane does when the search changes. A search that lists something opens the Search pane. A search
 * that lists nothing gives the column back: the pane that was open before, or no pane. A closed pane goes back to
 * the pane it was (or the doc), so the panel toggle (⌥⌘B) never opens an empty Search pane. On a phone, the Search
 * pane holds the field, so it stays open.
 */
export function searchPaneStep(
  active: boolean,
  layout: { mobile: boolean; documentVisible: boolean; pane: DocumentPane },
  before: PaneBefore | null,
):
  | { kind: "none" }
  | { kind: "open"; before: PaneBefore }
  | { kind: "restore"; pane: DocumentPane }
  | { kind: "close"; pane: DocumentPane } {
  if (layout.mobile) return { kind: "none" };
  const showing = layout.documentVisible && layout.pane === "search";
  if (active)
    return showing
      ? { kind: "none" }
      : {
          kind: "open",
          before: { visible: layout.documentVisible, pane: layout.pane },
        };
  if (!showing) return { kind: "none" };
  const pane = before && before.pane !== "search" ? before.pane : "doc";
  return before?.visible && pane === before.pane
    ? { kind: "restore", pane }
    : { kind: "close", pane };
}

/** The people picker's filter (Command `filter`): every typed word in the person's name or email. */
export function personMatch(value: string, search: string) {
  const name = fold(value);
  return fold(search)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => name.includes(word))
    ? 1
    : 0;
}

/** The field's placeholder: "Buscar em {room}", or "Buscar na conversa" in a DM. */
export function searchPlaceholder(
  book: { title: string; dm?: boolean | null },
  t: (text: string, vars?: Record<string, string | number>) => string,
) {
  return book.dm
    ? t("Buscar na conversa")
    : book.title
      ? t("Buscar em {room}", { room: book.title })
      : t("Buscar nesta sala");
}
