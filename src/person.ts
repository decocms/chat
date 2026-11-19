import { encodeCall } from "../shared/jsonRpc";
import { DurableObject } from "cloudflare:workers";
import type { Env } from "./index";
import type { PersonEvent } from "../shared/person";
import * as z from "zod/mini";
import { type Announced, type ContactPresence, isOnline, planPresence } from "./presence";

/** The app's sockets (/ws-me) carry this tag besides their wire: presence counts only them, never a CLI hub. */
const APP = "app";
/** One contact's state, sent from their Person DO to yours (POST /presence). `reply`: an answer to your own news. */
const PresenceNotice = z.object({ email: z.string(), online: z.boolean(), at: z.number(), reply: z.optional(z.boolean()) });

/** One per person (idFromName(email)): the app's push channel for what lives outside an open room (the rail's unread
 * dots and ✻, "esperando você", the room's Claudes and sandboxes). Sockets hibernate; a poke tells every open tab
 * "this changed, fetch it once" ({t:"me"} → /api/me, {t:"agents", book} → that room's /api/books/:id/agents).
 * It also keeps the last /api/me answer: served from here (no D1) until a {t:"me"} poke marks it stale, or 5 min.
 * Presence: it tells the Person DOs of your DM contacts when your app opens or closes (src/presence.ts), keeps theirs
 * (`p:<email>`) and sends them to your app as {t:"presence"}: the full list when a socket opens, then each change. */
export class Person extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // The CLI hub's keepalive (every 45s): answered without waking the object, so an idle socket stays free.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async fetch(req: Request) {
    if (req.headers.get("upgrade") === "websocket") {
      const url = new URL(req.url);
      const [client, server] = Object.values(new WebSocketPair());
      const app = url.pathname === "/ws-me";
      this.ctx.acceptWebSocket(server, app ? [socketWire(url), APP] : [socketWire(url)]);
      if (app) await this.appOpened(server, req.headers.get("x-person"));
      return new Response(null, { status: 101, webSocket: client });
    }
    const path = new URL(req.url).pathname;
    if (path === "/presence" && req.method === "POST") {
      const notice = PresenceNotice.safeParse(await req.json().catch(() => null));
      if (notice.success) await this.contactPresence(notice.data);
      return new Response(null, { status: 204 });
    }
    if (path === "/me") {
      // gen: bumped by every {t:"me"} poke, so an answer computed before a change never lands after it.
      const gen = (await this.ctx.storage.get<number>("gen")) ?? 0;
      if (req.method === "PUT") {
        if (Number(req.headers.get("x-gen")) === gen) await this.ctx.storage.put("me", { body: await req.text(), at: Date.now() });
        return new Response(null, { status: 204 });
      }
      const me = await this.ctx.storage.get<{ body: string; at: number }>("me");
      // The generation rides on hits too: a hit the Worker can't use (written by an older deploy, off today's schema) is
      // recomputed and replaced under the same race guard, instead of costing D1 reads until it expires.
      return me && Date.now() - me.at < 5 * 60e3
        ? new Response(me.body, { headers: { "content-type": "application/json", "x-gen": String(gen) } })
        : new Response(null, { status: 404, headers: { "x-gen": String(gen) } });
    }
    const msg = await req.text();
    if (msg.includes('"t":"me"')) { // stale: the next /api/me reads D1
      await this.ctx.storage.delete("me");
      await this.ctx.storage.put("gen", ((await this.ctx.storage.get<number>("gen")) ?? 0) + 1);
    }
    let rpc: string | undefined;
    for (const ws of this.ctx.getWebSockets())
      try { ws.send(this.ctx.getTags(ws)[0] === "jsonrpc" ? (rpc ??= encodeCall(JSON.parse(msg) as PersonEvent)) : msg); } catch {}
    return new Response(null, { status: 204 });
  }
  webSocketMessage() {} // the app only listens
  async webSocketClose(ws: WebSocket) {
    try { ws.close(); } catch {}
    if (this.ctx.getTags(ws).includes(APP)) await this.applyPresence("close", this.appSockets(ws));
  }
  async webSocketError(ws: WebSocket) { await this.webSocketClose(ws); }
  /** The end of the grace period, or the periodic refresh while online. */
  async alarm() { await this.applyPresence("alarm", this.appSockets()); }

  /** The open app sockets, without the one that is closing now. */
  private appSockets(closing?: WebSocket) {
    return this.ctx.getWebSockets(APP).filter((ws) => ws !== closing).length;
  }
  private async appOpened(ws: WebSocket, person: string | null) {
    const email = person?.toLowerCase();
    if (email && (await this.ctx.storage.get<string>("email")) !== email) await this.ctx.storage.put("email", email);
    // The new tab's first presence: everything this DO knows about the contacts, a stale "online" read as offline.
    const now = Date.now();
    const known = await this.ctx.storage.list<ContactPresence>({ prefix: "p:", limit: 500 });
    const people = [...known].map(([key, state]) => ({ email: key.slice(2), online: isOnline(state, now) }));
    try { ws.send(encodeCall({ t: "presence", people, all: 1 } satisfies PersonEvent)); } catch {}
    // The contacts hear about it off the upgrade's path.
    this.ctx.waitUntil(this.applyPresence("open", this.appSockets()));
  }
  private async applyPresence(event: "open" | "close" | "alarm", sockets: number) {
    const announced = await this.ctx.storage.get<Announced>("announced");
    const plan = planPresence(event, sockets, announced, Date.now());
    if (plan.alarm === null) await this.ctx.storage.deleteAlarm();
    else if (plan.alarm !== undefined) await this.ctx.storage.setAlarm(plan.alarm);
    if (plan.announce !== undefined) await this.announce(plan.announce);
  }
  /** Tell your DM contacts' Person DOs. The grace period coalesces flaps: a reload or a drop under 30 s sends nothing. */
  private async announce(online: boolean) {
    const email = await this.ctx.storage.get<string>("email");
    if (!email) return;
    const at = Date.now();
    await this.ctx.storage.put("announced", { online, at } satisfies Announced);
    await sendPresence(this.env, await dmContacts(this.env, email), { email, online, at });
  }
  /** A contact's news: keep it, show it on the open app sockets, and answer a contact this DO did not know yet
   *  with its own state (a new DM learns both dots without a wait for the next change). */
  private async contactPresence(notice: z.infer<typeof PresenceNotice>) {
    const contact = notice.email.toLowerCase();
    const key = `p:${contact}`;
    const before = await this.ctx.storage.get<ContactPresence>(key);
    if (before && before.at > notice.at) return; // an older message that came late
    await this.ctx.storage.put(key, { online: notice.online, at: notice.at } satisfies ContactPresence);
    const event = encodeCall({ t: "presence", people: [{ email: contact, online: isOnline(notice, Date.now()) }] } satisfies PersonEvent);
    for (const ws of this.ctx.getWebSockets(APP)) try { ws.send(event); } catch {}
    if (before || notice.reply) return;
    const [mine, announced] = await Promise.all([this.ctx.storage.get<string>("email"), this.ctx.storage.get<Announced>("announced")]);
    if (mine && mine !== contact && announced?.online && this.appSockets() > 0)
      await sendPresence(this.env, [contact], { email: mine, online: true, at: announced.at, reply: true });
  }
}

