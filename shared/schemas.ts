// Runtime schemas for what the browser sends the Worker: the TypeScript types are derived from them, so a schema
// edit changes every consumer's type. Browser-safe: zod/mini only, no Worker or database types.
import * as z from "zod/mini";
import { ClientIdSchema } from "./commands";
import { AckSchema, MessageSchema } from "./room";
import {
  MESSAGE_FILE_LIMIT,
  POLL_MAX_OPTIONS,
  POLL_OPTION_LIMIT,
  POLL_QUESTION_LIMIT,
} from "./composition";

export const PostMessageBody = z.object({
  text: z.string(),
  thread: z.optional(z.string()),
  // The send's random id, the same on each retry: the server answers a retry with the first message (Book.byClientId).
  client_id: z.optional(ClientIdSchema),
  /** Sent from the Home's ask box (the router): a later answer by someone else comes back to the Home (r<msg> waits). */
  routed: z.optional(z.boolean()),
  /** Files already uploaded to this room (POST /api/books/:id/files) that go with the message. */
  files: z.optional(z.array(z.string()).check(z.maxLength(MESSAGE_FILE_LIMIT))),
  /** A poll posted with the message, after it (the composer's poll.create, over HTTP). */
  poll: z.optional(
    z.object({
      question: z.string().check(z.maxLength(POLL_QUESTION_LIMIT)),
      options: z
        .array(z.string().check(z.maxLength(POLL_OPTION_LIMIT)))
        .check(z.maxLength(POLL_MAX_OPTIONS)),
      multi: z.optional(z.boolean()),
    }),
  ),
});
export type PostMessageBody = z.infer<typeof PostMessageBody>;

// Responses the browser reads back: validated at the boundary with the same schemas the types come from.
export const PostMessageResult = z.union([
  z.object({ ok: z.literal(true), id: z.number(), thread: z.string() }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type PostMessageResult = z.infer<typeof PostMessageResult>;

export const SaveReminderResult = z.object({
  ok: z.boolean(),
  name: z.optional(z.string()),
  error: z.optional(z.string()),
  every: z.optional(z.nullable(z.string())),
  cron: z.optional(z.nullable(z.string())),
  timezone: z.optional(z.string()),
  next_at: z.optional(z.string()),
});
export type SaveReminderResult = z.infer<typeof SaveReminderResult>;

export const AttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  size: z.number(),
  author: z.string(),
  ts: z.number(),
  embed: z.optional(z.boolean()),
});
export const UploadFileResult = z.extend(AttachmentSchema, {
  reminder: z.optional(SaveReminderResult),
});
export type UploadFileResult = z.infer<typeof UploadFileResult>;

/** Any error answer of the app's routes. */
export const ErrorBody = z.object({ error: z.string() });

// Small account/room mutations. Lenient: an unknown tint is none, non-string ids are dropped.
export const TINTS = [
  "blue",
  "green",
  "yellow",
  "orange",
  "pink",
  "purple",
] as const;
export const PushSubscribeBody = z.object({
  endpoint: z.string().check(z.startsWith("https://"), z.maxLength(1000)),
  p256dh: z.string().check(z.minLength(1)),
  auth: z.string().check(z.minLength(1)),
});
export const PushTestBody = z.object({
  endpoint: z.optional(z.string().check(z.maxLength(1000))),
});
export const PushUnsubscribeBody = z.object({
  endpoint: z.optional(z.string()),
});
export const ResolveWaitBody = z.object({
  book_id: z.string().check(z.minLength(1)),
  ref: z.string().check(z.regex(/^[mr]\d+$/)),
});
/** Many asks at once (the Inbox's "Resolve all"): asks only, at most 200. */
export const ResolveWaitsBody = z.object({
  items: z.array(ResolveWaitBody).check(z.minLength(1), z.maxLength(200)),
});
export const RoomOrderBody = z.object({ ids: z.array(z.unknown()) });
export const TintBody = z.object({ tint: z.optional(z.nullable(z.string())) });
export const ArchiveBody = z.object({ archived: z.optional(z.boolean()) });

export const OkResult = z.object({ ok: z.literal(true) });
export type OkResult = z.infer<typeof OkResult>;
export const PushKeyResult = z.object({ key: z.nullable(z.string()) });
export type PushKeyResult = z.infer<typeof PushKeyResult>;
export const PushTestResult = z.object({
  ok: z.literal(true),
  sent: z.number(),
});
export type PushTestResult = z.infer<typeof PushTestResult>;
export type ErrorBody = z.infer<typeof ErrorBody>;

// Account and room lists. Database rows are parsed against these before they leave the Worker.
export const EmailBody = z.object({ email: z.string() });
export const ArchivedRoom = z.object({
  id: z.string(),
  title: z.string(),
  folder: z.nullable(z.string()),
  summary: z.nullable(z.string()),
  updated_at: z.number(),
  archived_at: z.number(),
  members: z.nullable(z.string()),
});
export const ArchivedResult = z.object({ books: z.array(ArchivedRoom) });
export type ArchivedResult = z.infer<typeof ArchivedResult>;
export const SearchResult = z.object({
  rooms: z.number(),
  failed: z.optional(z.number()),
  epics: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      done: z.boolean(),
      ts: z.number(),
      room_id: z.string(),
      room: z.string(),
    }),
  ),
  messages: z.array(
    z.object({
      id: z.number(),
      thread: z.string(),
      topic: z.nullable(z.string()),
      author: z.string(),
      by_agent: z.boolean(),
      via: z.nullable(z.string()),
      ts: z.number(),
      files: z.array(z.object({ id: z.string(), name: z.string() })),
      snippet: z.string(),
      room_id: z.string(),
      room: z.string(),
    }),
  ),
});
export type SearchResult = z.infer<typeof SearchResult>;
/** Query values remain permissive strings; the existing handler trims/slices q. */
export const SearchQuery = z.object({ q: z.optional(z.string()) });
export type SearchQuery = z.infer<typeof SearchQuery>;
export const LoginsResult = z.object({
  logins: z.array(
    z.object({ method: z.string(), last: z.number(), n: z.number() }),
  ),
});
export type LoginsResult = z.infer<typeof LoginsResult>;

