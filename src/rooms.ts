import "server-only";
import { FILE_TYPES, maxBytes } from "../shared/composition";
export { AUDIO_TYPES, FILE_TYPES, MAX_FILE_BYTES, MAX_AUDIO_BYTES, maxBytes } from "../shared/composition";
import type { UploadFileResponse } from "../shared/rpc";
import { checkEmbed } from "./embed";
import { poke } from "./person";
// Room (deco.chat) operations shared by the app API and the agent MCP.
import type { Lang } from "./lang";
import { sendInviteEmail } from "./invite-mail";
import type { Env } from "./index";
import { findSecret, secretName } from "./secrets";
import { track } from "./track";
import { INBOX_MENTIONS_SQL } from "./digestItems";

export const isMember = async (db: D1Database, bookId: string, email: string) =>
  !!(await db.prepare(`SELECT 1 FROM members WHERE book_id = ? AND email = ?`).bind(bookId, email).first());

/** `a` accepts `b` (a row a→b). A connection = both rows, and it lets the two DM without sharing a room (src/dm.ts).
 *  A lone row b→a is b's message request to a; a accepting writes a→b. */
export const befriend = (db: D1Database, a: string, b: string) =>
  db.prepare(`INSERT INTO friends (a, b, created_at) VALUES (?, ?, ?) ON CONFLICT (a, b) DO UPDATE SET declined_at = NULL`).bind(a, b, Date.now()).run();

/** How long a turned-down invite keeps the room from asking again (and shows as "recusou" in People). */
export const DECLINE_HOLD_MS = 7 * 86_400_000;

/** Puts `who` in the room: they said yes to an invite, or asked to join and were let in. */
export async function joinRoom(env: Env, bookId: string, who: string) {
  await env.DB.batch([
    env.DB.prepare(`INSERT OR IGNORE INTO members (book_id, email) VALUES (?, ?)`).bind(bookId, who),
    env.DB.prepare(`DELETE FROM invites WHERE book_id = ? AND email = ?`).bind(bookId, who),
  ]);
  await bookStub(env, bookId).fetch("https://book/members-changed", { method: "POST" });
}

/** The invitee's answer: yes joins the room, no is kept (People shows "recusou") so the room can't ask again for a week. */
export async function answerInvite(env: Env, bookId: string, who: string, yes: boolean): Promise<boolean> {
  const inv = await env.DB.prepare(`SELECT inviter FROM invites WHERE book_id = ? AND email = ? AND declined_at IS NULL`).bind(bookId, who).first<{ inviter: string }>();
  if (!inv) return false;
  if (yes) await joinRoom(env, bookId, who);
  else {
    await env.DB.prepare(`UPDATE invites SET declined_at = ? WHERE book_id = ? AND email = ?`).bind(Date.now(), bookId, who).run();
    await bookStub(env, bookId).fetch("https://book/members-changed", { method: "POST" });
  }
  await poke(env, [who, inv.inviter], { t: "me" });
  return true;
}

/** Your room invites waiting for an answer (the home's Pedidos). */
export async function invitesFor(db: D1Database, email: string) {
  return (
    await db
      .prepare(
        `SELECT i.book_id, b.title, b.icon, i.inviter, u.name AS inviter_name, u.avatar AS inviter_avatar, i.created_at,
                (SELECT count(*) FROM members m WHERE m.book_id = i.book_id) AS people
           FROM invites i JOIN books b ON b.id = i.book_id LEFT JOIN users u ON u.email = i.inviter
          WHERE i.email = ? AND i.declined_at IS NULL ORDER BY i.created_at DESC LIMIT 20`,
      )
      .bind(email)
      .all<{ book_id: string; title: string; icon: number | null; inviter: string; inviter_name: string | null; inviter_avatar: number | null; created_at: number; people: number }>()
  ).results;
}

export const bookStub = (env: Env, id: string) => env.BOOK.get(env.BOOK.idFromName(id));
/** The co-editing relay for a room's doc (epic = "" for the room's own doc). */
export const docRoomName = (id: string, epic?: string) => (epic ? `${id}~${epic}` : id);
export const docRoomStub = (env: Env, id: string, epic?: string) => env.DOC_ROOMS.get(env.DOC_ROOMS.idFromName(docRoomName(id, epic)));

