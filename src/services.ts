import { transcribeSpeech, WHISPER_MODEL } from "./speechToText";
// The services the typed routes (src/api.ts) get, built per request from the Worker's bindings for the signed-in
// person. This is the one place that knows both Env and ApiServices; the routes and their browser-facing types don't.
import type { ApiServices } from "./api";
import type { Env } from "./index";
import * as z from "zod/mini";
import { LISTEN_FRESH, poke } from "./person";
import { EMAIL_RE } from "./auth";
import { cookieLang, reqLang } from "./lang";
import { uiShellPath, uiVariant, type UiVariant } from "../shared/uiVariant";
import { MeBook, MeData, MeFriend, MeFriendRequest, MeInvite, MePerson, MeResult, MeSentRequest, MeWait } from "../shared/schemas";
import { routeMessage } from "./route-home";
import { startRoom } from "./start-room";
import { canDm, dmIds, openDmWith } from "./dm";
import { findSecret } from "./secrets";
import { isDmId, MUTUAL } from "../shared/dm";
import { answerInvite, befriend, bookStub, invitesFor, joinRoom, createBook, FILE_TYPES, inbox, inviteMember, isMember, maxBytes, searchRooms, sizeError, setRoomIcon, storeFile, TYPES_ERROR, waitsFor } from "./rooms";
import { track } from "./track";
import { pushTo } from "./webpush";
import { checkFreestyleKey, sandboxOps, saveKey } from "./sandbox";
import { connOps } from "./mcpconn";
import { consentContext, grantOps } from "./connect";
import { routerStats } from "./router";
import { aiSpend } from "./reports";

// The app shell's version per UI variant, per isolate (a deploy is a new isolate): open tabs compare it to reload.
const appVersions = new Map<UiVariant, string>();
const ProfileName = z.pick(MeData, { name: true });
const ProfileAvatar = z.pick(MeData, { avatar: true });
async function currentVersion(env: Env, url: string) {
  const variant = uiVariant(url);
  let version = appVersions.get(variant);
  if (version === undefined) {
    version = ((await env.ASSETS.fetch(new Request(new URL(uiShellPath(url), url), { method: "HEAD" }))).headers.get("etag") ?? "").replace(/[^\w-]/g, "");
    appVersions.set(variant, version);
  }
  return version;
}

/** GET /api/me: served from your Person DO while nothing changed (rooms, waits and your own writes poke it stale). */
/** You and `col` share a room (both joined, not a DM); binds ?1 = you. */
const SHARED = (col: string) =>
  `EXISTS (SELECT 1 FROM members x JOIN members y ON y.book_id = x.book_id JOIN books k ON k.id = x.book_id AND k.dm IS NULL WHERE x.email = ?1 AND y.email = ${col})`;
const roomTitles = (json: string) => {
  try {
    const list: unknown = JSON.parse(json);
    return Array.isArray(list) ? list.filter((t): t is string => typeof t === "string").slice(0, 2) : [];
  } catch {
    return [];
  }
};

