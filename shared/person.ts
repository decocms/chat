// The Person DO's /ws-me notices, sent as JSON-RPC notifications. Browser-safe; the literal msg:1 is a flag,
// not a message ID. Keep this independent of room/Worker implementations.
import * as z from "zod/mini";
import { decodeCall } from "./jsonRpc";
export const PersonEventSchemas = {
  me: z.object({
    t: z.literal("me"),
    book: z.optional(z.string()),
    msg: z.optional(z.literal(1)),
  }),
  agents: z.object({ t: z.literal("agents"), book: z.string() }),
  focus: z.object({ t: z.literal("focus"), book: z.string() }),
  /** Who of your DM contacts has the app open (src/person.ts). `all: 1` is the full list a new socket gets first:
   *  it replaces what the app knew. Without it, only the people listed changed. */
  presence: z.object({
    t: z.literal("presence"),
    people: z.array(z.object({ email: z.string(), online: z.boolean() })),
    all: z.optional(z.literal(1)),
  }),
};
export const PersonEventSchema = z.discriminatedUnion("t", [
  PersonEventSchemas.me,
  PersonEventSchemas.agents,
  PersonEventSchemas.focus,
  PersonEventSchemas.presence,
]);
export type PersonEvent = z.infer<typeof PersonEventSchema>;
/** Accept raw WebSocket event.data only: a JSON-RPC notification, method = t (shared/jsonRpc.ts). Binary, non-JSON
 *  and unknown notices are ignored. */
export function parsePersonEvent(data: unknown): PersonEvent | null {
  if (typeof data !== "string") return null;
  const call = decodeCall(data);
  if (!call.ok || call.id !== undefined) return null;
  const parsed = PersonEventSchema.safeParse(call.message);
  return parsed.success ? parsed.data : null;
}