/** The people you share a DM with that has a message: the same people whose DM list shows you (/api/me), and the
 *  only ones who get your presence. One D1 read, only on a transition. */
export async function dmContacts(env: Pick<Env, "DB">, email: string) {
  const r = await env.DB.prepare(
    `SELECT DISTINCT p.email FROM members m JOIN books b ON b.id = m.book_id AND b.dm IS NOT NULL AND b.last_msg_id IS NOT NULL
       JOIN members p ON p.book_id = b.id AND p.email != m.email WHERE m.email = ? LIMIT 200`,
  ).bind(email.toLowerCase()).all<{ email: string }>();
  return r.results.map((x) => x.email);
}
function sendPresence(env: Pick<Env, "PEOPLE">, emails: string[], notice: z.infer<typeof PresenceNotice>) {
  const body = JSON.stringify(notice);
  return Promise.all(
    emails.map((e) =>
      env.PEOPLE.get(env.PEOPLE.idFromName(e.toLowerCase())).fetch("https://person/presence", { method: "POST", body }).catch(() => {}),
    ),
  );
}

/** The format a socket gets. The app (/ws-me) and a CLI hub from 1.6.21 (/mcp?wire=jsonrpc) get JSON-RPC
 * notifications. An older CLI hub (/mcp) gets the tagged JSON that it reads. */
export function socketWire(url: URL): "jsonrpc" | "tagged" {
  return url.pathname === "/ws-me" || url.searchParams.get("wire") === "jsonrpc" ? "jsonrpc" : "tagged";
}

/** Tell these people's open apps that something changed. Fire and forget, ≤50 people per call. */
export function poke(env: Env, emails: Iterable<string>, msg: PersonEvent) {
  const body = JSON.stringify(msg);
  return Promise.all(
    [...new Set(emails)].slice(0, 50).map((e) =>
      env.PEOPLE.get(env.PEOPLE.idFromName(e.toLowerCase())).fetch("https://person/poke", { method: "POST", body }).catch(() => {}),
    ),
  );
}
/** Everyone in a room. */
export async function pokeRoom(env: Env, bookId: string, msg: PersonEvent) {
  const r = await env.DB.prepare(`SELECT email FROM members WHERE book_id = ?`).bind(bookId).all<{ email: string }>();
  return poke(env, r.results.map((x) => x.email), msg);
}

/** This person and everyone they share a room with, DMs included (one D1 query, ≤200 people): a changed picture
 * reaches the other people's rails, DM lists and room skeletons, which carry its version from their own /api/me. */
export async function pokeRoommates(env: Env, email: string, msg: PersonEvent) {
  const me = email.toLowerCase();
  const r = await env.DB.prepare(
    `SELECT DISTINCT y.email FROM members x JOIN members y ON y.book_id = x.book_id WHERE x.email = ? AND y.email != x.email LIMIT 200`,
  ).bind(me).all<{ email: string }>();
  const all = [me, ...r.results.map((x) => x.email)];
  const parts = [];
  for (let i = 0; i < all.length; i += 50) parts.push(poke(env, all.slice(i, i + 50), msg));
  return Promise.all(parts);
}

/** How recent a listener's last call must be to count as listening: the CLI's hub checks in at least every 10 min
 * (a long-poll listener every 50s). */
export const LISTEN_FRESH = 12 * 60_000;
/** A listener's long-poll call: presence for the room's Pessoas. Its first call after a gap (started listening) pokes
 * the room's apps so "ouvindo" and "Abrindo seu Claude…" update without polling. */
export async function markListening(env: Env, agent: string, email: string, room: string, seen = false) {
  const now = Date.now();
  const was = await env.DB.prepare(`SELECT listening_at FROM agents WHERE id = ?`).bind(agent).first<{ listening_at: number | null }>();
  await env.DB.prepare(`UPDATE agents SET listening_at = ?, listen_room = ?${seen ? ", seen_at = ?1" : ""} WHERE id = ?`).bind(now, room || null, agent).run();
  if (!was?.listening_at || now - was.listening_at > LISTEN_FRESH) await (room ? pokeRoom(env, room, { t: "agents", book: room }) : poke(env, [email], { t: "agents", book: "*" }));
}