export async function meFor(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }, email: string, req: Request): Promise<MeResult> {
  const db = env.DB;
  const person = env.PEOPLE.get(env.PEOPLE.idFromName(email));
  const cached = await person.fetch("https://person/me").catch(() => null);
  if (cached?.ok) {
    // A cache written by an older deploy that no longer fits the schema is recomputed, not served.
    const hit = MeData.safeParse(await cached.json().catch(() => null));
    if (hit.success) return { ...hit.data, v: await currentVersion(env, req.url), cached: true };
  }
  // One round trip's worth: the four reads run together.
  const [books, friends, requests, sent, invites, people, me, waits] = await Promise.all([
    db.prepare(
      `SELECT b.id, b.title, b.folder, b.summary, b.dm IS NOT NULL AS dm, b.updated_at, b.created_at, b.icon, b.busy_until, m.position, m.tint, m.opened_at, coalesce(b.last_human_id, 0) AS last_human_id, coalesce(b.last_agent_id, 0) AS last_agent_id,
         coalesce(r.last_id, 0) AS read_id,
         (SELECT count(*) FROM sandboxes s WHERE s.book_id = b.id AND s.state = 'running') AS sandboxes_running,
         (SELECT group_concat(email) FROM members m2 WHERE m2.book_id = b.id) AS members
       FROM books b JOIN members m ON m.book_id = b.id
       LEFT JOIN human_reads r ON r.email = m.email AND r.book_id = b.id
       WHERE m.email = ? AND m.archived_at IS NULL AND (b.dm IS NULL OR b.last_msg_id IS NOT NULL) ORDER BY b.updated_at DESC`,
    ).bind(email).all(),
    db.prepare(
      `SELECT f.b AS email, u.name, u.avatar, u.email IS NOT NULL AS joined,
         (SELECT count(*) FROM members x JOIN members y ON x.book_id = y.book_id
           WHERE x.email = f.a AND y.email = f.b) AS shared
       FROM friends f LEFT JOIN users u ON u.email = f.b
       WHERE f.a = ? AND ${MUTUAL} ORDER BY shared DESC, f.b`,
    ).bind(email).all(),
    // Message requests: people outside your rooms who wrote to you and you haven't answered. A request from someone
    // you now share a room with is moot (you can just talk), so it's left out, like the rows old room invites wrote.
    db.prepare(
      `SELECT f.a AS email, u.name, u.avatar, f.msg FROM friends f LEFT JOIN users u ON u.email = f.a
       WHERE f.b = ?1 AND f.declined_at IS NULL AND NOT ${MUTUAL} AND NOT ${SHARED("f.a")} ORDER BY f.created_at DESC LIMIT 20`,
    ).bind(email).all(),
    db.prepare(`SELECT f.b AS email, f.msg, f.declined_at IS NOT NULL AS declined FROM friends f WHERE f.a = ?1 AND NOT ${MUTUAL} AND NOT ${SHARED("f.b")} ORDER BY f.created_at DESC LIMIT 50`).bind(email).all(),
    invitesFor(db, email),
    // People you share a room with (both joined), for "Nova mensagem": the rooms you share, most recent first.
    db.prepare(
      `SELECT y.email, u.name, u.avatar, max(k.updated_at) AS last,
              (SELECT json_group_array(t) FROM (SELECT k2.title AS t FROM members x2 JOIN members y2 ON y2.book_id = x2.book_id
                 JOIN books k2 ON k2.id = x2.book_id AND k2.dm IS NULL WHERE x2.email = ?1 AND y2.email = y.email ORDER BY k2.updated_at DESC LIMIT 2)) AS rooms
         FROM members x JOIN members y ON y.book_id = x.book_id AND y.email != x.email
         JOIN books k ON k.id = x.book_id AND k.dm IS NULL LEFT JOIN users u ON u.email = y.email
        WHERE x.email = ?1 GROUP BY y.email ORDER BY last DESC LIMIT 200`,
    ).bind(email).all<{ email: string; name: string | null; avatar: number | null; rooms: string }>(),
    db.prepare(`SELECT name, avatar, lang FROM users WHERE email = ?`).bind(email).first<Record<string, unknown>>(),
    waitsFor(db, email),
  ]);
  // Remember the language for emails sent later (mentions, invites): an explicit choice wins, else the browser's, once.
  // Your DM with each friend and your own ("Você"): src/dm.ts. An empty DM is left out of `books` above.
  const dms = await dmIds(env, email, friends.results.map((f) => String(f.email)));
  const lang = cookieLang(req) ?? (me?.lang ? null : reqLang(req));
  if (me && lang && lang !== me.lang) ctx.waitUntil(db.prepare(`UPDATE users SET lang = ? WHERE email = ?`).bind(lang, email).run());
  // Every D1 column is nullable: the columns a legacy row may leave empty get their neutral value, then each row is
  // checked on its own. A row that still doesn't fit is dropped and logged (never served or cached unchecked), so one
  // bad row costs that row, not the whole home.
  const dropped: string[] = [];
  const keep = <T>(list: string, schema: { safeParse(v: unknown): { success: true; data: T } | { success: false } }, rows: unknown[]) =>
    rows.flatMap((row) => {
      const r = schema.safeParse(row);
      if (r.success) return [r.data];
      dropped.push(list);
      return [];
    });
  // Optional historical profile data may be malformed independently. Preserve
  // each valid field; never invent a replacement for the required identity.
  const name = ProfileName.safeParse({ name: me?.name ?? null });
  const avatar = ProfileAvatar.safeParse({ avatar: me?.avatar ?? null });
  if (!name.success) dropped.push("profile.name");
  if (!avatar.success) dropped.push("profile.avatar");
  const out = MeData.parse({
    email,
    name: name.success ? name.data.name : null,
    avatar: avatar.success ? avatar.data.avatar : null,
    books: keep("books", MeBook, books.results),
    dm: dms.get(email.toLowerCase())!,
    friends: keep("friends", MeFriend, friends.results.map((f) => ({ ...f, joined: Number(f.joined ?? 0), shared: Number(f.shared ?? 0), dm: dms.get(String(f.email).toLowerCase()) }))),
    requests: keep("requests", MeFriendRequest, requests.results),
    sent: keep("sent", MeSentRequest, sent.results.map((r) => ({ ...r, declined: Number(r.declined ?? 0) }))),
    invites: keep("invites", MeInvite, invites),
    people: keep("people", MePerson, people.results.map((r) => ({ ...r, rooms: roomTitles(r.rooms) }))),
    waits: keep("waits", MeWait, waits.map((w) => ({ ...w, room: w.room ?? "", thread: w.thread ?? "main", author: w.author ?? "", text: w.text ?? "", ts: w.ts ?? 0 }))),
  });
  if (dropped.length) console.error("/api/me dropped rows off schema", dropped);
  const gen = cached?.headers.get("x-gen");
  if (gen) ctx.waitUntil(person.fetch("https://person/me", { method: "PUT", body: JSON.stringify(out), headers: { "x-gen": gen } }).then(() => {}, () => {}));
  return MeResult.parse({ ...out, v: await currentVersion(env, req.url) });
}