export async function createBook(env: Env, email: string, title?: string) {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO books (id, title, folder, summary, owner, created_at, updated_at) VALUES (?, ?, NULL, '', ?, ?, ?)`).bind(
      id,
      (title || "Nova sala").slice(0, 120),
      email,
      now,
      now,
    ),
    env.DB.prepare(`INSERT INTO members (book_id, email) VALUES (?, ?)`).bind(id, email),
  ]);
  return id;
}

/** Invites `who`: the invite waits for their yes (the home's Pedidos, or the room's link), so a room can't pull anyone
 *  in. Emails a magic link (rate-limited per inviter) and tells the DO. A room that was turned down asks again only
 *  after a week; "invited" is the answer either way, so the inviter can't tell. */
export async function inviteMember(env: Env, ctx: { waitUntil(p: Promise<unknown>): void }, origin: string, inviter: string, bookId: string, who: string, inviterLang: Lang = "pt", o: { joined?: boolean } = {}) {
  if (o.joined) {
    // Let in from an access request: they're a member already, the email only tells them.
  } else if (await isMember(env.DB, bookId, who)) {
    // A member added before invites waited for a yes who never signed in: "reenviar" sends the email again.
    if (await env.DB.prepare(`SELECT 1 FROM users WHERE email = ?`).bind(who).first()) return;
  } else {
    const was = await env.DB.prepare(`SELECT declined_at FROM invites WHERE book_id = ? AND email = ?`).bind(bookId, who).first<{ declined_at: number | null }>();
    if (was?.declined_at && Date.now() - was.declined_at < DECLINE_HOLD_MS) return;
    await env.DB.prepare(`INSERT INTO invites (book_id, email, inviter, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (book_id, email) DO UPDATE SET inviter = excluded.inviter, created_at = excluded.created_at, declined_at = NULL`)
      .bind(bookId, who, inviter, Date.now())
      .run();
    ctx.waitUntil(track(env, "invite_sent", { user: inviter, dims: { book: bookId } }));
  }
  ctx.waitUntil(poke(env, [who, inviter], { t: "me" })); // the invite shows up in their Pedidos at once
  await sendInviteEmail(env, ctx, { origin, inviter, who, lang: inviterLang, room: { id: bookId, joined: o.joined } });
  await bookStub(env, bookId).fetch("https://book/members-changed", { method: "POST" });
}

// A room's icon (e.g. its site's favicon), shared by the room: R2 `icons/<book>`, books.icon = version (null = none).
export const ICON_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/x-icon", "image/vnd.microsoft.icon"];
export async function setRoomIcon(env: Env, bookId: string, img: { type: string; body: ArrayBuffer } | null, en = false): Promise<number | null> {
  if (!img) {
    await env.FILES.delete(`icons/${bookId}`);
    await env.DB.prepare(`UPDATE books SET icon = NULL WHERE id = ?`).bind(bookId).run();
    return null;
  }
  if (!ICON_TYPES.includes(img.type)) throw new Error(en ? "Use PNG, JPEG, WebP, GIF or ICO (not SVG)." : "Use PNG, JPEG, WebP, GIF ou ICO (SVG não).");
  if (!img.body.byteLength || img.body.byteLength > 256_000) throw new Error(en ? "Icon empty or over 256KB." : "Ícone vazio ou maior que 256KB.");
  await env.FILES.put(`icons/${bookId}`, img.body, { httpMetadata: { contentType: img.type } });
  const v = Date.now();
  await env.DB.prepare(`UPDATE books SET icon = ? WHERE id = ?`).bind(v, bookId).run();
  return v;
}

// Files: images, PDF, HTML, Markdown, plain text, CSV and audio (no SVG: it can carry script without our sandbox applying to <img>).
// HTML is served under a sandbox CSP with no same-origin (see fileHeaders), so it can't touch the app origin.
// Audio: recordings already made (iPhone's Voice Memos exports .m4a, recorders .mp3/.wav); played with <audio> in the app.
/** reminders/<name>.md: a room reminder (Book.reminderFile reads its schedule). */
export const REMINDER_FILE = /^reminders\/([^\\/\u0000-\u001f]{1,60})\.md$/i;
// Agents get the Portuguese (en = false); a person's upload follows their language (src/services.ts).
export const typesError = (en = false) => (en ? "File type not supported (images, PDF, HTML, Markdown, text, CSV and audio)." : "Tipo de arquivo não suportado (imagens, PDF, HTML, Markdown, texto, CSV e áudio).");
export const TYPES_ERROR = typesError();
export const sizeError = (type: string, en = false) => (en ? `File empty or over ${maxBytes(type) / 1024 / 1024}MB.` : `Arquivo vazio ou maior que ${maxBytes(type) / 1024 / 1024}MB.`);
export type StoredFile = UploadFileResponse;

/** Validates and stores one file in R2 + the room's index. Throws an Error whose message is user-facing. */
export async function storeFile(env: Env, bookId: string, email: string, type: string, body: ArrayBuffer, rawName: string, authority?: { requireMember: true }, en = false): Promise<StoredFile> {
  if (!FILE_TYPES.includes(type)) throw new Error(typesError(en));
  if (!body.byteLength || body.byteLength > maxBytes(type)) throw new Error(sizeError(type, en));
  const text = type.startsWith("text/") ? new TextDecoder().decode(body) : "";
  if (text) {
    const secret = findSecret(text);
    if (secret) throw new Error(en ? `Not uploaded: the file seems to contain a secret (${secretName(secret)}). Secrets don't go in the room.` : `Não subi: o arquivo parece ter ${secret}. Segredo não entra na sala.`);
  }
  if (!(await env.UPLOAD_LIMIT.limit({ key: email })).success) throw new Error(en ? "Too many uploads. Wait a minute." : "Muitos uploads. Espera um minuto.");
  const rem = type === "text/markdown" ? REMINDER_FILE.exec(rawName.trim()) : null;
  const agentMd = type === "text/markdown" ? /^agents\/([^\\/\u0000-\u001f]{1,60})\.md$/i.exec(rawName.trim()) : null; // a sandbox's CLAUDE.md (src/sandbox.ts)
  const appHtml = type === "text/html" ? /^apps\/([\w.-]{1,60})\.html$/i.exec(rawName.trim()) : null; // a room app (Conexões → Esta sala)
  // A room app can ask to post or move tasks as whoever opens it: it passes the same check as HTML posted in a message.
  if (appHtml) await checkEmbed(env, text, email);
  const name = rem ? `reminders/${rem[1].trim()}.md` : agentMd ? `agents/${agentMd[1].trim()}.md` : appHtml ? `apps/${appHtml[1]}.html` : (rawName || `arquivo.${{ "text/html": "html", "text/markdown": "md", "text/plain": "txt", "text/csv": "csv" }[type] ?? type.split("/")[1]}`).replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 120);
  const meta = { id: crypto.randomUUID().replace(/-/g, "").slice(0, 16), name, type, size: body.byteLength, author: email, ts: Date.now() };
  if (authority && !(await isMember(env.DB, bookId, email))) throw new Error("forbidden");
  await env.FILES.put(`${bookId}/${meta.id}`, body, { httpMetadata: { contentType: type }, customMetadata: { name, author: email } });
  const published = await bookStub(env, bookId).fetch(`https://book/file?book=${bookId}`, { method: "POST", body: JSON.stringify(meta), ...(authority ? { headers: { "x-require-member": "true" } } : {}) });
  if (authority && !published.ok) {
    // A confirmed denial precedes the index write. A lost response could follow
    // a successful commit: never delete bytes on that ambiguous transport path.
    if (published.status === 403) await env.FILES.delete(`${bookId}/${meta.id}`);
    throw new Error(published.status === 403 ? "forbidden" : "file publication failed");
  }
  if (rem) return { ...meta, reminder: await bookStub(env, bookId).reminderFile(bookId, email, rem[1].trim(), text, meta.id) };
  return meta;
}

