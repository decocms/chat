import { client } from "../../lib/client/api";
import type { FetchLike } from "../../transport";
import {
  FireResult,
  ErrorBody,
  UNAUTHENTICATED,
  type FireBody,
} from "../../../shared/schemas";
export class FireFailure extends Error {
  constructor(
    readonly status: number,
    readonly unauthenticated = false,
    readonly membershipDenied = false,
  ) {
    super("Fire request failed");
  }
}
export function createFireApi(fetcher?: FetchLike) {
  const api = client("/", fetcher).api.books[":id"].fire;
  return async (roomId: string, body: FireBody, signal: AbortSignal) => {
    const response = await api.$post(
      { param: { id: encodeURIComponent(roomId) }, json: body },
      { init: { signal, cache: "no-store" } },
    );
    return readFireResponse(response);
  };
}
type FireResponse = { ok: boolean; status: number; json(): Promise<unknown> };
async function readFireResponse(response: FireResponse) {
  const raw: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = ErrorBody.safeParse(raw);
    throw new FireFailure(
      response.status,
      response.status === 401 &&
        error.success &&
        error.data.error === UNAUTHENTICATED.error,
      response.status === 403 &&
        error.success &&
        error.data.error === "forbidden",
    );
  }
  try {
    return FireResult.parse(raw);
  } catch {
    throw new FireFailure(0);
  }
}
