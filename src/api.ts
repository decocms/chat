import { AgentDbRow, MachineDbRow, UploadHeaders } from "./apiServerSchemas";
import { DELIVERS, deliveryJoins, MACHINE_FRESH, sandboxMachine } from "./delivery";
import { requestBytes, RequestBytesError } from "./requestBytes";
import { SttQuery, SttResult, CallJoinResult, CallTracksBody, CallAnswerBody, CallCloseBody, CallLeaveBody, CALL_LIMIT, type CallSfuResult, type CallDescription, type CallTracksBody as CallTracksBodyType, type SttQuery as SttQueryType } from "../shared/schemas";
import { speechAudio } from "./speechToText";
import { roomSandbox } from "./sandboxRows";
import { isDmId } from "../shared/dm";
// Typed application routes: validated Hono handlers chained into one app whose type (AppType) the browser client
// consumes through hc<AppType> (web/lib/client/api.ts, import type only: no backend code reaches the browser).
// index.ts mounts this app after its auth middleware.
//
// Handlers never touch c.env: they get ApiServices (src/services.ts, built per request by index.ts for the signed-in
// person), whose types are plain wire types. So AppType's declaration (.api-types, `bun run build:api-types`) stays free
// of Worker and Cloudflare types, and every response is checked against its shared schema type with `satisfies`, so a
// handler and the schema the client validates with can't drift apart.
import { Hono } from "hono";
import * as zm from "zod/mini";
import { validator } from "hono/validator";
import type * as z from "zod/mini";
import {
  CreateSandboxBody,
  ConnectionCallBody,
  type ConnectionCallResult,
  ConnectionContextBody,
  type ConnectionError,
  ConnectionsResult,
  ConnectionUiQuery,
  ConnectionIdentityResult,
  type ConnectionUiResult,
  CreateConnectionBody,
  type CreateConnectionResult,
  type MeResult,
  AVATAR_TYPES,
  type AvatarResult,
  ImageHeaders,
  type RoomIconResult,
  type RefreshConnectionResult,
  type CreateSandboxResult,
  type SandboxesResult,
  type SandboxSetupResult,
  type SandboxTerminalResult,
  AgentLimits,
  type AgentsResult,
  type ProfileResult,
  ProfileSettingsBody,
  SetHandleBody,
  type SetHandleResult,
  type ProfileSettingsResult,
  ClaudeTokenBody,
  type ConnectedResult,
  FreestyleKeyBody,
  CreateRoomBody,
  type CreateRoomResult,
  RouteResult,
  SetNameBody,
  type SetNameResult,
  StartRoomResult,
  TextBody,
  type AccessRequestResult,
  type AccessResult,
  MessagesQuery,
  type MessagesPage,
  LinkQuery,
  type LinkResolution,
  ClaudeToggleBody,
  DeliveryBody,
  type DeliveryResult,
  ClaudeToggleResult,
  DecideRequestBody,
  ArchiveBody,
  ArchivedRoom,
  type ArchivedResult,
  EmailBody,
  ConnectBody,
  ConnectResult,
  InviteAnswerBody,
  LoginsResult,
  type SearchResult,
  SearchQuery,
  type InboxResult,
  type ErrorBody,
  type OkResult,
  PostMessageBody,
  type PostMessageResult,
  PushSubscribeBody,
  PushTestBody,
  type PushKeyResult,
  type PushTestResult,
  PushUnsubscribeBody,
  ResolveWaitBody,
  ResolveWaitsBody,
  RoomOrderBody,
  TINTS,
  TintBody,
  type UploadFileResult,
  type LoginContext,
  LoginContextQuery,
  type AccessContext,
  type AgentGrantsResult,
  RevokeAgentsBody,
  type RevokeAgentsResult,
  type ConsentContext,
  type ConsentError,
  type RouterStats,
  type AiSpend,
  type InfraMonitor,
  InfraWindow,
} from "../shared/schemas";

