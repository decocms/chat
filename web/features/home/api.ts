import { client } from "../../lib/client/api";
import { createRoomApi, type FetchLike } from "../../app/transport";
import { mediaType } from "../composer/model";
import {
  AgentGrantsResult,
  InboxResult,
  ArchivedResult,
  ErrorBody,
  MeResult,
  OkResult,
  type PostMessageBody,
  RoomIconResult,
  RouteResult,
  SearchResult,
  StartRoomResult,
  TINTS,
} from "../../../shared/schemas";
export type RoomTint = (typeof TINTS)[number] | null;
export class HomeFailure extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}
type Answer = { ok: boolean; status: number; json(): Promise<unknown> };
async function read<T>(
  response: Answer,
  schema: { parse(value: unknown): T },
): Promise<T> {
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorBody.safeParse(value);
    throw new HomeFailure(
      error.success ? error.data.error : `HTTP ${response.status}`,
      response.status,
    );
  }
  try {
    return schema.parse(value);
  } catch {
    throw new HomeFailure("invalid-response");
  }
}
export function createHomeApi(fetcher?: FetchLike) {
  const api = client("/", fetcher).api,
    room = api.books[":id"];
  const param = (id: string) => ({ id: encodeURIComponent(id) });
  return {
    inbox: (signal?: AbortSignal) =>
      api.inbox
        .$get({}, { init: { signal, cache: "no-store" } })
        .then((response) => read(response, InboxResult)),
    me: (signal?: AbortSignal) =>
      api.me
        .$get({ query: {} }, { init: { signal } })
        .then((response) => read(response, MeResult)),
    archived: (signal?: AbortSignal) =>
      api.archived
        .$get({}, { init: { signal } })
        .then((response) => read(response, ArchivedResult)),
    search: (q: string, signal?: AbortSignal) =>
      api.search
        .$get({ query: { q } }, { init: { signal } })
        .then((response) => read(response, SearchResult)),
    route: (text: string, signal?: AbortSignal) =>
      api.route
        .$post({ json: { text } }, { init: { signal } })
        .then((response) => read(response, RouteResult)),
    startRoom: (text: string, signal?: AbortSignal) =>
      api.books.start
        .$post({ json: { text } }, { init: { signal } })
        .then((response) => read(response, StartRoomResult)),
    /** `extra`: sent from the ask box (routed), with files already uploaded to this room and a poll after it. */
    post: (
      id: string,
      text: string,
      thread: string,
      clientId?: string,
      extra: Pick<PostMessageBody, "routed" | "files" | "poll"> = {},
    ) =>
      createRoomApi(id, fetcher).postMessage({
        text,
        thread,
        client_id: clientId,
        ...(extra.routed ? { routed: true } : {}),
        ...(extra.files?.length ? { files: extra.files } : {}),
        ...(extra.poll ? { poll: extra.poll } : {}),
      }),
    /** One file into a room, as the room's composer uploads it (POST /api/books/:id/files). */
    upload: (id: string, file: File, signal?: AbortSignal) =>
      createRoomApi(id, (url, init) =>
        (fetcher ?? fetch)(url, { ...init, signal }),
      ).uploadFile({ name: file.name, type: mediaType(file.type), body: file }),
    archive: (id: string, archived: boolean, signal?: AbortSignal) =>
      room.archive
        .$post({ param: param(id), json: { archived } }, { init: { signal } })
        .then((response) => read(response, OkResult)),
    /** "Sair da sala": you take yourself out of the room (POST /api/books/:id/leave). */
    leave: (id: string, signal?: AbortSignal) =>
      room.leave
        .$post({ param: param(id) }, { init: { signal } })
        .then((response) => read(response, OkResult)),
    read: (id: string, signal?: AbortSignal) =>
      room.read
        .$post({ param: param(id) }, { init: { signal } })
        .then((response) => read(response, OkResult)),
    order: (ids: string[], signal?: AbortSignal) =>
      api.rooms.order
        .$post({ json: { ids } }, { init: { signal } })
        .then((response) => read(response, OkResult)),
    tint: (id: string, tint: RoomTint, signal?: AbortSignal) =>
      room.tint
        .$post({ param: param(id), json: { tint } }, { init: { signal } })
        .then((response) => read(response, OkResult)),
    icon: (id: string, bytes: Blob | null, signal?: AbortSignal) =>
      room.icon
        .$post(
          {
            param: param(id),
            header: {
              "content-type": bytes ? "image/png" : "application/json",
            },
          },
          { init: { signal, body: bytes ?? "{}" } },
        )
        .then((response) => read(response, RoomIconResult)),
    resolve: (book_id: string, ref: string, signal?: AbortSignal) =>
      api.waits.resolve
        .$post({ json: { book_id, ref } }, { init: { signal } })
        .then((response) => read(response, OkResult)),
    /** "Marcar como feita" on an open thread of yours, from the Inbox. */
    threadDone: (book_id: string, epic: string, signal?: AbortSignal) =>
      room.threads[":epic"].done
        .$post(
          { param: { ...param(book_id), epic: encodeURIComponent(epic) } },
          { init: { signal } },
        )
        .then((response) => read(response, OkResult)),
    resolveMany: (
      items: { book_id: string; ref: string }[],
      signal?: AbortSignal,
    ) =>
      api.waits["resolve-many"]
        .$post({ json: { items } }, { init: { signal } })
        .then((response) => read(response, OkResult)),
    agents: (signal?: AbortSignal) =>
      api.agents
        .$get({}, { init: { signal } })
        .then((response) => read(response, AgentGrantsResult)),
  };
}
export type HomeApi = ReturnType<typeof createHomeApi>;
