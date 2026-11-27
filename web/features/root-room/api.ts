import { client } from "../../lib/client/api";
import type { FetchLike } from "../../app/transport";
import { MessagesPage } from "../../../shared/schemas";
import { RoomEventSchemas, type RoomStateEvent } from "../../../shared/events";

/** GET /api/books/:id/messages (cache plan, PR 1): a page of a thread over HTTP, the same page the socket's
 *  "older" sends. GET /api/books/:id/room: the room's snapshot, the `state` that a socket without lite sends.
 *  null = no answer (offline, signed out, not a member, a bad answer): the caller falls back to the socket. */
export function createMessagesApi(fetcher?: FetchLike) {
  const api = client("/", fetcher).api.books[":id"];
  return {
    async page(
      roomId: string,
      query: {
        thread: string;
        before?: number;
        after?: number;
        limit?: number;
      },
    ): Promise<MessagesPage | null> {
      try {
        const response = await api.messages.$get(
          {
            param: { id: encodeURIComponent(roomId) },
            query: {
              thread: query.thread,
              limit: String(query.limit ?? 100),
              ...(query.before ? { before: query.before } : {}),
              ...(query.after !== undefined ? { after: query.after } : {}),
            },
          },
          { init: { cache: "no-store" } },
        );
        if (!response.ok) return null;
        const page = MessagesPage.safeParse(await response.json());
        return page.success ? page.data : null;
      } catch {
        return null;
      }
    },
    async room(
      roomId: string,
      query: {
        thread: string;
        resume?: { since: number; at: number; eh?: string };
      },
    ): Promise<RoomStateEvent | null> {
      try {
        const resume = query.resume;
        const response = await api.room.$get(
          {
            param: { id: encodeURIComponent(roomId) },
            query: {
              t: query.thread,
              // The room merges a resume's threads by id (Book.epicsDelta).
              ed: "1",
              ...(resume
                ? {
                    since: resume.since,
                    at: resume.at,
                    ...(resume.eh ? { eh: resume.eh } : {}),
                  }
                : {}),
            },
          },
          { init: { cache: "no-store" } },
        );
        if (!response.ok) return null;
        // As the socket does (isRoomEvent): the event is checked, then passed on as sent (extra keys stay).
        const state: unknown = await response.json();
        return RoomEventSchemas.state.safeParse(state).success
          ? (state as RoomStateEvent)
          : null;
      } catch {
        return null;
      }
    },
  };
}
export type MessagesApi = ReturnType<typeof createMessagesApi>;