export type Bind = string | number | null;
/** What the typed routes may do, bound to the signed-in person. Authorization stays in each route (isMember). */
export interface ApiServices {
  /** The signed-in person reads English (reqLang): the error texts below follow it. */
  en: boolean;
  /** Is the signed-in person a member of this room? */
  isMember(roomId: string): Promise<boolean>;
  allowStt():Promise<boolean>;
  transcribe(audio:Uint8Array,query:SttQueryType):Promise<unknown>;
  /** The room's call (src/calls.ts). Each one checks that the session is the signed-in person's. */
  callsOn: boolean;
  allowCall(): Promise<boolean>;
  callJoin(roomId: string, thread: string): Promise<CallJoinResult>;
  callTracks(roomId: string, body: CallTracksBodyType): Promise<CallSfuResult | "forbidden" | "limit">;
  callAnswer(roomId: string, session: string, answer: CallDescription): Promise<boolean>;
  callClose(roomId: string, session: string, mids: string[], names: string[]): Promise<boolean>;
  /** Hang up: this session leaves the room's call at once (the socket's call.leave can be lost on a reconnect). */
  callLeave(roomId: string, session: string): Promise<void>;
  /** A DM's call rings me: I say no (the ring stops; the caller stays in the call). */
  callDecline(roomId: string): Promise<void>;
  humanPost(roomId: string, text: string, thread: string, clientId?: string): Promise<PostMessageResult>;
  /** One page of a thread (GET /api/books/:id/messages). The route checks membership first. */
  roomMessages(roomId: string, query: MessagesQuery): Promise<MessagesPage>;
  /** Where a link to this app goes (GET /api/books/:id/link): `private` unless you are a member (src/linkTarget.ts). */
  linkTarget(roomId: string, query: LinkQuery): Promise<LinkResolution>;
  /** Validates type/size/secrets and stores the file; throws an Error whose message is user-facing. */
  storeFile(roomId: string, type: string, body: ArrayBuffer, name: string): Promise<UploadFileResult>;
  fileTypes: readonly string[];
  maxBytes(type: string): number;
  sizeError(type: string): string;
  typesError: string;
  /** One D1 statement / one statement run for several rows (a batch). */
  sql(query: string, ...binds: Bind[]): Promise<void>;
  sqlBatch(query: string, rows: Bind[][]): Promise<void>;
  /** First-party analytics for the signed-in person (runs after the response). */
  track(name: string, dims?: Record<string, string | number | boolean | undefined>): void;
  /** Tell the person's other tabs and devices to refetch /api/me (after the response). */
  pokeMe(): void;
  /** You cleared one wait (the Inbox's ✓): the room checks if the router read it, for a suggested case (after the response). */
  waitCleared(bookId: string, ref: string): void;
  vapidKey: string | null;
  /** Push to your devices; with `endpoint`, only to that one device. */
  pushToMe(p: { title: string; body: string; url: string; tag: string }, endpoint?: string): Promise<number>;
  /** Rows of one query, as the database returns them (routes parse them with a schema before answering). */
  sqlAll(query: string, ...binds: Bind[]): Promise<unknown[]>;
  /** Search the person's rooms (rate-limited per person: false = over the limit). */
  search(q: string): Promise<SearchResult | false>;
  /** The cross-room Inbox: waits, held-back mentions, the person's open tasks and open threads. */
  inbox(): Promise<InboxResult>;
  /** Mark an open thread done from the Inbox; false = no such open thread. */
  threadDone(roomId: string, epicId: string): Promise<boolean>;
  isEmail(s: string): boolean;
  /** Write to someone: `id` = the DM is open (a room in common, a connection, or their request accepted); `{}` = it
   *  went as a message request. Never says whether the email has an account. */
  connect(email: string, text?: string): Promise<{ id?: string; error?: string }>;
  /** Decline their message request, or cancel yours. */
  dismiss(email: string): Promise<void>;
  /** Your answer to a room invite; false = no invite waiting. */
  answerInvite(roomId: string, yes: boolean): Promise<boolean>;
  invite(roomId: string, email: string): Promise<void>;
  /** Remove someone from a room: any member removes anyone but the owner. */
  removeMember(roomId: string, email: string): Promise<{ error: string; status: 400 | 403 } | null>;
  /** Tell the person's tabs to refetch this room's agents (after the response). */
  pokeAgents(roomId: string): void;
  /** Wake the person's listeners for this room (their CLI hub waits on {t:"me", book}). */
  pokeListeners(roomId: string): void;
  /** The room's ↗: ask this person's CLI hub (any machine) to focus the room's Claude in herdr. */
  pokeFocus(roomId: string): void;
  /** Ask to join a room: unknown room, already a member, over the rate limit, or asked (the owner is told once). */
  requestAccess(roomId: string): Promise<"not_found" | "member" | "limited" | "asked">;
  /** A member approves (invites) or denies a pending request; false = no such pending request. */
  decideRequest(roomId: string, email: string, ok: boolean): Promise<boolean>;
  createRoom(title?: string): Promise<string>;
  /** One model call turns "what and with whom" into a room + invites; false = over the AI limit. */
  startRoom(text: string): Promise<unknown | false>;
  /** The home box: which room/epic this text belongs to; false = over the AI limit; throws when the model fails. */
  routeHome(text: string): Promise<unknown | false>;
  /** The request came from our own pages (no Origin, or ours). */
  sameOrigin: boolean;
  /** Per-person rate limit for pasting secrets (LOGIN_LIMIT): false = over it. */
  allowSecretTry(key: string): Promise<boolean>;
  /** Seal and keep one of the person's secrets (replaces the old one). */
  saveSecret(table: "freestyle_keys" | "claude_tokens", value: string): Promise<void>;
  /** Ask freestyle whether this API key works: null = it does, else freestyle's reason. */
  checkFreestyleKey(key: string): Promise<string | null>;
  /** How recent a listener's last call must be to count as listening (ms). */
  listenFresh: number;
  /** The signed-in person's own sandboxes (by id + email); room membership is checked by the route. */
  sandboxes: {
    list(roomId: string): Promise<SandboxesResult>;
    /** Throws an Error whose message is user-facing. */
    create(roomId: string, name: string): Promise<{ id: string; vm_id: string; name: string }>;
    /** null = done; "not_found"; else freestyle's error. */
    power(sid: string, act: "pause" | "start"): Promise<string | null>;
    /** Throws freestyle's error. */
    setup(sid: string): Promise<SandboxSetupResult>;
    /** false = no such sandbox of yours. */
    remove(sid: string): Promise<boolean>;
    /** null = no such sandbox of yours; throws freestyle's error. */
    terminal(sid: string): Promise<SandboxTerminalResult | null>;
  };
  /** The home and rail's one read: your rooms, friends and waits, plus the app shell's version. */
  me(): Promise<MeResult>;
  /** Per-person upload rate limit (UPLOAD_LIMIT): false = over it. */
  allowUpload(): Promise<boolean>;
  /** Store your profile picture (R2 avatars/<email>); returns its new version. */
  saveAvatar(type: string, bytes: ArrayBuffer): Promise<number>;
  /** Set (or with null remove) a room's icon; returns its version or null. Throws a user-facing Error. */
  setRoomIcon(roomId: string, img: { type: string; body: ArrayBuffer } | null): Promise<number | null>;
  /** The room's MCP connections as this person sees them (src/mcpconn.ts connOps); membership is checked by the route. */
  connections: {
    list(roomId: string): Promise<ConnectionsResult>;
    identity(roomId: string, cid: string): Promise<ConnectionIdentityResult | ConnFail>;
    create(roomId: string, b: CreateConnectionBody): Promise<CreateConnectionResult | ConnFail>;
    remove(roomId: string, cid: string): Promise<OkResult | ConnFail>;
    refresh(roomId: string, cid: string): Promise<RefreshConnectionResult | ConnFail>;
    ui(roomId: string, cid: string, tool: string): Promise<ConnectionUiResult | ConnFail>;
    call(roomId: string, cid: string, name: string, args: unknown): Promise<ConnectionCallResult | ConnFail>;
    context(roomId: string, cid: string, tool: string, text: string): Promise<OkResult | ConnFail>;
    signout(roomId: string, cid: string): Promise<OkResult | ConnFail>;
  };
  /** Your Claudes' OAuth grants (src/connect.ts grantOps): list them, revoke some (at most 100 per call). */
  grants: { list(): Promise<AgentGrantsResult>; revoke(ids: string[]): Promise<number> };
  /** The consent page's context for this request's /authorize query (src/connect.ts consentContext); headers carry the
   *  consent transaction's binding cookie. */
  /** The hub router's A/B for this person (src/router.ts), all rooms or one. */
  routerStats(roomId?: string): Promise<RouterStats>;
  /** Turn your public profile page (/u/<handle>) on or off (src/profile.ts). */
  setProfilePublic(on: boolean): Promise<ProfileSettingsResult>;
  /** Change your @handle (unique); "taken" when someone has it. */
  setHandle(handle: string): Promise<{ handle: string } | { error: "invalid" | "taken" }>;
  /** vibebook's model spend (src/reports.ts aiSpend), only for members of the report rooms (METRICS_ROOMS). */
  reportRoom(roomId: string): boolean;
  aiSpend(): Promise<AiSpend>;
  /** The Worker and the site per day (src/reports.ts infraMonitor), same rooms and people as aiSpend. */
  infraMonitor(window: InfraWindow): Promise<InfraMonitor>;
  consentContext(): Promise<{ context: ConsentContext; headers: [string, string][] } | (ConsentError & { status: 400 })>;
}
/** A failed connection call and its status; sign_in = sign in on that server first (401). */
export type ConnFail = { error: string; status: 400 | 401 | 403 | 404 | 429 | 502; sign_in?: true };
export type ApiCtx = { Variables: { email: string; svc: ApiServices } };

/** The public /auth routes' side (src/auth.ts authServices): no session needed, so it is its own app, mounted before
 *  the Worker's sign-in middleware. Sign-in itself is the redirect to deco Studio (src/auth.ts, /auth/studio/*). */
export interface AuthServices {
  sameOrigin: boolean;
  /** Where to go after login: a same-site app path, else /app. */
  safeNext(next: string | undefined): string;
  /** /login plus a query. */
  loginUrl(next: string | undefined, query: string): string;
  /** Drop this browser's session cookie. */
  logout(): void;
  /** Sign out every browser of the signed-in person. */
  logoutAll(): Promise<OkResult | AuthFail>;
  /** Where the caller (signed in or not) stands with a room, from its link: the access page's context. */
  roomAccess(roomId: string): Promise<AccessContext>;
  /** A profile by handle (anyone, when public) or by email (someone you share a room with); null = not yours to see. */
  profile(who: string): Promise<ProfileResult | null>;
}
export type AuthFail = { error: string; status: 400 | 401 | 403 | 429 | 502 };
export type AuthCtx = { Variables: { auth: AuthServices } };

/** A JSON body checked against its shared schema; anything else is a 400 { error } before the handler runs. */
const body = <S extends z.ZodMiniType>(schema: S, error = "bad request") =>
  validator("json", (value, c) => {
    const r = schema.safeParse(value);
    return r.success ? (r.data as z.output<S>) : c.json({ error } satisfies ErrorBody, 400);
  });
/** The test push when you turn notifications on, in your language, with your first name if we know it. */
export function testPush(en: boolean, name: string | null) {
  const first = name?.trim().split(/\s+/)[0] ?? "";
  return en
    ? { title: "deco.chat notifications are on 👋", body: `Hi${first ? ` ${first}` : ""}! We'll let you know when someone talks to you.` }
    : { title: "Notificações do deco.chat ativadas 👋", body: `Oi${first ? `, ${first}` : ""}! A gente te avisa quando alguém falar com você.` };
}
const ok = { ok: true as const } satisfies OkResult;
const forbidden = { error: "forbidden" } satisfies ErrorBody;
const sfuDown = (error: unknown) => ({ error: (error instanceof Error ? error.message : String(error)).slice(0, 200) }) satisfies ErrorBody;

