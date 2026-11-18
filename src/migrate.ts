import "server-only";
import { safeEqual } from "./auth";
import { bookStub } from "./rooms";
import type { Env } from "./index";

/**
 * Moving vibebook to another Cloudflare account (docs/architecture.md › Storage; runbook in the room's epic a256f2ae).
 *
 * Everything goes through this Worker, on both sides, driven by `scripts/migrate.ts`, so the move needs no Cloudflare
 * API token on either account, only this secret on both Workers:
 * - D1: every table, page by page in rowid order (`/migrate/d1/*`).
 * - Rooms: each `Book` DO's SQLite, table by table (`/migrate/rooms`, `/migrate/room/<id>/*`).
 * - R2: every object with its metadata, streamed (`/migrate/r2/*`).
 * - KV (`OAUTH_KV`): every key with its expiration and metadata (`/migrate/kv/*`).
 * DocRoom (the live editor) is not copied: it seeds itself from the Book's markdown the first time a doc opens.
 * Person only caches `/api/me`.
 *
 * Off unless the secret `MIGRATE_TOKEN` is set (404 otherwise); a Bearer of it is the only way in, no session.
 * Remove the secret once the move is done.
 */

type Value = string | number | null | { $b64: string };
type Row = Record<string, Value>;
type Info = { tables: { name: string; rows: number }[]; seq: Record<string, number> };

// Tables that belong to the runtime, not to vibebook: `_cf_*`, sqlite's own, D1's `d1_*`, miniflare's
// `__miniflare_do_name` in local dev.
const SKIP = /^(_cf_|sqlite_|d1_|__)/;
const NAME = /^[A-Za-z0-9_]+$/;
const quote = (n: string) => {
  if (!NAME.test(n)) throw new Error(`bad name ${n}`);
  return `"${n}"`;
};

function b64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toJson = (v: unknown): Value =>
  v instanceof ArrayBuffer ? { $b64: b64(new Uint8Array(v)) } : Array.isArray(v) ? { $b64: b64(Uint8Array.from(v as number[])) } : (v as string | number | null);
const fromJson = (v: Value) => (v && typeof v === "object" ? unb64(v.$b64).buffer : v);

const writeSql = (table: string, keys: string[]) =>
  `INSERT OR REPLACE INTO ${quote(table)} (${keys.map(quote).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
function checkColumns(table: string, cols: Set<string>, row: Row) {
  const extra = Object.keys(row).find((k) => !cols.has(k));
  if (extra) throw new Error(`${table}: column ${extra} doesn't exist here (deploy the same code on both sides)`);
}

// ---- rooms: the Book DO's SQLite (called inside the DO, see Book.migrate*) ----

function doTables(sql: SqlStorage): string[] {
  return sql.exec<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`).toArray().map((r) => r.name).filter((n) => !SKIP.test(n)).sort();
}
const doColumns = (sql: SqlStorage, table: string) => sql.exec<{ name: string }>(`PRAGMA table_info(${quote(table)})`).toArray().map((r) => r.name);
function doKnown(sql: SqlStorage, table: string) {
  if (!doTables(sql).includes(table)) throw new Error(`unknown table ${table}`);
}

/** Every table with its row count, plus the AUTOINCREMENT counters (so ids deleted at the end aren't reused). */
export function dumpInfo(sql: SqlStorage): Info {
  const tables = doTables(sql).map((name) => ({ name, rows: sql.exec<{ n: number }>(`SELECT count(*) AS n FROM ${quote(name)}`).one().n }));
  const seq = sql.exec<{ name: string; seq: number }>(`SELECT name, seq FROM sqlite_sequence`).toArray();
  return { tables, seq: Object.fromEntries(seq.map((r) => [r.name, r.seq])) };
}

/** One page of a table, in rowid order; `next` is the rowid to pass as `after` for the following page (null = done). */
export function dumpRows(sql: SqlStorage, table: string, after: number, limit: number) {
  doKnown(sql, table);
  const cols = doColumns(sql, table);
  const raw = sql.exec(`SELECT rowid AS _rid, ${cols.map(quote).join(", ")} FROM ${quote(table)} WHERE rowid > ? ORDER BY rowid LIMIT ?`, after, limit).toArray();
  const rows = raw.map((r) => Object.fromEntries(cols.map((c) => [c, toJson(r[c])])) as Row);
  return { rows, next: raw.length === limit ? (raw.at(-1)!._rid as number) : null };
}

/**
 * Writes one page into the same table (same code on both sides, so the same schema). `reset` (the first page of a
 * table) empties it first, so running the import again gives the same room.
 */
export function loadRows(storage: DurableObjectStorage, table: string, rows: Row[], reset: boolean) {
  const sql = storage.sql;
  doKnown(sql, table);
  const cols = new Set(doColumns(sql, table));
  storage.transactionSync(() => {
    if (reset) sql.exec(`DELETE FROM ${quote(table)}`);
    for (const row of rows) {
      checkColumns(table, cols, row);
      const keys = Object.keys(row);
      sql.exec(writeSql(table, keys), ...keys.map((k) => fromJson(row[k])));
    }
  });
  return { ok: true, rows: rows.length };
}

/** After every table: AUTOINCREMENT counters as they were, and the alarm (reminders, mail queue, grading) armed again. */
export async function finishLoad(storage: DurableObjectStorage, seq: Record<string, number>) {
  const sql = storage.sql;
  for (const [name, n] of Object.entries(seq)) {
    doKnown(sql, name);
    if (!Number.isInteger(n)) throw new Error(`bad counter for ${name}`);
    const cur = sql.exec<{ seq: number }>(`SELECT seq FROM sqlite_sequence WHERE name = ?`, name).toArray()[0];
    if (!cur) sql.exec(`INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`, name, n);
    else if (cur.seq < n) sql.exec(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`, n, name);
  }
  await storage.setAlarm(Date.now() + 30_000);
  return dumpInfo(sql);
}