export { fileHeaders } from "./fileHeaders";

/** "Esperando você": what people are waiting on this person for, newest first, in rooms they haven't archived.
 * ref m<id> = a message Jev read as an ask to them; t<id> = a task of theirs in review. */
export const waitsFor = async (db: D1Database, email: string, bookId?: string) =>
  (
    await db
      .prepare(
        `SELECT w.book_id, b.title AS room, w.ref, w.thread, w.topic, w.author, u.name AS author_name, w.text, w.ts, w.about
         FROM waits w JOIN members m ON m.book_id = w.book_id AND m.email = w.email JOIN books b ON b.id = w.book_id
         LEFT JOIN users u ON u.email = w.author
         WHERE w.email = ? AND m.archived_at IS NULL AND (?2 IS NULL OR w.book_id = ?2)
           AND NOT (w.ref LIKE 'a%' AND w.ts < ?3) ORDER BY w.ts DESC LIMIT 60`,
      )
      .bind(email, bookId ?? null, Date.now() - 15 * 60e3) // a hook question lives ≤630s; a row it left behind (killed) expires
      .all<{ book_id: string; room: string; ref: string; thread: string; topic: string | null; author: string; author_name: string | null; text: string; ts: number; about: string | null }>()
  ).results;

// Search across the person's rooms (⌘K and MCP search): the newest-opened 30 rooms, each asked in parallel
// (Book.search), merged newest first. Worst case per call: 30 DO calls, no network or model call behind them.
// ponytail: fan-out over rooms; a D1 index of messages if people get hundreds of rooms.
export async function searchRooms(env: Env, email: string, q: string, room?: string) {
  const rooms = (
    await env.DB.prepare(
      `SELECT b.id, b.title FROM books b JOIN members m ON m.book_id = b.id
       WHERE m.email = ?1 AND m.archived_at IS NULL AND (?2 IS NULL OR b.id = ?2)
       ORDER BY coalesce(m.opened_at, 0) DESC, b.updated_at DESC LIMIT 30`,
    )
      .bind(email, room ?? null)
      .all<{ id: string; title: string }>()
  ).results;
  const per = await Promise.all(
    rooms.map(async (r) => {
      try {
        const out = await bookStub(env, r.id).search(r.id, q, room ? 20 : 8);
        return { ...out, room: r };
      } catch {
        return { messages: [], epics: [], room: r, failed: true };
      }
    }),
  );
  const messages = per.flatMap((p) => p.messages.map((m) => ({ ...m, room_id: p.room.id, room: p.room.title }))).sort((a, b) => b.ts - a.ts).slice(0, 30);
  const epics = per.flatMap((p) => p.epics.map((e) => ({ ...e, room_id: p.room.id, room: p.room.title }))).sort((a, b) => b.ts - a.ts).slice(0, 15);
  return { rooms: rooms.length, failed: per.filter((p) => "failed" in p).length, epics, messages };
}