const roomPosts = new Hono<ApiCtx>()
  .post(
    "/api/books/:id/post",
    validator("json", (value, c) => {
      const r = PostMessageBody.safeParse(value);
      return r.success ? r.data : c.json({ ok: false as const, error: "invalid message payload" } satisfies PostMessageResult, 400);
    }),
    async (c) => {
      const svc = c.get("svc"), id = c.req.param("id");
      if (!(await svc.isMember(id))) return c.json({ ok: false as const, error: "forbidden" } satisfies PostMessageResult, 403);
      const { text, thread, client_id } = c.req.valid("json");
      const out = await svc.humanPost(id, text, thread || "main", client_id);
      if (!out.ok) return c.json({ ok: false as const, error: out.error } satisfies PostMessageResult, 400);
      svc.track("home_route_sent", { book: id, epic: out.thread !== "main" });
      return c.json({ ok: true as const, id: out.id, thread: out.thread } satisfies PostMessageResult, 200);
    },
  )
  // Binary upload: the body is the file; headers carry its type and name. Stored in R2 under <book>/<file> (rooms.ts).
  .post(
    "/api/books/:id/files",
    validator("header", (value, c) => {
      const r = UploadHeaders.safeParse(value);
      // The validator's context is untyped: name the services' type so the 415 body stays { error: string }.
      const svc: ApiServices = c.get("svc");
      return r.success ? r.data : c.json({ error: svc.typesError } satisfies ErrorBody, 415);
    }),
    async (c) => {
      const svc = c.get("svc"), id = c.req.param("id");
      if (!(await svc.isMember(id))) return c.json(forbidden, 403);
      const h = c.req.valid("header");
      const type = h["content-type"].split(";")[0].trim().toLowerCase();
      if (!svc.fileTypes.includes(type)) return c.json({ error: svc.typesError } satisfies ErrorBody, 415);
      try {
        const bytes=await requestBytes(c.req.raw, svc.maxBytes(type));
        if(!(await svc.isMember(id)))return c.json(forbidden,403);
        const meta = await svc.storeFile(id, type, bytes, decodeURIComponent(h["x-filename"] ?? ""));
        svc.track("file_uploaded", { book: id, type, size: meta.size });
        return c.json(meta satisfies UploadFileResult, 200);
      } catch (e) {
        if(!(await svc.isMember(id)))return c.json(forbidden,403);
        if (e instanceof RequestBytesError) return c.json({ error: svc.sizeError(type) } satisfies ErrorBody, e.reason === "limit" ? 413 : 400);
        return c.json({ error: e instanceof Error ? e.message : String(e) } satisfies ErrorBody, 400);
      }
    },
  );