// ---- D1 ----

async function d1Tables(db: D1Database) {
  const { results } = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all<{ name: string }>();
  return results.map((r) => r.name).filter((n) => !SKIP.test(n)).sort();
}
async function d1Columns(db: D1Database, table: string) {
  const { results } = await db.prepare(`PRAGMA table_info(${quote(table)})`).all<{ name: string }>();
  return results.map((r) => r.name);
}
async function d1Known(db: D1Database, table: string) {
  if (!(await d1Tables(db)).includes(table)) throw new Error(`unknown table ${table}`);
}
async function d1Info(db: D1Database): Promise<Info> {
  const names = await d1Tables(db);
  const counts = names.length ? await db.batch(names.map((n) => db.prepare(`SELECT count(*) AS n FROM ${quote(n)}`))) : [];
  const seqT = (await db.prepare(`SELECT 1 FROM sqlite_master WHERE name = 'sqlite_sequence'`).first()) ? (await db.prepare(`SELECT name, seq FROM sqlite_sequence`).all<{ name: string; seq: number }>()).results : [];
  return { tables: names.map((name, i) => ({ name, rows: (counts[i].results[0] as { n: number }).n })), seq: Object.fromEntries(seqT.map((r) => [r.name, r.seq])) };
}
async function d1Rows(db: D1Database, table: string, after: number, limit: number) {
  await d1Known(db, table);
  const cols = await d1Columns(db, table);
  const { results } = await db.prepare(`SELECT rowid AS _rid, ${cols.map(quote).join(", ")} FROM ${quote(table)} WHERE rowid > ? ORDER BY rowid LIMIT ?`).bind(after, limit).all<Record<string, unknown>>();
  const rows = results.map((r) => Object.fromEntries(cols.map((c) => [c, toJson(r[c])])) as Row);
  return { rows, next: results.length === limit ? (results.at(-1)!._rid as number) : null };
}
async function d1Load(db: D1Database, table: string, rows: Row[], reset: boolean) {
  await d1Known(db, table);
  const cols = new Set(await d1Columns(db, table));
  const stmts = rows.map((row) => {
    checkColumns(table, cols, row);
    const keys = Object.keys(row);
    return db.prepare(writeSql(table, keys)).bind(...keys.map((k) => fromJson(row[k])));
  });
  // One batch = one transaction: the reset and the page land together or not at all.
  const all = [...(reset ? [db.prepare(`DELETE FROM ${quote(table)}`)] : []), ...stmts];
  if (all.length) await db.batch(all);
  return { ok: true, rows: rows.length };
}

// ---- R2 ----

type R2Meta = { httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string> };
async function r2List(bucket: R2Bucket, cursor?: string) {
  const page = await bucket.list({ cursor, limit: 1000 });
  return { objects: page.objects.map((o) => ({ key: o.key, size: o.size, etag: o.etag })), cursor: page.truncated ? page.cursor : null };
}

// ---- KV ----

async function kvList(kv: KVNamespace, cursor?: string) {
  const page = await kv.list({ cursor, limit: 1000 });
  return { keys: page.keys.map((k) => ({ name: k.name, expiration: k.expiration ?? null, metadata: k.metadata ?? null })), cursor: page.list_complete ? null : page.cursor };
}
async function kvGet(kv: KVNamespace, keys: { name: string; expiration: number | null }[]) {
  const entries = await Promise.all(
    keys.map(async (k) => {
      const v = await kv.getWithMetadata(k.name, "arrayBuffer");
      return v.value === null ? null : { key: k.name, value: b64(new Uint8Array(v.value)), expiration: k.expiration, metadata: v.metadata ?? null };
    }),
  );
  return { entries: entries.filter((e) => e !== null) };
}
async function kvPut(kv: KVNamespace, entries: { key: string; value: string; expiration: number | null; metadata: unknown }[]) {
  // KV refuses an expiration less than 60 s away; those keys (OAuth codes, tokens) are about to die anyway.
  const soon = Date.now() / 1000 + 90;
  const live = entries.filter((e) => !e.expiration || e.expiration > soon);
  await Promise.all(live.map((e) => kv.put(e.key, unb64(e.value), { ...(e.expiration ? { expiration: e.expiration } : {}), ...(e.metadata ? { metadata: e.metadata } : {}) })));
  return { ok: true, put: live.length, skipped: entries.length - live.length };
}