// The Inbox (GET /api/inbox): everything across the person's rooms that needs them, in one call.
// waits + mentions are D1 only; tasks fan out to the newest-opened 30 rooms' Book DOs (like searchRooms). No model call.
export async function inbox(env: Env, email: string) {
  const db = env.DB;
  const [waits, mentions, rooms] = await Promise.all([
    waitsFor(db, email),
    db
      .prepare(
        INBOX_MENTIONS_SQL,
      )
      .bind(email)
      .all<{ book_id: string; room: string; msg_id: number; thread: string; author: string; author_name: string | null; text: string; ts: number }>()
      .then((r) => r.results),
    db
      .prepare(
        `SELECT b.id, b.title FROM books b JOIN members m ON m.book_id = b.id
         WHERE m.email = ?1 AND m.archived_at IS NULL ORDER BY coalesce(m.opened_at, 0) DESC, b.updated_at DESC LIMIT 30`,
      )
      .bind(email)
      .all<{ id: string; title: string }>()
      .then((r) => r.results),
  ]);
  const per = await Promise.all(
    rooms.map(async (r) => {
      try {
        return (await bookStub(env, r.id).inboxTasks(r.id, email)).map((t) => ({ ...t, book_id: r.id, room: r.title }));
      } catch {
        return [];
      }
    }),
  );
  return { waits, mentions, tasks: per.flat() };
}