// The room's "Ligar Claude" toggle and access requests.
export const ClaudeToggleBody = z.object({ on: z.optional(z.boolean()) });
export const ClaudeToggleResult = z.object({
  ok: z.literal(true),
  claude_on: z.boolean(),
});
export type ClaudeToggleResult = z.infer<typeof ClaudeToggleResult>;
export const AccessRequestResult = z.object({
  ok: z.literal(true),
  member: z.optional(z.literal(true)),
});
export type AccessRequestResult = z.infer<typeof AccessRequestResult>;
export const DecideRequestBody = z.object({
  email: z.string(),
  ok: z.boolean(),
});
export const AccessResult = z.object({ member: z.boolean() });
export type AccessResult = z.infer<typeof AccessResult>;
/** GET /api/books/:id/messages: one page of a thread, by message id (ids only grow, so a cursor never breaks).
 *  before = scroll back, after = what came since, neither = the newest. Stateless: the answer is the truth now. */
export const MessagesQuery = z.object({
  thread: z._default(z.string().check(z.minLength(1), z.maxLength(64)), "main"),
  before: z.optional(z.coerce.number().check(z.positive())),
  after: z.optional(z.coerce.number().check(z.nonnegative())),
  limit: z._default(z.coerce.number().check(z.positive(), z.lte(100)), 50),
});
export type MessagesQuery = z.infer<typeof MessagesQuery>;
export const MessagesPage = z.object({
  thread: z.string(),
  messages: z.array(MessageSchema),
  /** The page's acks: the room's state carries only the loaded messages' ones. */
  acks: z.array(AckSchema),
  /** More messages on the far side of the page (older for before/newest, newer for after). */
  more: z.boolean(),
});
export type MessagesPage = z.infer<typeof MessagesPage>;
/** GET /api/books/:id/link: where a link to this app goes (a chip in the chat, web/features/rich-text/AppLinkChip).
 *  m = a message (#m), t = a thread (?t=, #e, #doc:); neither = the room. */
export const LinkQuery = z.object({
  t: z.optional(z.string().check(z.minLength(1), z.maxLength(64))),
  m: z.optional(z.coerce.number().check(z.positive())),
});
export type LinkQuery = z.infer<typeof LinkQuery>;
/** Only for a member, and only what the chip draws. Everything else (not a member, no such room, thread or message,
 *  a message hidden from you) is the same `private`, so the answer never tells which one it was. */
export const LinkResolution = z.union([
  z.object({
    kind: z.literal("message"),
    room: z.string(),
    id: z.number(),
    thread: z.string(),
    author: z.string(),
    name: z.string(),
    avatar: z.nullable(z.number()),
    /** The message's thread title; null = main (the chip shows the room's title) or the call chat. */
    threadTitle: z.nullable(z.string()),
    roomTitle: z.string(),
  }),
  z.object({
    kind: z.literal("thread"),
    room: z.string(),
    thread: z.string(),
    /** Empty for the call chat (the chip says "Chat da call"). */
    title: z.string(),
    owner: z.nullable(z.string()),
    ownerName: z.nullable(z.string()),
  }),
  z.object({
    kind: z.literal("room"),
    room: z.string(),
    title: z.string(),
    icon: z.nullable(z.number()),
  }),
  z.object({
    kind: z.literal("dm"),
    room: z.string(),
    email: z.string(),
    name: z.string(),
    avatar: z.nullable(z.number()),
  }),
  z.object({ kind: z.literal("private") }),
]);
export type LinkResolution = z.infer<typeof LinkResolution>;

