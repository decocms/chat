// Room events the Book sends over the WebSocket (M1): one schema per `t`, the RoomEvent type is derived from them.
// Browser-safe: zod/mini only. A valid event is passed on as sent (extra keys are ignored, as before).
import * as z from "zod/mini";
import { CommandResultSchema } from "./commands";
import {
  AccessRequestSchema,
  AckSchema,
  AttachmentSchema,
  DecisionSchema,
  EpicSchema,
  MessageSchema,
  PinSchema,
  PollSchema,
  ReceiptSchema,
  ReminderSchema,
  RoomSnapshotSchema,
  SuggestionSchema,
  TaskSchema,
} from "./room";

const str = z.string();
const num = z.number();
const strings = z.array(str);
const event = <T extends string, S extends z.core.$ZodLooseShape>(
  t: T,
  shape: S,
) => z.object({ t: z.literal(t), ...shape });

const DocumentContentSchema = event("doc", {
  text: str,
  epic: z.optional(z.nullable(str)),
  stale: z.optional(z.literal(false)),
  fetched: z.optional(z.boolean()),
  by: z.optional(str),
});
/** "That epic's doc changed, fetch it" (no text, never fetched). */
const DocumentInvalidationSchema = event("doc", {
  epic: str,
  stale: z.literal(true),
  by: z.optional(str),
  text: z.optional(z.never()),
  fetched: z.optional(z.never()),
});
export type DocumentContentEvent = z.infer<typeof DocumentContentSchema>;
export type DocumentInvalidationEvent = z.infer<
  typeof DocumentInvalidationSchema
>;

export const RoomEventSchemas = {
  state: z.extend(RoomSnapshotSchema, { t: z.literal("state") }),
  msg: event("msg", { m: MessageSchema }),
  moved: event("moved", { id: num, thread: str }),
  // A message's card replaced (Modo Fire updates its live card): the app redraws that message.
  msgCard: event("msgCard", { id: num, card: str }),
  delta: event("delta", { id: num, text: str }),
  typing: event("typing", { id: num, mode: str, note: z.optional(str) }),
  closed: event("closed", { id: num, choices: str }),
  epics: event("epics", {
    epics: z.array(EpicSchema),
    roomTasks: z.optional(z.array(TaskSchema)),
  }),
  epicsPatch: event("epicsPatch", {
    changed: z.array(EpicSchema),
    order: strings,
    roomTasks: z.optional(z.array(TaskSchema)),
  }),
  doc: z.union([DocumentInvalidationSchema, DocumentContentSchema]),
  docNotes: event("docNotes", { notes: strings }),
  // Doc versions (Gui #2666), answers to doc.versions / doc.version: epic = its id, or "" for the room's doc.
  docVersions: event("docVersions", {
    epic: str,
    versions: z.array(
      z.object({ id: num, by: strings, msg_id: num, ts: num, size: num }),
    ),
    pending: z.boolean(),
  }),
  needsSummary: event("needsSummary", { thread: str, key: str, text: str }),
  docVersion: event("docVersion", {
    id: num,
    epic: str,
    text: str,
    by: strings,
    msg_id: num,
    ts: num,
  }),
  meta: event("meta", {
    title: z.optional(str),
    folder: z.optional(str),
    summary: z.optional(str),
  }),
  suggestions: event("suggestions", { suggestions: z.array(SuggestionSchema) }),
  requests: event("requests", { requests: z.array(AccessRequestSchema) }),
  members: event("members", {
    members: strings,
    pending: z.optional(strings),
    invited: z.optional(strings),
    declined: z.optional(strings),
    requests: z.optional(z.array(AccessRequestSchema)),
    names: z.optional(z.record(str, str)),
    avatars: z.optional(z.record(str, num)),
  }),
  files: event("files", { files: z.array(AttachmentSchema) }),
  fileAdd: event("fileAdd", { file: AttachmentSchema }),
  // An agent opened this file beside the chat for its human (MCP open_file): sent only to that person's tabs.
  openSide: event("openSide", { file: AttachmentSchema }),
  // An agent opened an app for its human (MCP app_open; a room app it just uploaded): ref = "<connection>/<tool>" or "room/<name>".
  // auto = a room app the agent just uploaded (never switches the screen to Apps; only redraws/scrolls a doc that embeds it).
  openApp: event("openApp", { ref: str, auto: z.optional(z.boolean()) }),
  // An agent opened a doc beside the chat for its human (MCP open_doc): epic = its id, or "" for the room's doc.
  openDoc: event("openDoc", { epic: str }),
  reminders: event("reminders", { reminders: z.array(ReminderSchema) }),
  decisions: event("decisions", { decisions: z.array(DecisionSchema) }),
  pins: event("pins", { pins: z.array(PinSchema) }),
  receipts: event("receipts", { receipts: z.array(ReceiptSchema) }),
  older: event("older", {
    messages: z.array(MessageSchema),
    thread: str,
    more: z.boolean(),
  }),
  acks: event("acks", { acks: z.array(AckSchema) }),
  // A message's reactions changed: the whole map for that message (empty = none left).
  reactions: event("reactions", {
    id: num,
    reactions: z.record(str, strings),
  }),
  ackRows: event("ackRows", { acks: z.array(AckSchema) }),
  poll: event("poll", { poll: PollSchema }),
  online: event("online", { online: strings }),
  conns: event("conns", {}),
  error: event("error", { error: z.optional(str) }),
  blocked: event("blocked", { text: str, reason: str }),
  result: CommandResultSchema,
};
type Schemas = typeof RoomEventSchemas;
export type RoomEvent = {
  [K in keyof Schemas]: z.infer<Schemas[K]>;
}[keyof Schemas];

export function isRoomEventValue(value: unknown): value is RoomEvent {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const t = (value as { t?: unknown }).t;
  if (typeof t !== "string" || !Object.hasOwn(RoomEventSchemas, t))
    return false;
  return RoomEventSchemas[t as keyof Schemas].safeParse(value).success;
}
