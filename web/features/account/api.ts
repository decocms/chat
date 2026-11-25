import { client } from "../../lib/client/api";
import {
  AccessRequestResult,
  AvatarResult,
  OrgRoomsResult,
  OrgDirectoryResult,
  ConnectResult,
  ErrorBody,
  LoginsResult,
  OkResult,
  SetNameResult,
} from "../../../shared/schemas";
import type { FetchLike } from "../../app/transport";
export class AccountFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function read<T>(
  response: { ok: boolean; status: number; json(): Promise<unknown> },
  schema: { parse(input: unknown): T },
): Promise<T> {
  const value: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorBody.safeParse(value);
    throw new AccountFailure(
      error.success ? error.data.error : `HTTP ${response.status}`,
      response.status,
    );
  }
  try {
    return schema.parse(value);
  } catch {
    throw Error("invalid-response");
  }
}
export function createAccountApi(fetcher?: FetchLike) {
  const api = client("/", fetcher).api;
  return {
    logins: (signal: AbortSignal) =>
      api.me.logins
        .$get({}, { init: { signal, cache: "no-store" } })
        .then((response) => read(response, LoginsResult)),
    name: (name: string, signal: AbortSignal) =>
      api.me
        .$post({ json: { name } }, { init: { signal } })
        .then((response) => read(response, SetNameResult)),
    avatar: (body: Blob, signal: AbortSignal) =>
      api.me.avatar
        .$post(
          { header: { "content-type": "image/jpeg" } },
          { init: { body, signal } },
        )
        .then((response) => read(response, AvatarResult)),
    /** Write to someone: `id` = the DM is open now; none = it went as a message request (src/services.ts connect). */
    connect: (email: string, text: string | undefined, signal: AbortSignal) =>
      api.friends
        .$post({ json: { email, text } }, { init: { signal } })
        .then((response) => read(response, ConnectResult)),
    /** Decline their message request, or cancel yours. */
    dismiss: (email: string, signal: AbortSignal) =>
      api.friends[":email"]
        .$delete(
          { param: { email: encodeURIComponent(email) } },
          { init: { signal } },
        )
        .then((response) => read(response, OkResult)),
    /** Your answer to a room invite. */
    answerInvite: (room: string, yes: boolean, signal: AbortSignal) =>
      api.books[":id"].invite
        .$post(
          { param: { id: encodeURIComponent(room) }, json: { yes } },
          { init: { signal } },
        )
        .then((response) => read(response, OkResult)),
    /** The rooms open to your company domain that you did not join (the home's "Da sua empresa"). */
    orgRooms: (signal: AbortSignal) =>
      api.org.rooms
        .$get({}, { init: { signal, cache: "no-store" } })
        .then((response) => read(response, OrgRoomsResult)),
    /** Every room open to your company domain, the ones you are in marked (the rail's "Salas da empresa"). */
    orgDirectory: (signal: AbortSignal) =>
      api.org.directory
        .$get({}, { init: { signal, cache: "no-store" } })
        .then((response) => read(response, OrgDirectoryResult)),
    /** Join a room open to your company: asking lets you in at once (src/orgRooms.ts requestAccess). */
    joinOrg: (room: string, signal: AbortSignal) =>
      api.books[":id"].request
        .$post(
          { param: { id: encodeURIComponent(room) } },
          { init: { signal } },
        )
        .then((response) => read(response, AccessRequestResult)),
  };
}
export type AccountApi = ReturnType<typeof createAccountApi>;
