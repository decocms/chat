// JSON DTOs shared by the Cloudflare Worker and browser: runtime schemas first, every type derived from them.
// Browser-safe: zod/mini only, no backend imports. The events built from these live in events.ts.
import * as z from "zod/mini";

const str = z.string();
const num = z.number();
const bool = z.boolean();
const opt = <T extends z.ZodMiniType>(t: T) => z.optional(t);
const maybe = <T extends z.ZodMiniType>(t: T) => z.optional(z.nullable(t));
const strings = z.array(str);

export const TASK_STATUSES = ["todo", "doing", "review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
/** An epic's status, in the order of its menu. `dismissed` is an old client's done. */
export const EPIC_STATUSES = [
  "todo",
  "doing",
  "review",
  "done",
  "dismissed",
] as const;
export type EpicStatus = (typeof EPIC_STATUSES)[number];

export const BookMetaSchema = z.object({
  title: str,
  owner: str,
  summary: maybe(str),
  folder: maybe(str),
  /** A direct-message room (src/dm.ts): titled with the other person for each side. */
  dm: maybe(z.boolean()),
});
export type BookMeta = z.infer<typeof BookMetaSchema>;
export const SuggestionSchema = z.object({
  title: str,
  tasks: strings,
  why: opt(str),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;
export const DecisionSchema = z.object({
  id: num,
  text: str,
  who: str,
  kind: str,
  ts: num,
  /** The message it was decided in, when the agent that logged it said so. */
  msg: opt(num),
  /** Whose decision it is (their avatar and name). */
  email: opt(str),
  /** Set when an agent logged it: the agent's model, or "agent". */
  via: opt(str),
});
export type Decision = z.infer<typeof DecisionSchema>;
/** Someone in the room's call: their SFU session and the names of the tracks they publish ("mic", "screen"). */
export const CallPeerSchema = z.object({
  email: str,
  session: str,
  tracks: strings,
  /** The person's microphone is off. */
  muted: opt(bool),
});
export type CallPeer = z.infer<typeof CallPeerSchema>;
/** A DM's call ringing the other person (`to`) until `until` (shared/call.ts RING_MS). */
export const RingSchema = z.object({ from: str, to: str, until: num });
/** A DM's call is recorded only when both people said yes (Book.callConsent); one no: not this call. */
export const CallConsentSchema = z.object({
  yes: z.array(str),
  no: z.array(str),
});
export type CallConsent = z.infer<typeof CallConsentSchema>;
export type Ring = z.infer<typeof RingSchema>;
export const PinSchema = z.object({
  id: str,
  kind: str,
  ref: str,
  title: opt(str),
  author: opt(str),
  ts: opt(num),
});
export type Pin = z.infer<typeof PinSchema>;
export const PollSchema = z.object({
  id: str,
  question: str,
  options: strings,
  multi: bool,
  closed: bool,
  author: str,
  votes: z.array(strings),
});
export type Poll = z.infer<typeof PollSchema>;
export const TaskSchema = z.object({
  id: str,
  title: str,
  done: bool,
  status: z.enum(TASK_STATUSES),
  owner: maybe(str),
  due: maybe(str),
  flags: opt(strings),
  epic_id: opt(str),
});
export type Task = z.infer<typeof TaskSchema>;
export const EpicSchema = z.object({
  id: str,
  title: str,
  tasks: z.array(TaskSchema),
  done: opt(bool),
  owner: maybe(str),
  from_msg: maybe(num),
  parent: maybe(str),
  kept: opt(bool),
  files: opt(z.array(z.object({ id: str, name: str, type: str, n: num }))),
  flags: opt(strings),
  prod: maybe(z.object({ stage: str, note: opt(str), at: opt(num) })),
  /** The status a person or an agent chose; null = worked out by epicStatus (shared/epicStatus.ts). */
  status: maybe(z.enum(EPIC_STATUSES)),
  // An epic that answers a question (start_thread answer: true or answerIntent, Gui #2767).
  answer: opt(bool),
  /** When its thread last spoke (or it was made). */
  last: opt(num),
  /** When it was made: the sidebar sorts by it, newest first, and a click or a new message never moves it (Gimenes #5603). */
  created: opt(num),
  /** Pinned to the top of the sidebar (shared). */
  pinned: opt(bool),
});
export type Epic = z.infer<typeof EpicSchema>;
export const AttachmentSchema = z.object({
  id: str,
  name: str,
  type: str,
  size: num,
  author: str,
  ts: num,
  embed: opt(bool),
});
export type Attachment = z.infer<typeof AttachmentSchema>;
export const MessageSchema = z.object({
  id: num,
  thread: str,
  author: str,
  ts: num,
  text: str,
  viewing: opt(z.nullable(str)),
  kind: maybe(str),
  tag: maybe(str),
  via: maybe(str),
  reply_to: maybe(num),
  // The thread of the message it answers, only when that is another thread: a click on the quote opens it there
  // even when the quoted message isn't loaded (it may be weeks back, or in a thread the room open didn't send).
  reply_thread: opt(str),
  choices: maybe(str),
  poll: maybe(str),
  card: maybe(str),
  quiet: opt(bool),
  cut: opt(bool),
  answers_ask: opt(bool),
  for_who: maybe(str),
  // The sender's random id for this send (commands.ts msg): a tab settles its pending send by it. Absent = none.
  client_id: maybe(str),
  files: opt(z.array(AttachmentSchema)),
  // Emoji reactions (Gui #2724): emoji → who reacted (emails; "<email>#agent" = that person's Claude). Absent = none.
  reactions: opt(z.record(str, z.array(str))),
  // When it was last edited / deleted (Gui #4276). A deleted message keeps its place with no text, files or card.
  edited: maybe(num),
  deleted: maybe(num),
});
export type Message = z.infer<typeof MessageSchema>;
/** An earlier version of a message (message_edits), which only the room owner gets. */
export const MessageVersionSchema = z.object({
  kind: z.enum(["edit", "delete"]),
  text: str,
  files: z.array(str),
  by: str,
  ts: num,
});
export type MessageVersion = z.infer<typeof MessageVersionSchema>;
export const AckSchema = z.object({
  msg_id: num,
  agent: opt(str),
  email: str,
  who: str,
  status: str,
  ts: num,
  note: maybe(str),
});
export type Ack = z.infer<typeof AckSchema>;
export const ReminderSchema = z.object({
  id: str,
  name: maybe(str),
  text: str,
  owner: str,
  enabled: bool,
  error: maybe(str),
  every: maybe(str),
  cron: maybe(str),
  next_at: maybe(num),
  thread: opt(str),
  tz: opt(str),
  file_id: maybe(str),
});
export type Reminder = z.infer<typeof ReminderSchema>;
export const AccessRequestSchema = z.object({
  email: str,
  name: maybe(str),
  ts: num,
});
export const ReceiptSchema = z.object({
  email: str,
  who: str,
  read: num,
  delivered: num,
  agent: opt(str),
  ts: opt(num),
  /** A person's read point (no agent): the face has no agent badge and reads "Ana", not "Claude de Ana". */
  person: opt(bool),
});

/** "O que precisa de mim aqui" asked by a person, answered by their own Claude (Gui #3011): only that person's
 *  sockets ever get it. text/answered_at empty while it waits. */
export const BriefSchema = z.object({
  id: num,
  thread: str,
  ts: num,
  text: maybe(str),
  answered_at: maybe(num),
  model: maybe(str),
});
export type Brief = z.infer<typeof BriefSchema>;

/** What opening a room sends (the `state` event, without its `t`). */
export const RoomSnapshotSchema = z.object({
  me: str,
  book: BookMetaSchema,
  messages: z.array(MessageSchema),
  epics: z.array(EpicSchema),
  roomTasks: opt(z.array(TaskSchema)),
  members: strings,
  online: strings,
  /** Who is in the room's call. Missing = calls are not set up on this server (src/calls.ts). */
  call: opt(z.array(CallPeerSchema)),
  /** The thread of the call that is on (its own thread, made when the call starts): the chat beside the stage. */
  callThread: opt(str),
  /** A DM's call that rings someone now. */
  ring: opt(RingSchema),
  /** A DM's call: who said yes or no to the recording. */
  consent: opt(CallConsentSchema),
  /** This room's calls are recorded (CALL_RECORD_ROOMS): a call here without the recorder shows a warning. */
  callRecorded: opt(bool),
  /** Somebody in the room turned the live transcript of its calls off (call.transcript). */
  transcriptOff: opt(bool),
  names: opt(z.record(str, str)),
  /** email → @handle: what a mention picked from the list inserts (shared/mention.ts). */
  handles: opt(z.record(str, str)),
  avatars: opt(z.record(str, num)),
  pending: opt(strings),
  /** Invited and not in (src/rooms.ts invites): waiting for their yes, then the ones who said no. Not members. */
  invited: opt(strings),
  /** Invited, said no (src/rooms.ts answerInvite): shown in People as "recusou". */
  declined: opt(strings),
  requests: opt(z.array(AccessRequestSchema)),
  suggestions: z.array(SuggestionSchema),
  files: opt(z.array(AttachmentSchema)),
  filesN: opt(num),
  filesAll: opt(bool),
  reminders: opt(z.array(ReminderSchema)),
  acks: opt(z.array(AckSchema)),
  receipts: opt(z.array(ReceiptSchema)),
  counts: opt(z.record(str, num)),
  countsAt: opt(num),
  full: opt(strings),
  complete: opt(bool),
  origins: opt(z.array(MessageSchema)),
  docs: opt(z.record(str, str)),
  doc: opt(str),
  docNotes: opt(strings),
  decisions: opt(z.array(DecisionSchema)),
  pins: opt(z.array(PinSchema)),
  polls: opt(z.record(str, PollSchema)),
  briefs: opt(z.array(BriefSchema)),
  /** The threads with a message you have not seen there (Book.unreadThreads): the sidebar shows their names bolder. */
  unread: opt(strings),
  /** When the Book built this state, and the hash of its epics: a reconnect sends them back (since/at/eh) to resume. */
  at: opt(num),
  eh: opt(str),
  /** The Book's change log position (src/bookChanges.ts): a reconnect sends it back (rev=) to resume from the log. */
  rev: opt(num),
  /** A resumed state (cache plan PR 2): only what changed since the app's last one, merged into the room it has.
   *  epicsSame = the threads did not change, so epics is empty and the app keeps its own. */
  resume: opt(bool),
  epicsSame: opt(bool),
  /** A resume for an app that asked ed=1 (Book.epicsDelta): epics holds only the threads that changed, and this is
   *  the order of all of them (one missing is gone). */
  epicsOrder: opt(strings),
});
/** The room as the browser keeps it: the snapshot plus its id and who is typing. */
export type Room = z.infer<typeof RoomSnapshotSchema> & {
  id: string;
  typing: Record<string, string>;
  /** Earlier versions of messages the room owner asked for (msg.history), by message id. */
  history?: Record<number, MessageVersion[]>;
};

export type {
  DocumentContentEvent,
  DocumentInvalidationEvent,
  RoomEvent,
} from "./events";
