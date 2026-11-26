import { client } from "../../lib/client/api";
import { ErrorBody, OkResult, RoomOrgResult } from "../../../shared/schemas";
import type { PeopleAction } from "./model";
export type PeopleRequest = (
  action: PeopleAction,
  email: string,
) => Promise<void>;
/** "Aberta pra @<domain>": read and set whether the room is open to your company email domain. */
export function createRoomOrgApi(
  roomId: string,
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  const room = client("/", fetcher).api.books[":id"].org;
  const param = { id: encodeURIComponent(roomId) };
  const read = async (response: {
    ok: boolean;
    status: number;
    json(): Promise<unknown>;
  }) => {
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ErrorBody.safeParse(value);
      throw new Error(
        error.success ? error.data.error : `HTTP ${response.status}`,
      );
    }
    return RoomOrgResult.parse(value);
  };
  return {
    get: (signal?: AbortSignal) =>
      room.$get({ param }, { init: { signal, cache: "no-store" } }).then(read),
    set: (open: boolean) => room.$post({ param, json: { open } }).then(read),
  };
}
/** Request and response shapes come from the validated Worker routes; the server owns authorization. */
export function createPeopleRequest(
  roomId: string,
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): PeopleRequest {
  const room = client("/", fetcher).api.books[":id"];
  const id = encodeURIComponent(roomId);
  return async (action, email) => {
    const response =
      action === "remove"
        ? await room.members[":email"].$delete({
            param: { id, email: encodeURIComponent(email) },
          })
        : action === "approve" || action === "deny"
          ? await room.requests.$post({
              param: { id },
              json: { email, ok: action === "approve" },
            })
          : await room.members.$post({ param: { id }, json: { email } });
    const value: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const error = ErrorBody.safeParse(value);
      throw new Error(
        error.success ? error.data.error : `HTTP ${response.status}`,
      );
    }
    if (!OkResult.safeParse(value).success)
      throw new Error("Invalid people response");
  };
}
