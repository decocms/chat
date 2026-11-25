import type { MeResult, SearchResult } from "../../../shared/schemas";
import type { Room } from "../../../shared/room";
import { dmEntry, fold, roomIcon, searchRooms } from "../home/model";

/** Where a forward can go: a room's main thread, a DM, or a thread of a room. */
export type ForwardDestination = Readonly<{
  key: string;
  group: "here" | "rooms" | "dms" | "threads";
  roomId: string;
  thread: string;
  title: string;
  /** The room of a thread, or the folder of a room. */
  detail: string;
  /** A room's icon URL. */
  icon?: string;
  /** A DM: the other person (you in "Você"). */
  person?: Readonly<{ email: string; version?: number | null }>;
  dm: boolean;
}>;
/** The threads of the open room that the picker lists before you type. */
export const FORWARD_THREADS = 30;

/**
 * The destinations the picker lists for a query, in the order of its groups: the open room (its main thread and its
 * open threads, the newest first), your other rooms, your DMs. Threads of other rooms come from the search
 * (`searchThreads`). The words "Sala principal" and "Você" come from the caller, in the app's language.
 */
export function forwardDestinations(
  me: MeResult | null,
  room: Room,
  query: string,
  words: Readonly<{ main: string; you: string }>,
): ForwardDestination[] {
  const q = fold(query.trim());
  const match = (...values: readonly string[]) =>
    !q || values.some((value) => fold(value).includes(q));
  const here = roomLabel(me, room.id, room.book.title, words.you);
  const book = me?.books.find((value) => value.id === room.id);
  const own: ForwardDestination[] = [
    {
      key: `${room.id}:main`,
      group: "here" as const,
      roomId: room.id,
      thread: "main",
      title: room.book.dm ? here : words.main,
      detail: room.book.dm ? "" : here,
      icon: book ? roomIcon(book) : undefined,
      person: personOf(me, room.id),
      dm: !!room.book.dm,
    },
    ...room.epics
      .filter((epic) => !epic.done)
      .sort((a, b) => (b.last ?? 0) - (a.last ?? 0))
      .slice(0, FORWARD_THREADS)
      .map((epic): ForwardDestination => ({
        key: `${room.id}:${epic.id}`,
        group: "here",
        roomId: room.id,
        thread: epic.id,
        title: epic.title,
        detail: here,
        dm: !!room.book.dm,
      })),
  ].filter((value) => match(value.title, value.detail));
  const others = searchRooms(me?.books ?? [], query)
    .filter((value) => value.id !== room.id)
    .map((value): ForwardDestination => {
      const dm = value.dm ? dmEntry(me, value.id) : undefined;
      return {
        key: `${value.id}:main`,
        group: value.dm ? "dms" : "rooms",
        roomId: value.id,
        thread: "main",
        title: dm
          ? dm.self
            ? words.you
            : dm.name
          : (value.title ?? "deco.chat"),
        detail: dm ? "" : (value.folder ?? ""),
        icon: roomIcon(value),
        person: dm ? { email: dm.email, version: dm.version } : undefined,
        dm: !!value.dm,
      };
    });
  // "Você" (your own DM) before anyone types: the server lists it only once someone wrote in it.
  const self = me && !q ? dmEntry(me, me.dm) : undefined;
  if (
    self &&
    self.room.id !== room.id &&
    !others.some((value) => value.roomId === self.room.id)
  )
    others.push({
      key: `${self.room.id}:main`,
      group: "dms",
      roomId: self.room.id,
      thread: "main",
      title: words.you,
      detail: "",
      person: { email: self.email, version: self.version },
      dm: true,
    });
  return [...own, ...others];
}

/** Threads of your other rooms that match the search (the open room's threads are already listed). */
export function searchThreads(
  result: SearchResult,
  room: string,
): ForwardDestination[] {
  return result.epics
    .filter((epic) => epic.room_id !== room && !epic.done)
    .map((epic) => ({
      key: `${epic.room_id}:${epic.id}`,
      group: "threads",
      roomId: epic.room_id,
      thread: epic.id,
      title: epic.title,
      detail: epic.room,
      dm: false,
    }));
}

function personOf(me: MeResult | null, roomId: string) {
  const dm = dmEntry(me, roomId);
  return dm ? { email: dm.email, version: dm.version } : undefined;
}
function roomLabel(
  me: MeResult | null,
  roomId: string,
  title: string,
  you: string,
) {
  const dm = dmEntry(me, roomId);
  return dm ? (dm.self ? you : dm.name) : title;
}
