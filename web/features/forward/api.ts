import { client } from "../../lib/client/api";
import type { FetchLike } from "../../app/transport";
import type { ForwardedBody } from "../../../shared/schemas";
import type * as z from "zod/mini";

/** The `messages_forwarded` event (counts only). It never blocks the forward: a failure is ignored. */
export function reportForward(
  roomId: string,
  body: z.infer<typeof ForwardedBody>,
  fetcher?: FetchLike,
) {
  void client("/", fetcher)
    .api.books[":id"].forwarded.$post({
      param: { id: encodeURIComponent(roomId) },
      json: body,
    })
    .catch(() => {});
}