// Your name, new rooms and the home's router.
export const SetNameBody = z.object({ name: z.optional(z.string()) });
export const SetNameResult = z.object({
  ok: z.literal(true),
  name: z.string(),
});
export type SetNameResult = z.infer<typeof SetNameResult>;
export const CreateRoomBody = z.object({ title: z.optional(z.string()) });
export const CreateRoomResult = z.object({ id: z.string() });
export type CreateRoomResult = z.infer<typeof CreateRoomResult>;
export const TextBody = z.object({ text: z.optional(z.string()) });
export const StartRoomResult = z.object({
  id: z.string(),
  invited: z.array(z.string()),
  unknown: z.array(z.string()),
  cost: z.number(),
});
export type StartRoomResult = z.infer<typeof StartRoomResult>;
export const RoomPick = z.object({
  book_id: z.string(),
  book_title: z.string(),
  epic_id: z.nullable(z.string()),
  epic_title: z.nullable(z.string()),
});
export const RouteResult = z.object({
  pick: z.nullable(RoomPick),
  reason: z.optional(z.string()),
  alternatives: z.array(RoomPick),
  new_room_title: z.string(),
  cost: z.number(),
});
export type RouteResult = z.infer<typeof RouteResult>;

// The person's freestyle API key and Claude subscription token (sealed on the server, never sent back).
export const ConnectedResult = z.object({ connected: z.boolean() });
export type ConnectedResult = z.infer<typeof ConnectedResult>;
export const FreestyleKeyBody = z.object({ key: z.optional(z.string()) });
export const ClaudeTokenBody = z.object({ token: z.optional(z.string()) });

// A room's Claudes (people's own agents) and cloud sandboxes, for Pessoas and the ✻ pane.
const num = z.nullable(z.number());
const str = z.nullable(z.string());
export const AgentLimits = z.record(
  z.string(),
  z.object({ p: z.number(), r: z.number() }),
);
export const AgentContext = z.object({
  tokens: z.number(),
  window: z.number(),
  at: num,
  limits: z.nullable(AgentLimits),
});
export const RoomAgent = z.object({
  email: z.string(),
  who: z.string(),
  repo: str,
  seen_at: num,
  listening: z.boolean(),
  all_rooms: z.boolean(),
  context: z.nullable(AgentContext),
  /** Only on your own agents: its id, its client, the machine that runs it (null = one-off) and its delivery here. */
  id: z.optional(z.string()),
  client: z.optional(str),
  machine: z.optional(str),
  delivery: z.optional(z.boolean()),
  /** Only on your own agents: the title of the room it listens to (null = all rooms or none). */
  room: z.optional(str),
});
/** Your machines (src/delivery.ts): computers running `vibebook herdr` and your sandboxes in this room. */
export const RoomMachine = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["herdr", "herdr-app", "sandbox"]),
  online: z.boolean(),
  seen_at: num,
  /** Its switch in this room: deliver to its agents (a computer also opens one when none is open). */
  on: z.boolean(),
});
export type RoomMachine = z.infer<typeof RoomMachine>;
/** Delivery switches: one machine, one one-off agent, or everything of yours in the room. */
export const DeliveryBody = z.object({
  on: z.boolean(),
  machine: z.optional(z.string()),
  agent: z.optional(z.string()),
  all: z.optional(z.boolean()),
});
export const DeliveryResult = z.object({ ok: z.literal(true) });
export type DeliveryResult = z.infer<typeof DeliveryResult>;
export const RoomSandbox = z.object({
  id: z.string(),
  email: z.string(),
  name: str,
  state: str,
  run_s: num,
  rate: num,
  disk_rate: num,
  checked_at: num,
  created_at: num,
  cost_unknown: z.optional(z.boolean()),
});
export const AgentsResult = z.object({
  claude_on: z.boolean(),
  sandboxes: z.array(RoomSandbox),
  agents: z.array(RoomAgent),
  machines: z.optional(z.array(RoomMachine)),
});
export type AgentsResult = z.infer<typeof AgentsResult>;
// The person's own cloud sandboxes in a room (freestyle.sh VMs; the key never leaves the server).
export const SandboxCard = z.object({
  id: z.string(),
  name: z.nullable(z.string()),
  vm_id: z.string(),
  ready: z.boolean(),
  state: z.string(),
  error: z.optional(z.string()),
  log: z.optional(z.string()),
  created_at: z.nullable(z.number()),
  rate: z.number(),
  cost: z.number(),
  cost_unknown: z.optional(z.boolean()),
});
export const SandboxesResult = z.object({
  connected: z.boolean(),
  claude: z.boolean(),
  sandboxes: z.array(SandboxCard),
});
export type SandboxesResult = z.infer<typeof SandboxesResult>;
export const CreateSandboxBody = z.object({ name: z.optional(z.string()) });
export const CreateSandboxResult = z.object({
  ok: z.literal(true),
  id: z.string(),
  vm_id: z.string(),
  name: z.string(),
});
export type CreateSandboxResult = z.infer<typeof CreateSandboxResult>;
export const SandboxSetupResult = z.object({
  ok: z.boolean(),
  log: z.string(),
  error: z.optional(z.string()),
});
export type SandboxSetupResult = z.infer<typeof SandboxSetupResult>;
export const SandboxTerminalResult = z.object({
  token: z.string(),
  url: z.string(),
});
export type SandboxTerminalResult = z.infer<typeof SandboxTerminalResult>;