export function services(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }, email: string, req0: Request): ApiServices {
  return {
    isMember: (roomId) => isMember(env.DB, roomId, email),
    allowStt:async()=> (await env.UPLOAD_LIMIT.limit({key:`stt:${email}`})).success,
    transcribe:(audio,query)=>transcribeSpeech(audio,query,input=>env.AI.run(WHISPER_MODEL,input)),
    humanPost: (roomId, text, thread) => bookStub(env, roomId).humanPost(roomId, email, text, thread),
    storeFile: (roomId, type, body, name) => storeFile(env, roomId, email, type, body, name, { requireMember: true }),
    fileTypes: FILE_TYPES,
    maxBytes,
    sizeError,
    typesError: TYPES_ERROR,
    sql: async (query, ...binds) => { await env.DB.prepare(query).bind(...binds).run(); },
    sqlBatch: async (query, rows) => { const st = env.DB.prepare(query); await env.DB.batch(rows.map((r) => st.bind(...r))); return; },
    track: (name, dims) => ctx.waitUntil(track(env, name, { user: email, ...(dims ? { dims } : {}) })),
    pokeMe: () => ctx.waitUntil(poke(env, [email], { t: "me" })),
    vapidKey: env.VAPID_PUBLIC_KEY ?? null,
    pushToMe: (p) => pushTo(env, [email], p),
    sqlAll: async (query, ...binds) => (await env.DB.prepare(query).bind(...binds).all()).results,
    search: async (q) => {
      if (!(await env.AGENT_LIMIT.limit({ key: `search:${email}` })).success) return false;
      const out = await searchRooms(env, email, q);
      ctx.waitUntil(track(env, "search", { user: email, dims: { via: "app", hits: out.messages.length + out.epics.length, rooms: out.rooms } }));
      return out;
    },
    inbox: () => inbox(env, email),
    loginProviders: { google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), github: !!(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) },
    isEmail: (s) => EMAIL_RE.test(s),
    // Writing to someone (the + "Nova mensagem"): their request to you → accept it (their first message lands in the DM);
    // someone you can DM (a room in common, a connection, yourself) → the DM opens now; anyone else → a message request
    // that waits for their yes. The answer never says whether that email has an account.
    connect: async (who, text) => {
      const msg = (text ?? "").trim().slice(0, 2000);
      if (msg && findSecret(msg)) return { error: "Não enviei: parece um segredo. Segredo não entra na conversa." };
      // Sharing a room already lets you talk: an old request between you is moot and its message isn't replayed.
      const shared = await canDm(env.DB, email, who);
      const theirs = await env.DB.prepare(`SELECT 1 FROM friends WHERE a = ? AND b = ? AND declined_at IS NULL`).bind(who, email).first();
      if (theirs && !shared) await befriend(env.DB, email, who);
      const id = await openDmWith(env, email, who);
      if (id) {
        const dm = bookStub(env, id);
        // Taken once (a double accept can't post it twice), then posted as them.
        const first = theirs ? await env.DB.prepare(`SELECT msg FROM friends WHERE a = ? AND b = ? AND msg IS NOT NULL`).bind(who, email).first<{ msg: string }>() : null;
        const took = first && (await env.DB.prepare(`UPDATE friends SET msg = NULL WHERE a = ? AND b = ? AND msg = ?`).bind(who, email, first.msg).run()).meta.changes === 1;
        if (took && !shared) await dm.humanPost(id, who, first.msg);
        if (msg) await dm.humanPost(id, email, msg);
        ctx.waitUntil(poke(env, [email, who], { t: "me" }));
        ctx.waitUntil(track(env, theirs ? "dm_request_accepted" : "dm_opened", { user: email }));
        return { id };
      }
      if (!(await env.LOGIN_LIMIT.limit({ key: `dmreq:${email}` })).success) return { error: "rate" };
      // A request they turned down stays closed; sending again changes nothing (and says nothing).
      await env.DB.prepare(`INSERT INTO friends (a, b, created_at, msg) VALUES (?, ?, ?, ?) ON CONFLICT (a, b) DO UPDATE SET msg = excluded.msg, created_at = excluded.created_at WHERE friends.declined_at IS NULL`)
        .bind(email, who, Date.now(), msg || null)
        .run();
      ctx.waitUntil(poke(env, [email, who], { t: "me" }));
      ctx.waitUntil(track(env, "dm_request_sent", { user: email }));
      return {};
    },
    // Declines their message request, or cancels yours. A conversation that already exists isn't touched.
    dismiss: async (who) => {
      await env.DB.batch([
        env.DB.prepare(`UPDATE friends SET declined_at = ?3 WHERE a = ?1 AND b = ?2 AND declined_at IS NULL AND NOT EXISTS (SELECT 1 FROM friends r WHERE r.a = ?2 AND r.b = ?1)`).bind(who, email, Date.now()),
        env.DB.prepare(`DELETE FROM friends WHERE a = ?1 AND b = ?2 AND declined_at IS NULL AND NOT EXISTS (SELECT 1 FROM friends r WHERE r.a = ?2 AND r.b = ?1)`).bind(email, who),
      ]);
      ctx.waitUntil(poke(env, [email, who], { t: "me" }));
    },
    answerInvite: async (roomId, yes) => {
      const done = await answerInvite(env, roomId, email, yes);
      if (done) ctx.waitUntil(track(env, yes ? "invite_accepted" : "invite_declined", { user: email, dims: { book: roomId } }));
      return done;
    },
    invite: (roomId, who) => inviteMember(env, ctx, new URL(req0.url).origin, email, roomId, who, reqLang(req0)),
    removeMember: async (roomId, who) => {
      const book = await env.DB.prepare(`SELECT owner FROM books WHERE id = ?`).bind(roomId).first<{ owner: string }>();
      if (who === book?.owner) return { error: "O dono não pode ser removido.", status: 400 };
      // Someone who joined (a member with an account); an invite still waiting can be taken back by anyone in the room.
      const joined = !!(await env.DB.prepare(`SELECT 1 FROM members m JOIN users u ON u.email = m.email WHERE m.book_id = ? AND m.email = ?`).bind(roomId, who).first());
      if (joined && email !== book?.owner) return { error: "Só quem criou o vibebook remove quem já entrou.", status: 403 };
      await env.DB.batch([
        env.DB.prepare(`DELETE FROM members WHERE book_id = ? AND email = ?`).bind(roomId, who),
        // An invite still waiting is taken back; a declined one stays, so the room can't ask again during the hold.
        env.DB.prepare(`DELETE FROM invites WHERE book_id = ? AND email = ? AND declined_at IS NULL`).bind(roomId, who),
      ]);
      ctx.waitUntil(poke(env, [who], { t: "me" }));
      await bookStub(env, roomId).fetch("https://book/members-changed", { method: "POST" });
      return null;
    },
    pokeAgents: (roomId) => ctx.waitUntil(poke(env, [email], { t: "agents", book: roomId })),
    pokeListeners: (roomId) => ctx.waitUntil(poke(env, [email], { t: "me", book: roomId })),
    pokeFocus: (roomId) => ctx.waitUntil(poke(env, [email], { t: "focus", book: roomId })),
    requestAccess: async (roomId) => {
      // A DM can't be asked into (src/dm.ts): to anyone outside it, it doesn't exist.
      if (isDmId(roomId) || !(await env.DB.prepare(`SELECT 1 FROM books WHERE id = ?`).bind(roomId).first())) return "not_found";
      if (await isMember(env.DB, roomId, email)) return "member";
      if (!(await env.LOGIN_LIMIT.limit({ key: `ask:${email}` })).success) return "limited";
      const r = await env.DB.prepare(`INSERT OR IGNORE INTO access_requests (book_id, email, ts) VALUES (?, ?, ?)`).bind(roomId, email, Date.now()).run();
      if (r.meta.changes) {
        const name = (await env.DB.prepare(`SELECT name FROM users WHERE email = ?`).bind(email).first<{ name: string | null }>())?.name ?? undefined;
        await bookStub(env, roomId).fetch(`https://book/access-requested?book=${roomId}`, { method: "POST", body: JSON.stringify({ who: email, name }) });
        ctx.waitUntil(track(env, "access_requested", { user: email, dims: { book: roomId } }));
      }
      return "asked";
    },
    decideRequest: async (roomId, who, approve) => {
      if (isDmId(roomId)) return false;
      const req = await env.DB.prepare(`SELECT email FROM access_requests WHERE book_id = ? AND email = ? AND denied = 0`).bind(roomId, who).first<{ email: string }>();
      if (!req) return false;
      if (approve) {
        await env.DB.prepare(`DELETE FROM access_requests WHERE book_id = ? AND email = ?`).bind(roomId, req.email).run();
        // Asking to join was their yes: they're in now (the page they asked from opens the room, the email tells them).
        await joinRoom(env, roomId, req.email);
        await inviteMember(env, ctx, new URL(req0.url).origin, email, roomId, req.email, reqLang(req0), { joined: true });
      } else await env.DB.prepare(`UPDATE access_requests SET denied = 1 WHERE book_id = ? AND email = ?`).bind(roomId, req.email).run();
      await bookStub(env, roomId).fetch("https://book/requests-changed", { method: "POST" });
      return true;
    },
    createRoom: (title) => createBook(env, email, title),
    startRoom: async (text) => {
      if (!(await env.AI_LIMIT.limit({ key: email })).success) return false;
      const out = await startRoom(env, ctx, new URL(req0.url).origin, email, text, reqLang(req0));
      ctx.waitUntil(track(env, "book_created", { user: email, dims: { book: out.id, start: true, invited: out.invited.length, unknown: out.unknown.length, cost: out.cost } }));
      return out;
    },
    routeHome: async (text) => {
      if (!(await env.AI_LIMIT.limit({ key: email })).success) return false;
      const started = Date.now();
      try {
        const out = await routeMessage(env, email, text);
        ctx.waitUntil(track(env, "home_route", { user: email, dims: { ok: true, picked: !!out.pick, epic: !!out.pick?.epic_id, ms: Date.now() - started, cost: +out.cost.toFixed(6), model: env.MODEL_ROUTE } }));
        return out;
      } catch (e) {
        console.error("home route failed", String(e));
        ctx.waitUntil(track(env, "home_route", { user: email, dims: { ok: false, ms: Date.now() - started } }));
        throw e;
      }
    },
    sameOrigin: !req0.headers.get("origin") || req0.headers.get("origin") === new URL(req0.url).origin,
    allowSecretTry: async (key) => (await env.LOGIN_LIMIT.limit({ key })).success,
    saveSecret: (table, value) => saveKey(env, email, value, table),
    checkFreestyleKey: (key) => checkFreestyleKey(env, key),
    listenFresh: LISTEN_FRESH,
    sandboxes: sandboxOps(env, ctx, email, new URL(req0.url).origin),
    me: () => meFor(env, ctx, email, req0),
    allowUpload: async () => (await env.UPLOAD_LIMIT.limit({ key: email })).success,
    saveAvatar: async (type, bytes) => {
      await env.FILES.put(`avatars/${email}`, bytes, { httpMetadata: { contentType: type } });
      const v = Date.now();
      await env.DB.prepare(`UPDATE users SET avatar = ? WHERE email = ?`).bind(v, email).run();
      return v;
    },
    setRoomIcon: (roomId, img) => setRoomIcon(env, roomId, img),
    connections: connOps(env, ctx, email, new URL(req0.url).origin, track),
    grants: grantOps(env, ctx, email),
    consentContext: () => consentContext(env, req0, email),
    routerStats: (room) => routerStats(env.DB, email, room),
    reportRoom: (room) => (env.METRICS_ROOMS ?? "").split(",").map((x) => x.trim()).includes(room),
    aiSpend: () => aiSpend(env),
  };
}