export const api = roomPosts
  // Native notifications: this device's push subscription (the app's 🔔). One row per endpoint.
  .get("/api/push/key", (c) => c.json({ key: c.get("svc").vapidKey } satisfies PushKeyResult, 200))
  .post("/api/push/subscribe", body(PushSubscribeBody, "bad subscription"), async (c) => {
    const b = c.req.valid("json"), svc = c.get("svc");
    await svc.sql(`INSERT OR REPLACE INTO push_subs (endpoint, email, p256dh, auth, ua, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      b.endpoint, c.get("email"), b.p256dh.slice(0, 200), b.auth.slice(0, 100), (c.req.header("user-agent") ?? "").slice(0, 200), Date.now());
    svc.track("push_subscribed");
    return c.json(ok, 200);
  })
  .post("/api/push/unsubscribe", body(PushUnsubscribeBody), async (c) => {
    await c.get("svc").sql(`DELETE FROM push_subs WHERE endpoint = ? AND email = ?`, c.req.valid("json").endpoint ?? "", c.get("email"));
    return c.json(ok, 200);
  })
  // The welcome push when you turn notifications on (settings → This device): to that device only.
  .post("/api/push/test", body(PushTestBody), async (c) => {
    const svc = c.get("svc"), { endpoint } = c.req.valid("json");
    const [row] = await svc.sqlAll(`SELECT name FROM users WHERE email = ?`, c.get("email"));
    const name = zm.object({ name: zm.nullable(zm.string()) }).safeParse(row);
    const sent = await svc.pushToMe({ ...testPush(svc.en, name.success ? name.data.name : null), url: "/", tag: "test" }, endpoint);
    svc.track("push_test", { sent, device: endpoint ? 1 : 0 });
    return c.json({ ok: true as const, sent } satisfies PushTestResult, 200);
  })
  // ✓ on a wait: "I answered elsewhere / not for me" (asks only).
  .post("/api/waits/resolve", body(ResolveWaitBody), async (c) => {
    const { book_id, ref } = c.req.valid("json"), svc = c.get("svc");
    await svc.sql(`DELETE FROM waits WHERE book_id = ? AND ref = ? AND email = ?`, book_id, ref, c.get("email"));
    svc.pokeMe(); // your other tabs and devices
    svc.waitCleared(book_id, ref);
    svc.track("wait_resolved", { book: book_id });
    return c.json(ok, 200);
  })
  // "Resolve all" in the Inbox: many asks in one request, each scoped to the signed-in person.
  .post("/api/waits/resolve-many", body(ResolveWaitsBody), async (c) => {
    const { items } = c.req.valid("json"), svc = c.get("svc"), email = c.get("email");
    await svc.sqlBatch(`DELETE FROM waits WHERE book_id = ? AND ref = ? AND email = ?`, items.map((item) => [item.book_id, item.ref, email]));
    svc.pokeMe();
    svc.track("wait_resolved", { n: items.length, many: 1 });
    return c.json(ok, 200);
  })
  // "Marcar como feita" on an open thread in the Inbox: the thread is done, as from its own bar (src/book.ts inboxDone).
  .post("/api/books/:id/threads/:epic/done", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    if (!(await svc.threadDone(id, c.req.param("epic")))) return c.json({ error: "no open thread" } satisfies ErrorBody, 404);
    svc.pokeMe();
    return c.json(ok, 200);
  })
  // The rail's order, per person (drag a tile).
  .post("/api/rooms/order", body(RoomOrderBody), async (c) => {
    const list = c.req.valid("json").ids.filter((x): x is string => typeof x === "string").slice(0, 300);
    if (!list.length) return c.json({ error: "ids required" } satisfies ErrorBody, 400);
    const email = c.get("email");
    await c.get("svc").sqlBatch(`UPDATE members SET position = ? WHERE book_id = ? AND email = ?`, list.map((id, i) => [i, id, email]));
    return c.json(ok, 200);
  })
  // A room's color on your rail (yours only).
  .post("/api/books/:id/tint", body(TintBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const { tint } = c.req.valid("json");
    const known = (TINTS as readonly string[]).includes(tint ?? "");
    await svc.sql(`UPDATE members SET tint = ? WHERE book_id = ? AND email = ?`, known ? tint ?? null : null, id, c.get("email"));
    return c.json(ok, 200);
  })
  // Archive is per person; archived: false restores.
  .post("/api/books/:id/archive", body(ArchiveBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const { archived } = c.req.valid("json");
    await svc.sql(`UPDATE members SET archived_at = ? WHERE book_id = ? AND email = ?`, archived === false ? null : Date.now(), id, c.get("email"));
    svc.track(archived === false ? "book_restored" : "book_archived", { book: id });
    return c.json(ok, 200);
  })
  // "Mark as read" in a room's menu: everything in the room up to now, for you only.
  .post("/api/books/:id/read", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    await svc.sql(
      `INSERT INTO human_reads (email, book_id, last_id) SELECT ?, id, coalesce(last_msg_id, 0) FROM books WHERE id = ? ON CONFLICT(email, book_id) DO UPDATE SET last_id = max(last_id, excluded.last_id)`,
      c.get("email"),
      id,
    );
    // Like Discord's: marking the room read also clears what waited on you there (asks, reviews), so its number goes.
    // Your open threads (e<epic>) stay: reading is not closing them.
    await svc.sql(`DELETE FROM waits WHERE book_id = ? AND email = ? AND ref NOT LIKE 'e%'`, id, c.get("email"));
    svc.pokeMe(); // your other tabs and devices
    svc.track("book_marked_read", { book: id });
    return c.json(ok, 200);
  });

// Account and room lists.
export const accountApi = api
  .get("/api/archived", async (c) => {
    const rows = await c.get("svc").sqlAll(
      `SELECT b.id, b.title, b.folder, b.summary, b.updated_at, m.archived_at,
         (SELECT group_concat(email) FROM members m2 WHERE m2.book_id = b.id) AS members
       FROM books b JOIN members m ON m.book_id = b.id
       WHERE m.email = ? AND m.archived_at IS NOT NULL ORDER BY m.archived_at DESC`,
      c.get("email"),
    );
    return c.json({ books: zm.array(ArchivedRoom).parse(rows) } satisfies ArchivedResult, 200);
  })
  .get("/api/search", validator("query", (value,c) => {
    // Hono gives repeated keys as arrays; query() previously used the first.
    const r=SearchQuery.safeParse({q:Array.isArray(value.q)?value.q[0]:value.q});
    return r.success?r.data:c.json({error:"bad request"} satisfies ErrorBody,400);
  }), async (c) => {
    const q = (c.req.valid("query").q ?? "").trim().slice(0, 120);
    const none: SearchResult = { rooms: 0, epics: [], messages: [] }; // typed, so both answers are one SearchResult
    if (q.length < 2) return c.json(none, 200);
    const out = await c.get("svc").search(q);
    if (!out) return c.json({ error: "rate limited" } satisfies ErrorBody, 429);
    return c.json(out satisfies SearchResult, 200);
  })
  .get("/api/inbox", async (c) => c.json((await c.get("svc").inbox()) satisfies InboxResult, 200))
  .get("/api/me/logins", async (c) => {
    const svc = c.get("svc");
    const rows = await svc.sqlAll(`SELECT COALESCE(json_extract(dims, '$.method'), 'email') AS method, MAX(ts) AS last, COUNT(*) AS n FROM events WHERE user = ? AND name = 'login' GROUP BY 1`, c.get("email"));
    return c.json(LoginsResult.parse({ logins: rows }) satisfies LoginsResult, 200);
  })
  .post("/api/friends", body(ConnectBody, "invalid email"), async (c) => {
    const svc = c.get("svc"), { email, text } = c.req.valid("json"), who = email.trim().toLowerCase();
    if (!svc.isEmail(who)) return c.json({ error: "invalid email" } satisfies ErrorBody, 400);
    const r = await svc.connect(who, text);
    if (r.error === "rate") return c.json({ error: "rate limited" } satisfies ErrorBody, 429);
    if (r.error) return c.json({ error: r.error } satisfies ErrorBody, 400);
    return c.json((r.id ? { ok: true as const, id: r.id } : { ok: true as const }) satisfies ConnectResult, 200);
  })
  .delete("/api/friends/:email", async (c) => {
    const me = c.get("email"), who = decodeURIComponent(c.req.param("email")).toLowerCase();
    if (who !== me) await c.get("svc").dismiss(who);
    return c.json(ok, 200);
  })
  .post("/api/books/:id/invite", body(InviteAnswerBody), async (c) => {
    if (!(await c.get("svc").answerInvite(c.req.param("id"), c.req.valid("json").yes))) return c.json({ error: "no invite" } satisfies ErrorBody, 404);
    return c.json(ok, 200);
  })
  .post("/api/books/:id/members", body(EmailBody, "invalid email"), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    // A DM is for its two people (src/dm.ts): start a room to bring a third.
    if (isDmId(id)) return c.json({ error: "a DM is only for its two people" } satisfies ErrorBody, 400);
    const who = c.req.valid("json").email.trim().toLowerCase();
    if (!svc.isEmail(who)) return c.json({ error: "invalid email" } satisfies ErrorBody, 400);
    await svc.invite(id, who);
    return c.json(ok, 200);
  })
  .delete("/api/books/:id/members/:email", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    if (isDmId(id)) return c.json({ error: "a DM is only for its two people" } satisfies ErrorBody, 400);
    const no = await svc.removeMember(id, decodeURIComponent(c.req.param("email")).toLowerCase());
    if (no?.status === 400) return c.json({ error: no.error } satisfies ErrorBody, 400);
    if (no) return c.json({ error: no.error } satisfies ErrorBody, 403);
    return c.json(ok, 200);
  });

// "Ligar Claude" and access requests.
export const roomApi = accountApi
  .post("/api/books/:id/claude", body(ClaudeToggleBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const on = !!c.req.valid("json").on;
    await svc.sql(`UPDATE members SET claude_on = ? WHERE book_id = ? AND email = ?`, on ? 1 : 0, id, c.get("email"));
    svc.pokeAgents(id);
    svc.track(on ? "claude_on" : "claude_off", { book: id });
    return c.json({ ok: true as const, claude_on: on } satisfies ClaudeToggleResult, 200);
  })
  // Delivery switches (src/delivery.ts), your own only: a machine (a computer running herdr, or a sandbox of yours in
  // this room), a one-off agent, or everything of yours here. Turning on wakes your listeners for the room.
  .post("/api/books/:id/delivery", body(DeliveryBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id"), email = c.get("email");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const { on, machine, agent, all } = c.req.valid("json");
    const v = on ? 1 : 0;
    const sandboxes = await svc.sqlAll(`SELECT id FROM sandboxes WHERE book_id = ? AND email = ?`, id, email);
    const sbIds = sandboxes.map((r) => sandboxMachine(String((r as { id: string }).id)));
    if (all) {
      // Every switch at once: the default for your computers (members.claude_on, which also opens or keeps their
      // Claude), your sandboxes here, and every one-off agent of yours that has been in this room.
      await svc.sql(`UPDATE members SET claude_on = ? WHERE book_id = ? AND email = ?`, v, id, email);
      await svc.sql(`DELETE FROM machine_rooms WHERE book_id = ? AND machine_id IN (SELECT id FROM machines WHERE email = ?)`, id, email);
      for (const m of sbIds) await svc.sql(`INSERT OR REPLACE INTO machine_rooms (machine_id, book_id, on_) VALUES (?, ?, ?)`, m, id, v);
      await svc.sql(
        `INSERT OR REPLACE INTO agent_rooms (agent, book_id, delivery)
         SELECT a.id, ?1, ?3 FROM agents a JOIN agent_reads r ON r.agent = a.id AND r.book_id = ?1 WHERE a.email = ?2 AND a.machine_id IS NULL`,
        id, email, v,
      );
    } else if (machine) {
      const owned = sbIds.includes(machine) || (await svc.sqlAll(`SELECT 1 FROM machines WHERE id = ? AND email = ?`, machine, email)).length > 0;
      if (!owned) return c.json({ error: "not your machine" } satisfies ErrorBody, 404);
      await svc.sql(`INSERT OR REPLACE INTO machine_rooms (machine_id, book_id, on_) VALUES (?, ?, ?)`, machine, id, v);
    } else if (agent) {
      const mine = await svc.sqlAll(`SELECT machine_id FROM agents WHERE id = ? AND email = ?`, agent, email);
      if (!mine.length) return c.json({ error: "not your agent" } satisfies ErrorBody, 404);
      if ((mine[0] as { machine_id: string | null }).machine_id) return c.json({ error: "this agent follows its machine's switch" } satisfies ErrorBody, 400);
      await svc.sql(`INSERT OR REPLACE INTO agent_rooms (agent, book_id, delivery) VALUES (?, ?, ?)`, agent, id, v);
    } else return c.json({ error: "say which: machine, agent or all" } satisfies ErrorBody, 400);
    svc.pokeAgents(id);
    if (on) svc.pokeListeners(id);
    svc.track(on ? "delivery_on" : "delivery_off", { book: id, which: all ? "all" : machine ? "machine" : "agent" });
    return c.json({ ok: true as const } satisfies DeliveryResult, 200);
  })
  // The room's call (src/calls.ts): the browser negotiates WebRTC with the SFU through these routes.
  .post("/api/books/:id/call/join", validator("query", (value) => ({ thread: (Array.isArray(value.thread) ? value.thread[0] : value.thread) ?? "main" })), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    if (!svc.callsOn) return c.json({ error: "calls are off" } satisfies ErrorBody, 404);
    if (!(await svc.allowCall())) return c.json({ error: "rate limited: wait a minute" } satisfies ErrorBody, 429);
    try {
      const out = await svc.callJoin(id, c.req.valid("query").thread.slice(0, 80));
      svc.track("call_join", { book: id });
      return c.json(out satisfies CallJoinResult, 200);
    } catch (error) {
      return c.json(sfuDown(error), 502);
    }
  })
  .post("/api/books/:id/call/tracks", body(CallTracksBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!svc.callsOn || !(await svc.isMember(id))) return c.json(forbidden, 403);
    try {
      const body = c.req.valid("json"), out = await svc.callTracks(id, body);
      if (out === "forbidden") return c.json(forbidden, 403);
      if (out === "limit") {
        svc.track("call_screen_limit", { book: id });
        return c.json({ error: CALL_LIMIT } satisfies ErrorBody, 409);
      }
      if (body.push?.some((p) => p.name === "screen")) svc.track("call_screen", { book: id });
      return c.json(out satisfies CallSfuResult, 200);
    } catch (error) {
      return c.json(sfuDown(error), 502);
    }
  })
  .post("/api/books/:id/call/answer", body(CallAnswerBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!svc.callsOn || !(await svc.isMember(id))) return c.json(forbidden, 403);
    try {
      const { session, answer } = c.req.valid("json");
      return (await svc.callAnswer(id, session, answer)) ? c.json(ok, 200) : c.json(forbidden, 403);
    } catch (error) {
      return c.json(sfuDown(error), 502);
    }
  })
  .post("/api/books/:id/call/close", body(CallCloseBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!svc.callsOn || !(await svc.isMember(id))) return c.json(forbidden, 403);
    try {
      const { session, mids, names } = c.req.valid("json");
      return (await svc.callClose(id, session, mids, names ?? [])) ? c.json(ok, 200) : c.json(forbidden, 403);
    } catch (error) {
      return c.json(sfuDown(error), 502);
    }
  })
  .post("/api/books/:id/call/leave", body(CallLeaveBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!svc.callsOn || !(await svc.isMember(id))) return c.json(forbidden, 403);
    await svc.callLeave(id, c.req.valid("json").session);
    return c.json(ok, 200);
  })
  .post("/api/books/:id/call/decline", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!svc.callsOn || !(await svc.isMember(id))) return c.json(forbidden, 403);
    await svc.callDecline(id);
    return c.json(ok, 200);
  })
  .post("/api/books/:id/stt", validator("query",(value,c)=>{
    const r=SttQuery.safeParse({lang:Array.isArray(value.lang)?value.lang[0]:value.lang,prompt:Array.isArray(value.prompt)?value.prompt[0]:value.prompt});
    return r.success?r.data:c.json({ok:false as const,error:"bad request"},400);
  }),async(c)=>{
    const svc=c.get("svc"),id=c.req.param("id");
    if(!(await svc.isMember(id)))return c.json({ok:false as const,error:"forbidden"},403);
    if(!(await svc.allowStt()))return c.json({ok:false as const,error:"rate limited: wait a few seconds"},429);
    let audio:Uint8Array;
    try{audio=await speechAudio(c.req.raw);}catch{return c.json({ok:false as const,error:"audio empty or over 4 MB"},400);}
    if(!(await svc.isMember(id)))return c.json({ok:false as const,error:"forbidden"},403);
    const started=Date.now();
    try{
      const out=SttResult.parse(await svc.transcribe(audio,c.req.valid("query")));
      if(!(await svc.isMember(id)))return c.json({ok:false as const,error:"forbidden"},403);
      svc.track("stt",{book:id,ms:Date.now()-started,bytes:audio.byteLength});
      return c.json(out,200);
    }catch(error){
      if(!(await svc.isMember(id)))return c.json({ok:false as const,error:"forbidden"},403);
      return c.json({ok:false as const,error:(error instanceof Error?error.message:String(error)).slice(0,200)},502);
    }
  })
  // ↗ through the person's channel to their CLI hub, which asks the local herdr runner: the page never talks to
  // 127.0.0.1 itself, so the browser's Local Network Access permission isn't needed (Gui, 14/11).
  .post("/api/books/:id/focus", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    svc.pokeFocus(id);
    return c.json(ok, 200);
  })
  .post("/api/books/:id/request", async (c) => {
    const r = await c.get("svc").requestAccess(c.req.param("id"));
    if (r === "not_found") return c.json({ error: "not found" } satisfies ErrorBody, 404);
    if (r === "limited") return c.json({ error: "rate limited" } satisfies ErrorBody, 429);
    const out: AccessRequestResult = r === "member" ? { ok: true, member: true } : { ok: true };
    return c.json(out, 200);
  })
  .post("/api/books/:id/requests", body(DecideRequestBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const { email, ok: approve } = c.req.valid("json");
    if (!(await svc.decideRequest(id, email.toLowerCase(), approve))) return c.json({ error: "no such request" } satisfies ErrorBody, 404);
    svc.track(approve ? "access_approved" : "access_denied", { book: id });
    return c.json(ok, 200);
  })
  .get(
    "/api/books/:id/messages",
    validator("query", (value, c) => {
      const r = MessagesQuery.safeParse(value);
      return r.success ? r.data : c.json({ error: "invalid query" } satisfies ErrorBody, 400);
    }),
    async (c) => {
      const svc = c.get("svc"), id = c.req.param("id");
      if (!(await svc.isMember(id))) return c.json(forbidden, 403);
      c.header("Cache-Control", "private, no-store");
      return c.json((await svc.roomMessages(id, c.req.valid("query"))) satisfies MessagesPage, 200);
    },
  )
  .get(
    "/api/books/:id/link",
    validator("query", (value, c) => {
      const r = LinkQuery.safeParse(value);
      return r.success ? r.data : c.json({ error: "invalid query" } satisfies ErrorBody, 400);
    }),
    async (c) => {
      // No 403 for a non-member: the answer is the same `private` as for a room that doesn't exist.
      c.header("Cache-Control", "private, no-store");
      return c.json((await c.get("svc").linkTarget(c.req.param("id"), c.req.valid("query"))) satisfies LinkResolution, 200);
    },
  )
  .get("/api/books/:id/access", async (c) => c.json({ member: await c.get("svc").isMember(c.req.param("id")) } satisfies AccessResult, 200));

const tooManyAsks = (en: boolean) => ({ error: en ? "Too many requests in a row. Wait a minute." : "Muitos pedidos seguidos. Espera um minuto." }) satisfies ErrorBody;
// Your name, new rooms and the home's router. Model answers are parsed with their schema before they leave.
export const homeApi = roomApi
  .post("/api/me", body(SetNameBody), async (c) => {
    const clean = (c.req.valid("json").name ?? "").replace(/[<>"@\p{Cc}]/gu, "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (!clean) return c.json({ error: c.get("svc").en ? "Empty name." : "Nome vazio." } satisfies ErrorBody, 400);
    await c.get("svc").sql(`UPDATE users SET name = ? WHERE email = ?`, clean, c.get("email"));
    return c.json({ ok: true as const, name: clean } satisfies SetNameResult, 200);
  })
  .post("/api/books", body(CreateRoomBody), async (c) => {
    const svc = c.get("svc"), id = await svc.createRoom(c.req.valid("json").title);
    svc.track("book_created", { book: id });
    return c.json({ id } satisfies CreateRoomResult, 200);
  })
  .post("/api/books/start", body(TextBody), async (c) => {
    const svc = c.get("svc"), text = (c.req.valid("json").text ?? "").trim();
    if (!text) return c.json({ error: svc.en ? "Write what it is and who it's with." : "Escreva o que é e com quem." } satisfies ErrorBody, 400);
    const out = await svc.startRoom(text);
    if (out === false) return c.json(tooManyAsks(svc.en), 429);
    return c.json(StartRoomResult.parse(out) satisfies StartRoomResult, 200);
  })
  .post("/api/route", body(TextBody), async (c) => {
    const svc = c.get("svc");
    if (!svc.sameOrigin) return c.json({ error: "bad origin" } satisfies ErrorBody, 403);
    const text = (c.req.valid("json").text ?? "").trim();
    if (!text) return c.json({ error: svc.en ? "Write something." : "Escreva alguma coisa." } satisfies ErrorBody, 400);
    try {
      const out = await svc.routeHome(text);
      if (out === false) return c.json(tooManyAsks(svc.en), 429);
      return c.json(RouteResult.parse(out) satisfies RouteResult, 200);
    } catch {
      return c.json({ error: svc.en ? "Couldn't suggest one right now. Pick the room from the list below." : "Não consegui sugerir agora. Escolha a sala na lista abaixo." } satisfies ErrorBody, 502);
    }
  });

// Your freestyle.sh key and Claude subscription token (cloud agents). Only "connected" ever comes back.
const tooMany = (en: boolean) => ({ error: en ? "Too many tries. Wait a minute." : "Muitas tentativas. Espera um minuto." }) satisfies ErrorBody;
export const keysApi = homeApi
  .get("/api/freestyle", async (c) => {
    const rows = await c.get("svc").sqlAll(`SELECT 1 FROM freestyle_keys WHERE email = ?`, c.get("email"));
    return c.json({ connected: rows.length > 0 } satisfies ConnectedResult, 200);
  })
  .post("/api/freestyle", body(FreestyleKeyBody), async (c) => {
    const svc = c.get("svc");
    if (!(await svc.allowSecretTry(`fs:${c.get("email")}`))) return c.json(tooMany(svc.en), 429);
    const key = (c.req.valid("json").key ?? "").trim();
    if (key.length < 16 || key.length > 400) return c.json({ error: svc.en ? "That doesn't look like a freestyle API key." : "Essa não parece uma API key do freestyle." } satisfies ErrorBody, 400);
    const refused = await svc.checkFreestyleKey(key);
    if (refused !== null) return c.json({ error: svc.en ? `freestyle refused the key: ${refused}` : `O freestyle recusou a key: ${refused}` } satisfies ErrorBody, 400);
    await svc.saveSecret("freestyle_keys", key);
    svc.track("freestyle_connected");
    return c.json(ok, 200);
  })
  .delete("/api/freestyle", async (c) => {
    await c.get("svc").sql(`DELETE FROM freestyle_keys WHERE email = ?`, c.get("email"));
    return c.json(ok, 200);
  })
  // The person's Claude subscription token (from `claude setup-token` in their own terminal): sandboxes start logged in.
  .post("/api/claude-token", body(ClaudeTokenBody), async (c) => {
    const svc = c.get("svc");
    if (!(await svc.allowSecretTry(`ct:${c.get("email")}`))) return c.json(tooMany(svc.en), 429);
    // The terminal wraps the long token over lines: copied, it comes with spaces/newlines in the middle.
    const tok = (c.req.valid("json").token ?? "").replace(/\s+/g, "");
    if (!/^sk-ant-[A-Za-z0-9_.-]{20,2000}$/.test(tok)) return c.json({ error: svc.en ? "That doesn't look like a token from claude setup-token (it starts with sk-ant-)." : "Isso não parece um token do claude setup-token (começa com sk-ant-)." } satisfies ErrorBody, 400);
    await svc.saveSecret("claude_tokens", tok);
    svc.track("claude_token_saved");
    return c.json(ok, 200);
  })
  .delete("/api/claude-token", async (c) => {
    await c.get("svc").sql(`DELETE FROM claude_tokens WHERE email = ?`, c.get("email"));
    return c.json(ok, 200);
  });

// The room's Claudes (sessions connected to this room) and everyone's cloud sandboxes in it.
const limitsOf = (s: string | null) => {
  try {
    const r = AgentLimits.safeParse(s ? JSON.parse(s) : null);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
};
export const agentsApi = keysApi.get("/api/books/:id/agents", async (c) => {
  const svc = c.get("svc"), id = c.req.param("id"), now = Date.now();
  // In parallel; your own members row is also the membership check.
  const me0 = c.get("email");
  const [rows, machines, mine, sbx] = await Promise.all([
    // The sessions connected to this room: listening to it (or to all their rooms), or that read/posted here in the
    // last hour. Yours also when they were here in the last 14 days: a Claude of yours that stopped (or now listens in
    // another room) shows as "seen …", not as "no agent here yet" with the setup. Not every Claude of yours listening
    // anywhere: with herdr that's one per room, and every room listed all of them (Gui #3100, 17 rows).
    svc.sqlAll(
      `SELECT ag.id, ag.client, ag.machine_id, ag.email, coalesce(ag.model, ag.client) AS who, ag.repo, ag.seen_at, ag.listening_at, ag.listen_room, ag.ctx_tokens, ag.ctx_window, ag.ctx_at, ag.ctx_limits, r.seen_at AS here_at, lb.title AS listen_title, ${DELIVERS} AS delivers
       FROM agents ag JOIN members m ON m.email = ag.email AND m.book_id = ?1
       LEFT JOIN agent_reads r ON r.agent = ag.id AND r.book_id = ?1
       LEFT JOIN books lb ON lb.id = ag.listen_room
       ${deliveryJoins("?1")}
       WHERE substr(ag.id, 1, 2) != 'n_' AND (((ag.listen_room = ?1 OR ag.listen_room IS NULL) AND ag.listening_at > ?2) OR r.seen_at > ?3
         OR (ag.email = ?4 AND r.seen_at > ?5))
       ORDER BY ag.seen_at DESC LIMIT 40`,
      id,
      now - svc.listenFresh,
      now - 3600_000,
      me0,
      now - 14 * 86400_000,
    ),
    // Your computers that ran `vibebook herdr` in the last 14 days, with their switch here.
    svc.sqlAll(
      `SELECT x.id, x.name, x.kind, x.seen_at, coalesce(mr.on_, m.claude_on, 0) AS on_
       FROM machines x JOIN members m ON m.email = x.email AND m.book_id = ?1
       LEFT JOIN machine_rooms mr ON mr.machine_id = x.id AND mr.book_id = ?1
       WHERE x.email = ?2 AND x.seen_at > ?3 ORDER BY x.created_at`,
      id,
      me0,
      now - 14 * 86400_000,
    ),
    svc.sqlAll(`SELECT claude_on FROM members WHERE book_id = ? AND email = ?`, id, c.get("email")),
    // Everyone's cloud sandboxes in this room, as last seen by their owner's list (src/sandbox.ts): they cost money.
    svc.sqlAll(`SELECT s.id, s.email, s.name, s.state, s.run_s, s.rate, s.disk_rate, s.checked_at, s.created_at, coalesce(mr.on_, 1) AS on_ FROM sandboxes s LEFT JOIN machine_rooms mr ON mr.machine_id = 'sb_' || s.id AND mr.book_id = s.book_id WHERE s.book_id = ? ORDER BY s.created_at`, id),
  ]);
  const me=zm.object({claude_on:zm.optional(zm.unknown())}).safeParse(mine[0]);
  if(!me.success)return c.json(forbidden,403);
  const scalar=me.data.claude_on;
  const flag=zm.pick(ClaudeToggleResult,{claude_on:true}).safeParse({claude_on:scalar==null||scalar===0?false:scalar===1?true:scalar});
  if(!flag.success)console.error("membership Claude flag invalid");
  const out: AgentsResult = {
    claude_on: flag.success && flag.data.claude_on,
    sandboxes: sbx.flatMap((row) => { try { return [roomSandbox(row)]; } catch { console.error("room sandbox has invalid identity"); return []; } }),
    agents: rows.filter((row, i) => {
      // Yours: only the ones listening to this room now. A Claude that only read or posted here in the last hour is
      // usually closed, and listing it (with its switch and context) read as "4 other agents" (Nov 2026). When none of
      // yours listens, the newest one stays as "seen …", so the room doesn't show the setup.
      const a = row as { email: string; listening_at: number | null; listen_room: string | null };
      const live = (x: typeof a) => !!x.listening_at && now - x.listening_at < svc.listenFresh && (x.listen_room === id || !x.listen_room);
      const own = (x: unknown) => (x as typeof a).email === me0;
      if (!own(a) || live(a)) return true;
      return !rows.some((b, j) => own(b) && (live(b as typeof a) || j < i));
    }).map((row) => {
      const a = AgentDbRow.parse(row);
      return {
        email: a.email,
        who: a.who || "agent",
        repo: a.repo,
        seen_at: a.seen_at,
        listening: !!a.listening_at && now - a.listening_at < svc.listenFresh && (a.listen_room === id || !a.listen_room),
        all_rooms: !a.listen_room,
        // How full its context was at its last call (only from the CLI inside Claude Code); older than 1h = unknown.
        context: a.ctx_tokens != null && a.ctx_window && now - (a.ctx_at ?? 0) < 3600_000 ? { tokens: a.ctx_tokens, window: a.ctx_window, at: a.ctx_at, limits: limitsOf(a.ctx_limits) } : null,
        // Yours also say which room each one listens to: the herdr tab is named after it (Gui #3120), clearer than
        // the folder when one folder serves several rooms. Only yours: another person's room titles aren't yours to see.
        ...(a.email === me0 ? { id: a.id, client: a.client, machine: a.machine_id, delivery: a.delivers !== 0, room: a.listen_title ?? null } : {}),
      };
    }),
    machines: [
      ...machines.map((row) => {
        const x = MachineDbRow.parse(row);
        return { id: x.id, name: x.name || "computer", kind: x.kind === "herdr-app" ? ("herdr-app" as const) : ("herdr" as const), online: !!x.seen_at && now - x.seen_at < MACHINE_FRESH, seen_at: x.seen_at, on: x.on_ === 1 };
      }),
      ...sbx.flatMap((row) => {
        const s = row as { id: string; email: string; name: string | null; state: string | null; checked_at: number | null; on_: number };
        return s.email === me0 ? [{ id: sandboxMachine(s.id), name: s.name || "sandbox", kind: "sandbox" as const, online: s.state === "running", seen_at: s.checked_at, on: s.on_ !== 0 }] : [];
      }),
    ],
  };
  return c.json(out, 200);
});

// Your cloud sandboxes (freestyle.sh). Errors keep the old shape: { error } with 400/404/502.
const notFound = { error: "not found" } satisfies ErrorBody;
const failed = (e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }) satisfies ErrorBody;
const power = (act: "pause" | "start") => async (c: import("hono").Context<ApiCtx, "/api/sandboxes/:sid/pause" | "/api/sandboxes/:sid/start">) => {
  const r = await c.get("svc").sandboxes.power(c.req.param("sid"), act);
  if (r === "not_found") return c.json(notFound, 404);
  if (r !== null) return c.json({ error: r } satisfies ErrorBody, 502);
  return c.json(ok, 200);
};
export const sandboxApi = agentsApi
  .get("/api/books/:id/sandboxes", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    return c.json((await svc.sandboxes.list(id)) satisfies SandboxesResult, 200);
  })
  .post("/api/books/:id/sandboxes", body(CreateSandboxBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    try {
      const r = await svc.sandboxes.create(id, c.req.valid("json").name ?? "");
      return c.json({ ok: true as const, ...r } satisfies CreateSandboxResult, 200);
    } catch (e) {
      return c.json(failed(e), 400);
    }
  })
  .post("/api/sandboxes/:sid/pause", (c) => power("pause")(c))
  .post("/api/sandboxes/:sid/start", (c) => power("start")(c))
  .post("/api/sandboxes/:sid/setup", async (c) => {
    try {
      return c.json((await c.get("svc").sandboxes.setup(c.req.param("sid"))) satisfies SandboxSetupResult, 200);
    } catch (e) {
      return c.json(failed(e), 502);
    }
  })
  .delete("/api/sandboxes/:sid", async (c) => {
    if (!(await c.get("svc").sandboxes.remove(c.req.param("sid")))) return c.json(notFound, 404);
    return c.json(ok, 200);
  })
  .post("/api/sandboxes/:sid/terminal", async (c) => {
    try {
      const t = await c.get("svc").sandboxes.terminal(c.req.param("sid"));
      return t ? c.json(t satisfies SandboxTerminalResult, 200) : c.json(notFound, 404);
    } catch (e) {
      return c.json(failed(e), 502);
    }
  });

// The room's MCP connections. Sign-in and its OAuth callback stay browser redirects (src/mcpconn.ts).
const connFail = (r: ConnFail) => ({ error: r.error, ...(r.sign_in ? { sign_in: true as const } : {}) }) satisfies ConnectionError;
const uiQuery = validator("query", (value, c) => {
  const r = ConnectionUiQuery.safeParse(value);
  return r.success ? r.data : c.json({ error: "bad request" } satisfies ErrorBody, 400);
});
export const connectionsApi = sandboxApi
  .get("/api/books/:id/connections", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    return c.json(ConnectionsResult.parse(await svc.connections.list(id)), 200);
  })
  .post("/api/books/:id/connections", body(CreateConnectionBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const r = await svc.connections.create(id, c.req.valid("json"));
    return "error" in r ? c.json(connFail(r), r.status) : c.json(r satisfies CreateConnectionResult, 200);
  })
  .delete("/api/books/:id/connections/:cid", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const r = await svc.connections.remove(id, c.req.param("cid"));
    return "error" in r ? c.json(connFail(r), r.status) : c.json(ok, 200);
  })
  .post("/api/books/:id/connections/:cid/refresh", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const r = await svc.connections.refresh(id, c.req.param("cid"));
    return "error" in r ? c.json(connFail(r), r.status) : c.json(r satisfies RefreshConnectionResult, 200);
  })
  .get("/api/books/:id/connections/:cid/ui", uiQuery, async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const r = await svc.connections.ui(id, c.req.param("cid"), c.req.valid("query").tool ?? "");
    return "error" in r ? c.json(connFail(r), r.status) : c.json(r satisfies ConnectionUiResult, 200);
  })
  .post("/api/books/:id/connections/:cid/identity", async (c) => {
    c.header("Cache-Control", "no-store");
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const r = await svc.connections.identity(id, c.req.param("cid"));
    return "error" in r ? c.json(connFail(r), r.status) : c.json(ConnectionIdentityResult.parse(r), 200);
  })
  .post("/api/books/:id/connections/:cid/call", body(ConnectionCallBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const b = c.req.valid("json");
    const r = await svc.connections.call(id, c.req.param("cid"), b.name ?? "", b.arguments);
    return "error" in r ? c.json(connFail(r), r.status) : c.json(r satisfies ConnectionCallResult, 200);
  })
  .post("/api/books/:id/connections/:cid/context", body(ConnectionContextBody), async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const b = c.req.valid("json");
    const r = await svc.connections.context(id, c.req.param("cid"), (b.tool ?? "").slice(0, 100), (b.text ?? "").slice(0, 4000));
    return "error" in r ? c.json(connFail(r), r.status) : c.json(ok, 200);
  })
  .post("/api/books/:id/connections/:cid/signout", async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    const r = await svc.connections.signout(id, c.req.param("cid"));
    return "error" in r ? c.json(connFail(r), r.status) : c.json(ok, 200);
  });

// GET /api/me (POST /api/me sets your name).
export const meApi = connectionsApi
  .get("/api/me", async (c) => c.json((await c.get("svc").me()) satisfies MeResult, 200))
  .post("/api/me/profile", body(ProfileSettingsBody), async (c) => {
    const svc = c.get("svc"), on = c.req.valid("json").public;
    svc.track("profile_public", { on });
    return c.json((await svc.setProfilePublic(on)) satisfies ProfileSettingsResult, 200);
  })
  .post("/api/me/handle", body(SetHandleBody), async (c) => {
    const r = await c.get("svc").setHandle(c.req.valid("json").handle);
    if ("error" in r) return c.json({ error: r.error } satisfies ErrorBody, r.error === "taken" ? 409 : 400);
    return c.json(r satisfies SetHandleResult, 200);
  });

// The profile picture and the room icon, raw image bytes (the app resizes them first). Same-origin only.
const imageHeaders = validator("header", (value, c) => {
  const r = ImageHeaders.safeParse(value);
  return r.success ? r.data : c.json({ error: "bad request" } satisfies ErrorBody, 400);
});
const mediaType = (h: { "content-type"?: string }) => (h["content-type"] ?? "").split(";")[0].trim().toLowerCase();
const slowDown = (en: boolean) => ({ error: en ? "Too many uploads. Wait a minute." : "Muitos uploads. Espera um minuto." }) satisfies ErrorBody;
export const uploadsApi = meApi
  .post("/api/me/avatar", imageHeaders, async (c) => {
    const svc = c.get("svc");
    if (!svc.sameOrigin) return c.json({ error: "bad origin" } satisfies ErrorBody, 403);
    const type = mediaType(c.req.valid("header"));
    if (!AVATAR_TYPES.includes(type)) return c.json({ error: svc.en ? "Use a PNG, JPEG or WebP image." : "Use uma imagem PNG, JPEG ou WebP." } satisfies ErrorBody, 415);
    let bytes:ArrayBuffer;
    try { bytes=await requestBytes(c.req.raw,1_000_000); }
    catch(error){
      if(error instanceof RequestBytesError)return c.json({ error: svc.en ? "Image empty or over 1MB." : "Imagem vazia ou maior que 1MB." } satisfies ErrorBody, 413);
      throw error;
    }
    if (!(await svc.allowUpload())) return c.json(slowDown(svc.en), 429);
    const avatar = await svc.saveAvatar(type, bytes);
    svc.track("avatar_set");
    return c.json({ ok: true as const, avatar } satisfies AvatarResult, 200);
  })
  .post("/api/books/:id/icon", imageHeaders, async (c) => {
    const svc = c.get("svc"), id = c.req.param("id");
    if (!svc.sameOrigin) return c.json({ error: "bad origin" } satisfies ErrorBody, 403);
    if (!(await svc.isMember(id))) return c.json(forbidden, 403);
    if (!(await svc.allowUpload())) return c.json(slowDown(svc.en), 429);
    const type = mediaType(c.req.valid("header"));
    try {
      // A JSON body removes the icon; anything else is the image (setRoomIcon checks type and size).
      let image:{type:string;body:ArrayBuffer}|null=null;
      if(type==="application/json")await c.req.raw.body?.cancel().catch(()=>{});
      else {
        try { image={type,body:await requestBytes(c.req.raw,256_000)}; }
        catch(error){
          if(error instanceof RequestBytesError)return c.json({error:svc.en?"Icon empty or over 256KB.":"Ícone vazio ou maior que 256KB."} satisfies ErrorBody,400);
          throw error;
        }
      }
      const icon = await svc.setRoomIcon(id,image);
      svc.track("room_icon", { book: id, set: icon !== null });
      return c.json({ ok: true as const, icon } satisfies RoomIconResult, 200);
    } catch (e) {
      return c.json(failed(e), 400);
    }
  })
  // Your connected Claudes (OAuth grants), moved from src/connect.ts.
  .get("/api/agents", async (c) => c.json((await c.get("svc").grants.list()) satisfies AgentGrantsResult, 200))
  .post("/api/agents/revoke", body(RevokeAgentsBody, "ids must be a list"), async (c) => {
    const svc = c.get("svc");
    if (!svc.sameOrigin) return c.json({ error: "bad origin" } satisfies ErrorBody, 403);
    const removed = await svc.grants.revoke(c.req.valid("json").ids);
    return c.json({ ok: true as const, removed } satisfies RevokeAgentsResult, 200);
  })
  .delete("/api/agents/:id", async (c) => {
    const svc = c.get("svc");
    if (!svc.sameOrigin) return c.json({ error: "bad origin" } satisfies ErrorBody, 403);
    await svc.grants.revoke([c.req.param("id")]);
    return c.json(ok, 200);
  })
  // The agent-connect consent page's context (the approval itself stays the form POST /authorize).
  .get("/api/authorize/context", async (c) => {
    const r = await c.get("svc").consentContext();
    if ("error" in r) return c.json({ error: r.error, ...(r.redirect_to ? { redirect_to: r.redirect_to } : {}) } satisfies ConsentError, 400);
    for (const [k, v] of r.headers) c.header(k, v, { append: k.toLowerCase() === "set-cookie" });
    return c.json(r.context satisfies ConsentContext, 200);
  })
  // The hub router's A/B (src/router.ts), for the room app apps/roteador-ab.html (vibebook_router_stats).
  .get("/api/router/stats", async (c) => {
    const svc = c.get("svc"), room = c.req.query("room") || undefined;
    if (room && !(await svc.isMember(room))) return c.json(forbidden, 403);
    return c.json((await svc.routerStats(room)) satisfies RouterStats, 200);
  })
  // vibebook's model spend, for the report rooms' app apps/gastos-ia.html (vibebook_ai_spend).
  .get("/api/metrics/ai-spend", async (c) => {
    const svc = c.get("svc"), room = c.req.query("room") ?? "";
    if (!svc.reportRoom(room) || !(await svc.isMember(room))) return c.json(forbidden, 403);
    return c.json((await svc.aiSpend()) satisfies AiSpend, 200);
  })
  // The Worker and the site per day, for the report rooms' app apps/infra-monitor.html (vibebook_infra).
  .get("/api/metrics/infra", async (c) => {
    const svc = c.get("svc"), room = c.req.query("room") ?? "";
    if (!svc.reportRoom(room) || !(await svc.isMember(room))) return c.json(forbidden, 403);
    const days = InfraWindow.safeParse(Number(c.req.query("days") ?? 7));
    if (!days.success) return c.json({ error: "days must be 7, 14 or 30" } satisfies ErrorBody, 400);
    return c.json((await svc.infraMonitor(days.data)) satisfies InfraMonitor, 200);
  });

export type AppType = typeof uploadsApi;

const authFail = (f: AuthFail) => ({ error: f.error }) satisfies ErrorBody;
const badOrigin = { error: "bad origin" } satisfies ErrorBody;
/** Public auth routes (the login page, the consent page's sign-out). index.ts mounts them before its sign-in check. */
export const authApi = new Hono<AuthCtx>()
  .get(
    "/auth/context",
    validator("query", (value, c) => {
      const r = LoginContextQuery.safeParse(value);
      return r.success ? r.data : c.json({ error: "bad request" } satisfies ErrorBody, 400);
    }),
    (c) => {
      const auth = c.get("auth"), q = c.req.valid("query");
      const error = q.error === "studio" ? q.error : null;
      return c.json({ next: auth.safeNext(q.next), error } satisfies LoginContext, 200);
    },
  )
  .get("/auth/room/:id", async (c) => c.json((await c.get("auth").roomAccess(c.req.param("id"))) satisfies AccessContext, 200))
  // A profile card or page (src/profile.ts): public by handle when its owner turned it on, else only for people who
  // share a room with them. 404 either way, so a private handle can't be told from a missing one.
  .get("/auth/profile/:who", async (c) => {
    const p = await c.get("auth").profile(c.req.param("who"));
    return p ? c.json(p satisfies ProfileResult, 200) : c.json({ error: "not found" } satisfies ErrorBody, 404);
  })
  .post("/auth/logout", async (c) => {
    const auth = c.get("auth");
    auth.logout();
    // A form post (the consent page's "Not you?") signs out and goes back to the login with where it came from.
    // out=1 keeps the login page on screen: without it, /login goes to Studio, which can sign the same person in again.
    if (!c.req.header("content-type")?.includes("form")) return c.json(ok, 200);
    const next = auth.safeNext(String((await c.req.parseBody()).next ?? ""));
    return c.redirect(auth.loginUrl(next, `?next=${encodeURIComponent(next)}&out=1`), 303);
  })
  .post("/auth/logout-all", async (c) => {
    const auth = c.get("auth");
    if (!auth.sameOrigin) return c.json(badOrigin, 403);
    const r = await auth.logoutAll();
    return "error" in r ? c.json(authFail(r), r.status) : c.json(r satisfies OkResult, 200);
  });
export type AuthAppType = typeof authApi;