// A room's MCP connections (src/mcpconn.ts). No token or URL path ever reaches the browser.
export const ConnectionApp = z.object({
  tool: z.string(),
  title: z.string(),
  description: z.string(),
  screen: z.boolean(),
});
export const ConnectionTool = z.object({
  name: z.string(),
  description: z.string(),
  read_only: z.boolean(),
  app: z.boolean(),
});
export const ConnectionContext = z.object({
  text: z.string(),
  by: z.string(),
  at: z.number(),
});
export const Connection = z.object({
  id: z.string(),
  title: z.string(),
  host: z.string(),
  scope: z.enum(["room", "me"]),
  owner: z.string(),
  mine: z.boolean(),
  created_at: z.nullable(z.number()),
  auth: z.literal("identity"),
  signed_in: z.boolean(),
  apps: z.array(ConnectionApp),
  tools: z.array(ConnectionTool),
  context: z.record(z.string(), ConnectionContext),
});
export type Connection = z.infer<typeof Connection>;
export const ConnectionsResult = z.object({ connections: z.array(Connection) });
export type ConnectionsResult = z.infer<typeof ConnectionsResult>;
/** `token` is refused with a message (connections no longer take one); kept so that error still reaches the person. */
export const CreateConnectionBody = z.object({
  url: z.optional(z.string()),
  scope: z.optional(z.string()),
  title: z.optional(z.string()),
  token: z.optional(z.unknown()),
});
export type CreateConnectionBody = z.infer<typeof CreateConnectionBody>;
export const CreateConnectionResult = z.object({
  ok: z.literal(true),
  connection: z.nullable(z.extend(Connection, { needs_sign_in: z.boolean() })),
});
export type CreateConnectionResult = z.infer<typeof CreateConnectionResult>;
export const RefreshConnectionResult = z.object({
  ok: z.literal(true),
  connection: Connection,
});
export type RefreshConnectionResult = z.infer<typeof RefreshConnectionResult>;
/** Browser direct-MCP bootstrap; sealed tokens and OAuth grants never leave the server. */
export const ConnectionIdentityResult = z.discriminatedUnion("direct", [
  z.strictObject({
    direct: z.literal(false),
    why: z.literal("signed_in"),
  }),
  z.strictObject({
    direct: z.literal(true),
    url: z.string(),
    identity: z.string(),
    expires_in: z.literal(300),
  }),
]);
export type ConnectionIdentityResult = z.infer<typeof ConnectionIdentityResult>;
export const ConnectionUiQuery = z.object({ tool: z.optional(z.string()) });
export const ConnectionUiResult = z.object({
  html: z.string(),
  tool: z.object({
    name: z.string(),
    title: z.optional(z.string()),
    description: z.optional(z.string()),
    inputSchema: z.optional(z.unknown()),
    annotations: z.optional(z.unknown()),
    _meta: z.optional(z.unknown()),
  }),
});
export type ConnectionUiResult = z.infer<typeof ConnectionUiResult>;
export const ConnectionCallBody = z.object({
  name: z.optional(z.string()),
  arguments: z.optional(z.unknown()),
});
export type ConnectionCallBody = z.infer<typeof ConnectionCallBody>;
export const ConnectionCallResult = z.object({ result: z.unknown() });
export type ConnectionCallResult = z.infer<typeof ConnectionCallResult>;
export const ConnectionContextBody = z.object({
  tool: z.optional(z.string()),
  text: z.optional(z.string()),
});
export type ConnectionContextBody = z.infer<typeof ConnectionContextBody>;
/** A failed connection call: sign_in = this person must sign in on that server first (401). */
export const ConnectionError = z.object({
  error: z.string(),
  sign_in: z.optional(z.literal(true)),
});
export type ConnectionError = z.infer<typeof ConnectionError>;

