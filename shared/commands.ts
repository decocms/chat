import * as z from "zod/mini";
import { EPIC_STATUSES, TASK_STATUSES, SuggestionSchema } from "./room";

// Commands accepted by Book.webSocketMessage: the runtime schemas are the source, the TypeScript type is derived
// from them. On the wire each command is a JSON-RPC call, method = t (shared/jsonRpc.ts). Authentication and every business rule stay on the server. Browser-safe: zod/mini only.
const id = z.string();
const num = z.number();
/** A send's client_id: a random id (crypto.randomUUID()) made once per send and sent again on each retry of it. */
export const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
export const ClientIdSchema = z.string().check(z.regex(CLIENT_ID_PATTERN));
export const RoomCommandSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("msg"),
    thread: z.string(),
    text: z.optional(z.string()),
    files: z.optional(z.array(z.string())),
    reply_to: z.optional(z.nullable(num)),
    viewing: z.optional(z.string()), // the file open beside the chat (#2408)
    // The same on each retry of this send: the room answers a retry with the first message (Book.byClientId).
    client_id: z.optional(ClientIdSchema),
  }),
  z.object({ t: z.literal("files.get") }),
  z.object({
    t: z.literal("doc.get"),
    epic: z.optional(z.nullable(z.string())),
  }),
  z.object({
    t: z.literal("doc"),
    text: z.string(),
    epic: z.optional(z.nullable(z.string())),
  }),
  // Doc versions (Gui #2666): the list for a doc (epic, or none for the room's), then one version's text.
  z.object({
    t: z.literal("doc.versions"),
    epic: z.optional(z.nullable(z.string())),
  }),
  z.object({ t: z.literal("doc.version"), id: num }),
  // Old tabs still send it (the automatic card, removed for brief.ask): accepted and ignored.
  z.object({
    t: z.literal("needs.summary"),
    thread: z.string(),
    items: z.array(z.string()),
  }),
  // "O que precisa de mim aqui" (Gui #3011): asks your own Claude; brief.dismiss drops one of yours.
  z.object({ t: z.literal("brief.ask"), thread: z.string() }),
  z.object({ t: z.literal("brief.dismiss"), id: num }),
  z.object({ t: z.literal("title"), title: z.string() }),
  // A new thread (Gimenes #4123): from a message (`from`), or from the sidebar. The client may pick its id, so it can
  // open it and a retry with the same id does not make a second one.
  z.object({
    t: z.literal("epic"),
    title: z.string(),
    from: z.optional(num),
    id: z.optional(z.string().check(z.regex(/^[0-9a-f]{8}$/))),
  }),
  z.object({ t: z.literal("epic.owner"), id, owner: z.string() }),
  z.object({ t: z.literal("task.add"), epic: z.string(), title: z.string() }),
  z.object({
    t: z.literal("older"),
    thread: z.string(),
    before: z.optional(num),
  }),
  z.object({
    t: z.literal("pin.add"),
    kind: z.enum(["link", "live", "file", "app"]),
    ref: z.string(),
    title: z.optional(z.string()),
  }),
  z.object({ t: z.literal("pin.del"), id }),
  z.object({ t: z.literal("reminder.delete"), id }),
  z.object({ t: z.literal("ack.dismiss"), id: num }),
  // Toggle your emoji reaction on a message (Gui #2724).
  z.object({ t: z.literal("react"), id: num, emoji: z.string() }),
  // Edit or delete a message (Gui #4276): the author edits, the author or the room owner deletes; the owner reads
  // the earlier versions with msg.history (answered with the "history" event to that tab only).
  z.object({ t: z.literal("msg.edit"), id: num, text: z.string() }),
  z.object({ t: z.literal("msg.delete"), id: num }),
  z.object({ t: z.literal("msg.history"), id: num }),
  z.object({ t: z.literal("reminder.enable"), id, on: z.boolean() }),
  z.object({ t: z.literal("task.toggle"), id }),
  // from: "composer" is the follow-up above the composer (a task of yours in review), tracked as review_answer.
  z.object({
    t: z.literal("task.status"),
    id,
    status: z.enum(TASK_STATUSES),
    from: z.optional(z.literal("composer")),
  }),
  z.object({ t: z.literal("task.rename"), id, title: z.string() }),
  z.object({ t: z.literal("task.del"), id }),
  z.object({
    t: z.literal("task.assign"),
    id,
    owner: z.optional(z.string()),
    due: z.optional(z.string()),
  }),
  z.object({ t: z.literal("decision.del"), id: num }),
  // The room's call (src/calls.ts): leave it; the bytes this browser received since its last report.
  z.object({ t: z.literal("call.leave") }),
  z.object({ t: z.literal("call.usage"), bytes: num }),
  z.object({ t: z.literal("call.mute"), muted: z.boolean() }),
  z.object({ t: z.literal("epic.rename"), id, title: z.string() }),
  z.object({ t: z.literal("epic.del"), id }),
  z.object({
    t: z.literal("epic.done"),
    id,
    done: z.optional(z.boolean()),
  }),
  // The epic bar's status menu: "done" and "dismissed" mark it done, the open ones reopen it (Book.setEpicStatus).
  z.object({ t: z.literal("epic.status"), id, status: z.enum(EPIC_STATUSES) }),
  z.object({ t: z.literal("epic.order"), ids: z.array(z.string()) }),
  z.object({ t: z.literal("epic.pin"), id: z.string(), pinned: z.boolean() }),
  z.object({
    t: z.literal("poll.create"),
    thread: z.string(),
    question: z.string(),
    options: z.array(z.string()),
    multi: z.boolean(),
  }),
  z.object({ t: z.literal("vote"), id, opt: num }),
  z.object({ t: z.literal("poll.close"), id }),
  z.object({
    t: z.literal("suggestion"),
    i: num,
    expected: z.optional(SuggestionSchema),
    accept: z.optional(z.boolean()),
  }),
]);
export type RoomCommand = z.infer<typeof RoomCommandSchema>;

/** True only means the command was queued on an open socket. */
export type SendRoomCommand = (command: RoomCommand) => boolean;

/** What a room request resolves with. On the wire a command that wants an answer is a JSON-RPC request; the room
 *  answers with a result (ok) or an error (ok: false, the message says why). See shared/jsonRpc.ts. */
export type CommandOutcome = { ok: true } | { ok: false; error: string };
