import type { PostMessageRequest } from "./rpc";
import { PostMessageBody } from "./schemas";
import {
  AckSchema,
  AttachmentSchema,
  BookMetaSchema,
  DecisionSchema,
  EpicSchema,
  MessageSchema,
  PinSchema,
  PollSchema,
  ReminderSchema,
  SuggestionSchema,
  TaskSchema,
  type Ack,
  type Attachment,
  type BookMeta,
  type Decision,
  type Epic,
  type Message,
  type Pin,
  type Poll,
  type Reminder,
  type RoomEvent,
  type Suggestion,
  type Task,
} from "./room";
import { isRoomEventValue } from "./events";
import { RoomCommandSchema, type RoomCommand } from "./commands";
import { decodeCall, RpcErrorCode, type RpcError, type RpcId } from "./jsonRpc";

// JSON guards built on the shared schemas: no Worker or UI dependency, and no unchecked JSON.parse casts at transport
// boundaries.
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const is =
  <T>(schema: { safeParse(value: unknown): { success: boolean } }) =>
  (value: unknown): value is T =>
    schema.safeParse(value).success;
// Each DTO's guard is its schema (shared/room.ts); a valid value is passed on as sent.
export const isAttachment = is<Attachment>(AttachmentSchema);
export const isTask = is<Task>(TaskSchema);
export const isEpic = is<Epic>(EpicSchema);
export const isMessage = is<Message>(MessageSchema);
export const isAck = is<Ack>(AckSchema);
export const isReminder = is<Reminder>(ReminderSchema);
export const isBookMeta = is<BookMeta>(BookMetaSchema);
export const isSuggestion = is<Suggestion>(SuggestionSchema);
export const isDecision = is<Decision>(DecisionSchema);
export const isPin = is<Pin>(PinSchema);
export const isPoll = is<Poll>(PollSchema);
/** One schema per event `t` (shared/events.ts). */
export const isRoomEvent = isRoomEventValue;
// Rolling deployments can pair a new browser with the previous Worker briefly.
// Previous snapshots serialized SQLite's 0/1 flags; normalize those exact values
// here rather than widening every consumer's boolean contract.
function normalizeLegacyFlags(value: unknown): unknown {
  if (!record(value)) return value;
  const flag = (row: unknown, key: string): unknown =>
    record(row) && (row[key] === 0 || row[key] === 1)
      ? { ...row, [key]: row[key] === 1 }
      : row;
  const tasks = (rows: unknown): unknown =>
    Array.isArray(rows) ? rows.map((row) => flag(row, "done")) : rows;
  const epics = (rows: unknown): unknown =>
    Array.isArray(rows)
      ? rows.map((row) =>
          record(row) ? { ...row, tasks: tasks(row.tasks) } : row,
        )
      : rows;
  const reminders = (rows: unknown): unknown =>
    Array.isArray(rows) ? rows.map((row) => flag(row, "enabled")) : rows;
  if (value.t === "state" || value.t === "epics")
    return {
      ...value,
      epics: epics(value.epics),
      ...(value.roomTasks === undefined
        ? {}
        : { roomTasks: tasks(value.roomTasks) }),
      ...(value.reminders === undefined
        ? {}
        : { reminders: reminders(value.reminders) }),
    };
  if (value.t === "epicsPatch")
    return {
      ...value,
      changed: epics(value.changed),
      ...(value.roomTasks === undefined
        ? {}
        : { roomTasks: tasks(value.roomTasks) }),
    };
  if (value.t === "reminders")
    return { ...value, reminders: reminders(value.reminders) };
  return value;
}
/** A decoded notification as a room event (throws when it is not one). */
export function toRoomEvent(message: unknown): RoomEvent {
  const value: unknown = normalizeLegacyFlags(message);
  if (!isRoomEvent(value)) throw new TypeError("Invalid room event");
  return value;
}
/** One room event off the wire: a JSON-RPC notification whose method is the event's `t`. */
export function parseRoomEvent(raw: string): RoomEvent {
  const call = decodeCall(raw);
  if (!call.ok || call.id !== undefined)
    throw new TypeError("Invalid room event");
  return toRoomEvent(call.message);
}

// The command schemas live in commands.ts; a valid command is passed on as sent (extra keys are ignored, as before).
export function isRoomCommand(value: unknown): value is RoomCommand {
  return RoomCommandSchema.safeParse(value).success;
}
/** A room command off the wire (a JSON-RPC request or notification, method = the command's `t`). `id` is set for a
 *  request, also when the command is invalid, so the sender still gets its error back. */
export function parseRoomCall(
  raw: string,
):
  | { id?: RpcId; command: RoomCommand }
  | { id?: RpcId; command: null; error: RpcError } {
  const call = decodeCall(raw);
  if (!call.ok) return { id: call.id, command: null, error: call.error };
  if (!isRoomCommand(call.message))
    return {
      id: call.id,
      command: null,
      error: { code: RpcErrorCode.INVALID_PARAMS, message: "invalid command" },
    };
  return { id: call.id, command: call.message };
}
export function parseRoomCommand(raw: string): RoomCommand {
  const { command } = parseRoomCall(raw);
  if (!command) throw new TypeError("Invalid room command");
  return command;
}

export function isPostMessageRequest(
  value: unknown,
): value is PostMessageRequest {
  return PostMessageBody.safeParse(value).success;
}