// GET /api/me, the home and rail's one read (served from the Person DO's cache while nothing changed).
export const MeBook = z.object({
  id: z.string(),
  title: str,
  folder: str,
  summary: str,
  updated_at: num,
  created_at: num,
  icon: num,
  busy_until: num,
  position: num,
  tint: str,
  opened_at: num,
  last_human_id: z.number(),
  last_agent_id: z.number(),
  read_id: z.number(),
  sandboxes_running: z.number(),
  /** The room's members' emails, comma-separated (D1 group_concat). */
  members: str,
  /** 1 = a direct-message room (src/dm.ts): listed with your DMs, not with the rooms. */
  dm: z.optional(num),
  /** A DM's other person's name and picture version (null in rooms and your own DM): your other lists may not know them. */
  peer_name: z.optional(str),
  peer_avatar: z.optional(num),
  /** The newest message, for the phone's list of rooms: its author (an email, or "ai" for @vibe), that person's name and its start. */
  last_by: z.optional(str),
  last_by_name: z.optional(str),
  last_text: z.optional(str),
  /** 1 = that person's agent wrote it. */
  last_agent: z.optional(num),
});
export const MeFriend = z.object({
  email: z.string(),
  name: str,
  avatar: num,
  /** 1 = has an account, 0 = invited only (D1 boolean). */
  joined: z.number(),
  shared: z.number(),
  /** The id of your DM room with them (src/dm.ts); the room exists once one of you writes. */
  dm: z.string(),
});
/** Someone outside your rooms who wrote to you: their first message waits for your yes (POST /api/friends with
 *  their email accepts and opens the DM with it, DELETE declines). */
export const MeFriendRequest = z.object({
  email: z.string(),
  name: str,
  avatar: num,
  /** Their first message (absent on requests made before Nov 2026). */
  msg: z.optional(str),
});
/** A message you sent someone outside your rooms that waits for their yes (DELETE /api/friends/:email cancels).
 *  Only the email: whether that address has an account isn't yours to know until they answer. */
export const MeSentRequest = z.object({
  email: z.string(),
  msg: str,
  /** 1 = they said no (D1 boolean); it stays closed. */
  declined: z.number(),
});
export type MeSentRequest = z.infer<typeof MeSentRequest>;
/** A room you were invited to and haven't answered (POST /api/books/:id/invite {yes}). */
export const MeInvite = z.object({
  book_id: z.string(),
  title: z.string(),
  icon: num,
  inviter: z.string(),
  inviter_name: str,
  inviter_avatar: num,
  people: z.number(),
  created_at: z.number(),
});
export type MeInvite = z.infer<typeof MeInvite>;
/** Someone you share a room with: you can DM them without asking (POST /api/friends opens it). */
export const MePerson = z.object({
  email: z.string(),
  name: str,
  avatar: num,
  /** The rooms you share, newest first (≤2 titles). */
  rooms: z.array(z.string()),
});
export type MePerson = z.infer<typeof MePerson>;
/** Writing to someone: `id` = the DM, open now; no id = it went as a message request. */
export const ConnectBody = z.object({
  email: z.string(),
  text: z.optional(z.string()),
});
export const ConnectResult = z.object({
  ok: z.literal(true),
  id: z.optional(z.string()),
});
export type ConnectResult = z.infer<typeof ConnectResult>;
export const InviteAnswerBody = z.object({ yes: z.boolean() });
export type MeFriendRequest = z.infer<typeof MeFriendRequest>;
export const MeWait = z.object({
  book_id: z.string(),
  room: z.string(),
  /** m<msg> an ask to you, t<task> your task in review, a/b<msg> your Claude waiting on you, r<msg> an answer to
   *  what you sent from the Home's ask box (msg = your request; text = the answer, about = your request). An a<msg>
   *  wait's about is the question's choices (the message's JSON: {options, multi}). */
  ref: z.string(),
  thread: z.string(),
  topic: str,
  author: z.string(),
  author_name: str,
  text: z.string(),
  ts: z.number(),
  about: z.optional(str),
});
export const MeData = z.object({
  email: z.string(),
  name: str,
  avatar: num,
  /** Your own DM ("Você", src/dm.ts): the room you have with yourself and your Claude. */
  dm: z.string(),
  books: z.array(MeBook),
  friends: z.array(MeFriend),
  /** Message requests waiting on you: people outside your rooms who wrote to you. */
  requests: z.array(MeFriendRequest),
  /** Your message requests to people outside your rooms. */
  sent: z.array(MeSentRequest),
  /** Room invites waiting on you. */
  invites: z.array(MeInvite),
  /** People you share a room with (the new-message search), most recent rooms first, ≤200. */
  people: z.array(MePerson),
  waits: z.array(MeWait),
});
export type MeData = z.infer<typeof MeData>;
/** v = the app shell's version (a new deploy makes open tabs reload); cached = served from the Person DO. */
export const MeResult = z.extend(MeData, {
  v: z.string(),
  cached: z.optional(z.literal(true)),
});
export type MeResult = z.infer<typeof MeResult>;

