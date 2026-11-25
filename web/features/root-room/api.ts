import { client } from "../../lib/client/api";
import type { FetchLike } from "../../app/transport";
import { MessagesPage } from "../../../shared/schemas";

/** GET /api/books/:id/messages (cache plan, PR 1): a page of a thread over HTTP, the same page the socket's
 *  "older" sends. null = no page (offline, signed out, not a member, a bad answer): the caller falls back. */
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
  };
}
export type MessagesApi = ReturnType<typeof createMessagesApi>;
