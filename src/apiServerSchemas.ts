import "server-only";
import * as z from "zod/mini";

// Input and database validators used only by the actual API handlers. No browser DTO or barrel re-export.
/** Upload headers: the file's media type and its name (URI-encoded, the x-filename header). */
export const UploadHeaders = z.object({
  "content-type": z.string(),
  "x-filename": z.optional(z.string()),
});

const num = z.nullable(z.number());
const str = z.nullable(z.string());
/** One agents row as D1 returns it (parsed on the server before it becomes a RoomAgent). */
export const AgentDbRow = z.object({
  email: z.string(),
  who: str,
  repo: str,
  seen_at: num,
  listening_at: num,
  listen_room: str,
  listen_title: z.optional(str),
  ctx_tokens: num,
  ctx_window: num,
  ctx_at: num,
  ctx_limits: str,
  id: z.string(),
  client: str,
  machine_id: str,
  delivers: num,
});
/** One of your machines as D1 returns it. */
export const MachineDbRow = z.object({
  id: z.string(),
  name: str,
  kind: str,
  seen_at: num,
  on_: num,
});