// Inbox (GET /api/inbox): everything across the person's rooms that needs them — waits (reuses MeWait), the @mentions
// held back for the digest, and their open tasks (todo/doing/review). D1 for waits + mentions; a DO fan-out for tasks.
export const InboxMention = z.object({
  book_id: z.string(),
  room: z.string(),
  msg_id: z.number(),
  thread: z.string(),
  author: z.string(),
  author_name: str,
  text: z.string(),
  ts: z.number(),
});
export const InboxTask = z.object({
  book_id: z.string(),
  room: z.string(),
  epic_id: z.string(),
  epic: str,
  task_id: z.string(),
  title: z.string(),
  status: z.string(),
  due: str,
});
export const InboxResult = z.object({
  waits: z.array(MeWait),
  mentions: z.array(InboxMention),
  tasks: z.array(InboxTask),
});
export type InboxResult = z.infer<typeof InboxResult>;

// The two image uploads (raw bytes; the app resizes first). Their type is the request's content-type.
export const ImageHeaders = z.object({
  "content-type": z.optional(z.string()),
});
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const AvatarResult = z.object({
  ok: z.literal(true),
  avatar: z.number(),
});
export type AvatarResult = z.infer<typeof AvatarResult>;
/** icon = the new version, or null when the icon was removed (a JSON body). */
export const RoomIconResult = z.object({ ok: z.literal(true), icon: num });
export type RoomIconResult = z.infer<typeof RoomIconResult>;

/** The answers the Worker's global middleware gives before any route runs (src/index.ts), so they are not in AppType:
 *  every /api call can get them. 401 = signed out; 403 = a write from another site (the cross-site guard). Routes'
 *  own 403s ({ error: "forbidden" }) are in AppType. */
export const UNAUTHENTICATED = { error: "unauthenticated" } as const;
export const CROSS_SITE = { error: "cross-site request refused" } as const;
export const GLOBAL_FAILURE_STATUSES = [401, 403] as const;
export type GlobalFailure = {
  status: (typeof GLOBAL_FAILURE_STATUSES)[number];
  error: string;
};

// Public auth routes (/auth/*, src/api.ts authApi): what the login page needs, before anyone is signed in.
/** The login page's context: where to go after (already made safe), and whether sign-in with deco Studio failed. */
export const LoginContext = z.object({
  next: z.string(),
  error: z.nullable(z.literal("studio")),
});
export type LoginContext = z.infer<typeof LoginContext>;
export const LoginContextQuery = z.object({
  next: z.optional(z.string()),
  error: z.optional(z.string()),
});
/** A room link's page for someone who may not be in it (the access page): the title is readable by whoever holds the
 *  link, on purpose (the shared card). state: missing room, signed out, can ask, already asked, or already a member. */
export const AccessContext = z.object({
  state: z.enum(["missing", "out", "ask", "asked", "invited", "member"]),
  title: z.nullable(z.string()),
  email: z.nullable(z.string()),
  /** state "invited": who invited you (name, else email). */
  inviter: z.optional(z.string()),
});
export type AccessContext = z.infer<typeof AccessContext>;

/** Your connected Claudes (one per OAuth grant: each `vibebook login` or connector), on the home's side box.
 *  used_at: last use of that grant; null = never seen, absent = an older grant with no per-grant record. */
export const AgentGrant = z.object({
  id: z.string(),
  client: z.string(),
  connected_at: z.number(),
  used_at: z.optional(z.nullable(z.number())),
});
export type AgentGrant = z.infer<typeof AgentGrant>;
export const AgentGrantsResult = z.object({
  agents: z.array(AgentGrant),
  last_used: z.nullable(z.number()),
});
export type AgentGrantsResult = z.infer<typeof AgentGrantsResult>;
export const RevokeAgentsBody = z.object({ ids: z.array(z.string()) });
export const RevokeAgentsResult = z.object({
  ok: z.literal(true),
  removed: z.number(),
});
export type RevokeAgentsResult = z.infer<typeof RevokeAgentsResult>;

/** The agent-connect consent page's context (GET /api/authorize/context with the /authorize query): what the page must
 *  show (who asks, where the tokens go, a local redirect warning) and the one-time handle the existing form posts back
 *  to POST /authorize. Getting it grants nothing. */
