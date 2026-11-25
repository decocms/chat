// Where each link to this app goes, for its chip (AppLinkChip.svelte): from the open room's own state when the link
// is to a message or thread it has, else one GET /api/books/:id/link per place, kept for the page's life. A failed
// request is not kept, so the next render of that link asks again.
import { SvelteMap } from "svelte/reactivity";
import { client } from "../../lib/client/api";
import type { FetchLike } from "../../app/transport";
import { LinkResolution } from "../../../shared/schemas";
import { CALL_THREAD } from "../../../shared/call";
import type { Room } from "../../../shared/room";
import { messageById, visibleMessage } from "../chat/privacy";
import { appLinkKey, type AppLink } from "./appLinks";

const PRIVATE: LinkResolution = { kind: "private" };
const fallbackName = (email: string) =>
  email === "ai" ? "vibe" : email.split("@")[0] || email;

/** The answer from the open room's state, without a request; null = the room's state doesn't have it (another room,
 *  a message not loaded, the room itself, whose icon only the server has). */
export function localLink(room: Room, link: AppLink): LinkResolution | null {
  if (link.room !== room.id) return null;
  const name = (email: string) => room.names?.[email] || fallbackName(email);
  const threadTitle = (thread: string) =>
    thread === "main"
      ? null
      : (room.epics.find((epic) => epic.id === thread)?.title ?? null);
  if (link.message !== undefined) {
    const message = messageById(room, link.message);
    if (!message) return null;
    if (
      !visibleMessage(room, message) ||
      (link.thread && link.thread !== message.thread) ||
      (message.thread === CALL_THREAD && room.book.dm)
    )
      return PRIVATE;
    return {
      kind: "message",
      room: room.id,
      id: message.id,
      thread: message.thread,
      author: message.author,
      name: name(message.author),
      avatar: room.avatars?.[message.author] ?? null,
      threadTitle: threadTitle(message.thread),
      roomTitle: room.book.title,
    };
  }
  if (link.thread === CALL_THREAD)
    return room.book.dm
      ? PRIVATE
      : {
          kind: "thread",
          room: room.id,
          thread: CALL_THREAD,
          title: "",
          owner: null,
          ownerName: null,
        };
  if (link.thread) {
    const epic = room.epics.find((epic) => epic.id === link.thread);
    if (!epic) return null;
    return {
      kind: "thread",
      room: room.id,
      thread: epic.id,
      title: epic.title,
      owner: epic.owner ?? null,
      ownerName: epic.owner ? name(epic.owner) : null,
    };
  }
  return null;
}

export type LinkState =
  { status: "loading" } | { status: "ready"; value: LinkResolution };

export function createLinkResolver(fetcher?: FetchLike) {
  const api = client("/", fetcher).api.books[":id"];
  const answers = new SvelteMap<string, LinkResolution>();
  const asking = new Set<string>();
  async function ask(key: string, link: AppLink) {
    try {
      const response = await api.link.$get(
        {
          param: { id: encodeURIComponent(link.room) },
          query: {
            ...(link.thread ? { t: link.thread } : {}),
            ...(link.message !== undefined ? { m: link.message } : {}),
          },
        },
        { init: { cache: "no-store" } },
      );
      if (!response.ok) return;
      const answer = LinkResolution.safeParse(await response.json());
      if (answer.success) answers.set(key, answer.data);
    } catch {
      /* Offline or a network error: the link stays a plain link. */
    } finally {
      asking.delete(key);
    }
  }
  return {
    /** Reactive read: the answer when known, else null (the chip shows the plain link meanwhile). */
    read(link: AppLink, room: Room | null): LinkState {
      const local = room ? localLink(room, link) : null;
      if (local) return { status: "ready", value: local };
      const known = answers.get(appLinkKey(link));
      return known ? { status: "ready", value: known } : { status: "loading" };
    },
    /** Ask the server once for a link the room's state can't answer. Call from an effect, not while rendering. */
    request(link: AppLink, room: Room | null) {
      if (room && localLink(room, link)) return;
      const key = appLinkKey(link);
      if (answers.has(key) || asking.has(key)) return;
      asking.add(key);
      void ask(key, link);
    },
  };
}
export type LinkResolver = ReturnType<typeof createLinkResolver>;
/** One cache for the page: the same link in many messages asks once. */
export const linkResolver = createLinkResolver();