// ---- HTTP ----

const PAGE_MAX = 1000;
const ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/;
const pageArgs = (url: URL) => ({
  table: url.searchParams.get("table") ?? "",
  after: Number(url.searchParams.get("after") ?? 0) || 0,
  limit: Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get("limit") ?? 200) || 200)),
});
async function pageBody(req: Request) {
  const b = (await req.json()) as { table?: unknown; rows?: unknown; reset?: unknown };
  if (typeof b.table !== "string" || !Array.isArray(b.rows) || b.rows.length > PAGE_MAX) throw new Error("bad body");
  return { table: b.table, rows: b.rows as Row[], reset: b.reset === true };
}

/**
 * `/migrate/*`, before the OAuth provider and the app (src/index.ts). `ensureSchema` comes from index.ts as an
 * argument: importing it here would make a cycle (index.ts imports this file).
 */
export async function handleMigrate(req: Request, env: Env, ensureSchema: (db: D1Database) => Promise<unknown>): Promise<Response> {
  const token = env.MIGRATE_TOKEN;
  if (!token) return new Response("not found", { status: 404 });
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !safeEqual(auth.slice(7), token)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const [, area, a, b] = url.pathname.split("/").filter(Boolean);
  const route = `${req.method} ${area}${a ? `/${a}` : ""}${b ? `/${b}` : ""}`;
  try {
    // D1. A fresh Worker has no tables until its first app request, so make the schema before reading or writing.
    if (area === "d1") {
      await ensureSchema(env.DB);
      if (route === "GET d1/info") return Response.json(await d1Info(env.DB));
      const p = pageArgs(url);
      if (route === "GET d1/rows") return Response.json(await d1Rows(env.DB, p.table, p.after, p.limit));
      if (route === "POST d1/rows") {
        const body = await pageBody(req);
        return Response.json(await d1Load(env.DB, body.table, body.rows, body.reset));
      }
    }

    if (route === "GET r2/list") return Response.json(await r2List(env.FILES, url.searchParams.get("cursor") ?? undefined));
    if (area === "r2" && a === "object") {
      const key = url.searchParams.get("key");
      if (!key) return Response.json({ error: "missing key" }, { status: 400 });
      if (req.method === "GET") {
        const obj = await env.FILES.get(key);
        if (!obj) return Response.json({ error: "not found" }, { status: 404 });
        const meta: R2Meta = { httpMetadata: obj.httpMetadata, customMetadata: obj.customMetadata };
        return new Response(obj.body, { headers: { "x-migrate-meta": encodeURIComponent(JSON.stringify(meta)), "content-length": String(obj.size) } });
      }
      if (req.method === "PUT") {
        const meta = JSON.parse(decodeURIComponent(req.headers.get("x-migrate-meta") ?? "%7B%7D")) as R2Meta;
        const put = await env.FILES.put(key, req.body, { httpMetadata: meta.httpMetadata, customMetadata: meta.customMetadata });
        return Response.json({ ok: true, size: put?.size ?? 0 });
      }
    }

    if (route === "GET kv/list") return Response.json(await kvList(env.OAUTH_KV, url.searchParams.get("cursor") ?? undefined));
    if (route === "POST kv/get") {
      const body = (await req.json()) as { keys?: { name: string; expiration: number | null }[] };
      if (!Array.isArray(body.keys) || body.keys.length > 100) return Response.json({ error: "bad body (≤100 keys)" }, { status: 400 });
      return Response.json(await kvGet(env.OAUTH_KV, body.keys));
    }
    if (route === "POST kv/put") {
      const body = (await req.json()) as { entries?: Parameters<typeof kvPut>[1] };
      if (!Array.isArray(body.entries) || body.entries.length > 100) return Response.json({ error: "bad body (≤100 entries)" }, { status: 400 });
      return Response.json(await kvPut(env.OAUTH_KV, body.entries));
    }

    // Every room id, from D1 (import D1 first, so the target lists the same rooms).
    if (route === "GET rooms") {
      const { results } = await env.DB.prepare(`SELECT id FROM books ORDER BY id`).all<{ id: string }>();
      return Response.json({ rooms: results.map((r) => r.id) });
    }
    if (area === "room" && a && ROOM_ID.test(a)) {
      const book = bookStub(env, a);
      if (route === `GET room/${a}/info`) return Response.json(await book.migrateInfo());
      const p = pageArgs(url);
      if (route === `GET room/${a}/rows`) return Response.json(await book.migrateRows(p.table, p.after, p.limit));
      if (route === `POST room/${a}/rows`) {
        const body = await pageBody(req);
        return Response.json(await book.migrateLoad(body.table, body.rows, body.reset));
      }
      if (route === `POST room/${a}/finish`) {
        const body = (await req.json()) as { seq?: unknown };
        return Response.json(await book.migrateFinish(body.seq && typeof body.seq === "object" ? (body.seq as Record<string, number>) : {}));
      }
    }
    return Response.json({ error: "not found" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export type { Row as MigrateRow };