export const ConsentContext = z.object({
  client_name: z.string(),
  client_domain: z.nullable(z.string()),
  redirect_host: z.string(),
  redirect_is_loopback: z.boolean(),
  scope: z.array(z.string()),
  email: z.string(),
  handle: z.string(),
});
export type ConsentContext = z.infer<typeof ConsentContext>;
/** A refused authorization request: the error, and the client's own error redirect when the library built one. */
export const ConsentError = z.object({
  error: z.string(),
  redirect_to: z.optional(z.string()),
});
export type ConsentError = z.infer<typeof ConsentError>;

/** The hub router's A/B for the signed-in person (src/router.ts routerStats), for the room app that shows it. */
const RouterArm = z.object({
  n: z.number(),
  ignore: z.number(),
  answer: z.number(),
  wake: z.number(),
  cost: z.number(),
  p50: z.optional(z.nullable(z.number())),
  p95: z.optional(z.nullable(z.number())),
});
export const RouterStats = z.object({
  since: z.string(),
  arms: z.object({
    jev: RouterArm,
    hybrid: RouterArm,
    haiku: RouterArm,
    rule: RouterArm,
  }),
  recent: z.array(
    z.object({
      book_id: z.string(),
      room: z.nullable(z.string()),
      who: z.string(),
      msg_id: z.number(),
      arm: z.string(),
      decision: z.string(),
      why: z.nullable(z.string()),
      source: z.nullable(z.string()),
      reply_id: z.nullable(z.number()),
      ms: z.nullable(z.number()),
      cost: z.nullable(z.number()),
      text: z.nullable(z.string()),
      ts: z.number(),
    }),
  ),
});
export type RouterStats = z.infer<typeof RouterStats>;

/** What vibebook spent on models (src/reports.ts aiSpend), for the report rooms' app. */
export const AiSpend = z.object({
  recorded: z.object({
    jev: z.number(),
    llm: z.number(),
    router: z.number(),
    since: z.nullable(z.string()),
  }),
  by_event: z.array(
    z.object({
      event: z.string(),
      kind: z.string(),
      model: z.string(),
      calls: z.number(),
      cost: z.number(),
    }),
  ),
  router: z.array(
    z.object({ arm: z.string(), n: z.number(), cost: z.number() }),
  ),
  days: z.array(
    z.object({
      day: z.string(),
      jev: z.number(),
      llm: z.number(),
      router: z.number(),
    }),
  ),
  openrouter_key: z.nullable(
    z.object({
      usage: z.number(),
      limit: z.nullable(z.number()),
      daily: z.nullable(z.number()),
      weekly: z.nullable(z.number()),
      monthly: z.nullable(z.number()),
    }),
  ),
  note: z.string(),
});
export type AiSpend = z.infer<typeof AiSpend>;

/** The infra monitor's windows (days). */
export const InfraWindow = z.union([
  z.literal(7),
  z.literal(14),
  z.literal(30),
]);
export type InfraWindow = z.infer<typeof InfraWindow>;
/** The Worker and the site, per UTC day, for 2 × window days (this window and the one before), oldest first
 *  (src/reports.ts infraMonitor). worker_error: Cloudflare failed, so the Worker numbers are missing, not zero. */
export const InfraMonitor = z.object({
  window: InfraWindow,
  days: z.array(
    z.object({
      day: z.string(),
      requests: z.nullable(z.number()),
      errors: z.nullable(z.number()),
      bytes: z.nullable(z.number()),
      cpu_p50_ms: z.nullable(z.number()),
      wall_p50_ms: z.nullable(z.number()),
      visitors: z.number(),
    }),
  ),
  worker_error: z.nullable(z.string()),
  generated_at: z.string(),
});
export type InfraMonitor = z.infer<typeof InfraMonitor>;

