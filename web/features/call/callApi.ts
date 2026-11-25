import { client } from "../../lib/client/api";
import type { FetchLike } from "../../app/transport";
import {
  CallJoinResult,
  CallSfuResult,
  type CallDescription,
  type CallTracksBody,
} from "../../../shared/schemas";

/** The room's call routes (src/calls.ts): the browser's WebRTC negotiation with the SFU goes through the Worker. */
export function createCallApi(fetcher?: FetchLike) {
  const api = client("/", fetcher).api.books[":id"].call;
  const param = (roomId: string) => ({ id: encodeURIComponent(roomId) });
  const fail = (step: string, status: number) =>
    new Error(`call ${step} ${status}`);
  return {
    /** `thread`: the thread that the person has open (the server no longer uses it: a new call gets its own thread). */
    async join(roomId: string, thread: string) {
      const response = await api.join.$post({
        param: param(roomId),
        query: { thread },
      });
      if (!response.ok) throw fail("join", response.status);
      return CallJoinResult.parse(await response.json()).session;
    },
    /** "limit": the screen share was refused, the month's traffic budget is spent. */
    async tracks(roomId: string, json: CallTracksBody) {
      const response = await api.tracks.$post({ param: param(roomId), json });
      if (response.status === 409) return "limit" as const;
      if (!response.ok) throw fail("tracks", response.status);
      return CallSfuResult.parse(await response.json());
    },
    async answer(roomId: string, session: string, answer: CallDescription) {
      const response = await api.answer.$post({
        param: param(roomId),
        json: { session, answer },
      });
      if (!response.ok) throw fail("answer", response.status);
    },
    async close(
      roomId: string,
      session: string,
      mids: string[],
      names: string[] = [],
    ) {
      const response = await api.close.$post({
        param: param(roomId),
        json: { session, mids, names },
      });
      if (!response.ok) throw fail("close", response.status);
    },
  };
}
export type CallApi = ReturnType<typeof createCallApi>;