export const SttQuery = z.object({
  lang: z.optional(z.string()),
  prompt: z.optional(z.string()),
});
export type SttQuery = z.infer<typeof SttQuery>;
export const SttResult = z.object({
  ok: z.literal(true),
  text: z.string().check(z.maxLength(65536)),
});
export type SttResult = z.infer<typeof SttResult>;
// The room's call (src/calls.ts): the browser's WebRTC negotiation with the SFU goes through these routes.
export const CallJoinResult = z.object({ session: z.string() });
/** POST /api/calls/recorded, from the recorder Worker: the call of this room is in Grain at this address. */
export const RecordedBody = z.object({
  room: z.string().check(z.regex(/^[a-z0-9]{6,40}$/)),
  /** Missing, with `error`: the recording failed. */
  url: z.optional(
    z.string().check(z.regex(/^https:\/\/grain\.com\/[\w\-/.?=&%]{1,400}$/)),
  ),
  error: z.optional(z.string().check(z.maxLength(300))),
  minutes: z.optional(z.number()),
  people: z.optional(
    z.array(z.string().check(z.maxLength(80))).check(z.maxLength(100)),
  ),
  /** Who said what: `start` is seconds from the start of the recording. */
  transcript: z.optional(
    z
      .array(
        z.object({
          name: z.string().check(z.maxLength(80)),
          start: z.number(),
          text: z.string().check(z.maxLength(4000)),
        }),
      )
      .check(z.maxLength(20000)),
  ),
});
export type RecordedBody = z.infer<typeof RecordedBody>;
export type CallJoinResult = z.infer<typeof CallJoinResult>;
export const CallDescription = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().check(z.maxLength(200_000)),
});
export type CallDescription = z.infer<typeof CallDescription>;
const callName = z.string().check(z.regex(/^[a-z]{1,16}$/));
const callId = z.string().check(z.regex(/^[\w-]{1,128}$/));
/** push: tracks of mine, by the transceiver's mid (needs `offer`). pull: tracks of others in the call. */
export const CallTracksBody = z.object({
  session: callId,
  offer: z.optional(CallDescription),
  push: z.optional(
    z
      .array(
        z.object({ mid: z.string().check(z.maxLength(16)), name: callName }),
      )
      .check(z.maxLength(4)),
  ),
  pull: z.optional(
    z
      .array(z.object({ session: callId, name: callName }))
      .check(z.maxLength(64)),
  ),
});
export type CallTracksBody = z.infer<typeof CallTracksBody>;
export const CallAnswerBody = z.object({
  session: callId,
  answer: CallDescription,
});
export const CallCloseBody = z.object({
  session: callId,
  mids: z.array(z.string().check(z.maxLength(16))).check(z.maxLength(64)),
  names: z.optional(z.array(callName)),
});
/** Hanging up (POST /api/books/:id/call/leave): this session leaves the call, and no other session of the person. */
export const CallLeaveBody = z.object({ session: callId });
/** What the SFU answers to a tracks request. A pull comes with an offer the browser must answer at once. */
export const CallSfuResult = z.object({
  sessionDescription: z.optional(z.nullable(CallDescription)),
  requiresImmediateRenegotiation: z.optional(z.nullable(z.boolean())),
  tracks: z.optional(
    z.nullable(
      z.array(
        z.object({
          mid: z.optional(z.nullable(z.string())),
          trackName: z.optional(z.nullable(z.string())),
          sessionId: z.optional(z.nullable(z.string())),
          errorCode: z.optional(z.nullable(z.string())),
        }),
      ),
    ),
  ),
});
export type CallSfuResult = z.infer<typeof CallSfuResult>;
/** A screen share refused because the month's traffic budget is spent (409). */
export const CALL_LIMIT = "call screen limit";
export const STT_AUDIO_MAX = 4_000_000;

// A person's profile (Gui #3526): what they and their Claudes did, as stats and a title (shared/titles.ts). Never the
// email: `who` is a handle (public page) or, for someone you share a room with, their email (the hover card).
export const ProfileStats = z.object({
  tokens: z.number(),
  messages: z.number(),
  deploys: z.number(),
  limits: z.number(),
});
export type ProfileStats = z.infer<typeof ProfileStats>;
export const ProfileResult = z.object({
  handle: z.string(),
  name: z.string(),
  /** Public avatar URL (by handle), or null. */
  avatar: z.nullable(z.string()),
  public: z.boolean(),
  self: z.boolean(),
  since: z.number(),
  totals: ProfileStats,
  /** The last 30 days, oldest first: tokens per UTC day. */
  days: z.array(z.object({ day: z.string(), tokens: z.number() })),
  /** The plan's limits now (five_hour, seven_day: % used + reset epoch s), from the newest Claude that reported them. */
  limits: z.nullable(AgentLimits),
  /** The latest times a limit hit 100%, newest first. */
  hits: z.array(z.object({ kind: z.string(), at: z.number() })),
});
export type ProfileResult = z.infer<typeof ProfileResult>;
export const ProfileSettingsBody = z.object({ public: z.boolean() });
export const ProfileSettingsResult = z.object({
  handle: z.string(),
  public: z.boolean(),
});
export type ProfileSettingsResult = z.infer<typeof ProfileSettingsResult>;
/** Your @handle (Settings › Profile): 2–24 of a-z, 0-9, ".", "_", "-", unique across the app. */
export const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{1,23}$/;
export const SetHandleBody = z.object({ handle: z.string() });
export const SetHandleResult = z.object({ handle: z.string() });
export type SetHandleResult = z.infer<typeof SetHandleResult>;
