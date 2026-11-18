import "server-only";
import { safeEqual } from "./auth";
import { bookStub } from "./rooms";
import type { Env } from "./index";

/**
 * Moving vibebook to another Cloudflare account (docs/architecture.md › Storage; runbook in the room's epic a256f2ae).
 *
 * D1, R2 and KV have their own export tools; Durable Objects don't. A room's whole life (messages, epics, tasks,
 * docs, files index, acks…) is the SQLite of its `Book` DO, so this copies that SQLite table by table, through
 * `/migrate/*` on both Workers, driven by `scripts/migrate.ts`. DocRoom (the live editor) is not copied: it seeds
 * itself from the Book's markdown the first time a doc opens. Person only caches `/api/me`.
 *
 * Off unless the secret `MIGRATE_TOKEN` is set (404 otherwise); a Bearer of it is the only way in, no session.
 * Remove the secret once the move is done.
 */

type Value = string | number | null | { $b64: string };
type Row = Record<string, Value>;

// The tables a room may have. Anything else in the DO's SQLite (`_cf_*`, sqlite's own, miniflare's
// `__miniflare_do_name` in local dev) belongs to the runtime and is left alone.
const SKIP = /^(_cf_|sqlite_|__)/;

function tables(sql: SqlStorage): string[] {
  return sql
    .exec<{ name: string }>(`SELECT name FROM sqlite_master WHERE type = 'table'`)
    .toArray()
    .map((r) => r.name)
    .filter((n) => !SKIP.test(n))
    .sort();
}
const columns = (sql: SqlStorage, table: string) => sql.exec<{ name: string }>(`PRAGMA table_info("${table}")`).toArray().map((r) => r.name);

function known(sql: SqlStorage, table: string) {
  if (!tables(sql).includes(table)) throw new Error(`unknown table ${table}`);
}
const toJson = (v: SqlStorageValue): Value => (v instanceof ArrayBuffer ? { $b64: b64(v) } : (v as string | number | null));
const fromJson = (v: Value): SqlStorageValue => (v && typeof v === "object" ? unb64(v.$b64) : v);
function b64(buf: ArrayBuffer) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;

/** Every table with its row count, plus the AUTOINCREMENT counters (so ids deleted at the end aren't reused). */
export function dumpInfo(sql: SqlStorage) {
  const list = tables(sql).map((name) => ({ name, rows: sql.exec<{ n: number }>(`SELECT count(*) AS n FROM "${name}"`).one().n }));
  const seq = sql.exec<{ name: string; seq: number }>(`SELECT name, seq FROM sqlite_sequence`).toArray();
  return { tables: list, seq: Object.fromEntries(seq.map((r) => [r.name, r.seq])) };
}

/** One page of a table, in rowid order; `next` is the rowid to pass as `after` for the following page (null = done). */
export function dumpRows(sql: SqlStorage, table: string, after: number, limit: number) {
  known(sql, table);
  const cols = columns(sql, table);
  const list = cols.map((c) => `"${c}"`).join(", ");
  const raw = sql.exec(`SELECT rowid AS _rid, ${list} FROM "${table}" WHERE rowid > ? ORDER BY rowid LIMIT ?`, after, limit).toArray();
  const rows = raw.map((r) => Object.fromEntries(cols.map((c) => [c, toJson(r[c])])) as Row);
  return { rows, next: raw.length === limit ? (raw.at(-1)!._rid as number) : null };
}

/**
 * Writes one page into the same table (same code on both sides, so the same schema). `reset` (the first page of a
 * table) empties it first, so running the import again gives the same room. Columns the target doesn't have fail
 * loudly instead of being dropped.
 */
export function loadRows(storage: DurableObjectStorage, table: string, rows: Row[], reset: boolean) {
  const sql = storage.sql;
  known(sql, table);
  const cols = new Set(columns(sql, table));
  storage.transactionSync(() => {
    if (reset) sql.exec(`DELETE FROM "${table}"`);
    for (const row of rows) {
      const keys = Object.keys(row);
      const extra = keys.find((k) => !cols.has(k));
      if (extra) throw new Error(`${table}: column ${extra} doesn't exist here (deploy the same code on both sides)`);
      sql.exec(`INSERT OR REPLACE INTO "${table}" (${keys.map((k) => `"${k}"`).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`, ...keys.map((k) => fromJson(row[k])));
    }
  });
  return { ok: true, rows: rows.length };
}

/** After every table: AUTOINCREMENT counters as they were, and the alarm (reminders, mail queue, grading) armed again. */
export async function finishLoad(storage: DurableObjectStorage, seq: Record<string, number>) {
  const sql = storage.sql;
  for (const [name, n] of Object.entries(seq)) {
    known(sql, name);
    if (typeof n !== "number" || !Number.isInteger(n)) throw new Error(`bad counter for ${name}`);
    const cur = sql.exec<{ seq: number }>(`SELECT seq FROM sqlite_sequence WHERE name = ?`, name).toArray()[0];
    if (!cur) sql.exec(`INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)`, name, n);
    else if (cur.seq < n) sql.exec(`UPDATE sqlite_sequence SET seq = ? WHERE name = ?`, n, name);
  }
  await storage.setAlarm(Date.now() + 30_000);
  return dumpInfo(sql);
}

const PAGE_MAX = 1000;
const ROOM_ID = /^[A-Za-z0-9_-]{1,64}$/;

/** `/migrate/*`, before the OAuth provider and the app (src/index.ts). */
export async function handleMigrate(req: Request, env: Env): Promise<Response> {
  const token = env.MIGRATE_TOKEN;
  if (!token) return new Response("not found", { status: 404 });
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ") || !safeEqual(auth.slice(7), token)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean); // migrate, rooms | room, <id>, info | rows | finish
  try {
    // Every room id, from D1 (copy D1 first, so the target lists the same rooms).
    if (parts[1] === "rooms" && parts.length === 2 && req.method === "GET") {
      const { results } = await env.DB.prepare(`SELECT id FROM books ORDER BY id`).all<{ id: string }>();
      return Response.json({ rooms: results.map((r) => r.id) });
    }
    const id = parts[2];
    if (parts[1] !== "room" || !id || !ROOM_ID.test(id) || parts.length !== 4) return Response.json({ error: "not found" }, { status: 404 });
    const book = bookStub(env, id);
    const what = parts[3];
    if (what === "info" && req.method === "GET") return Response.json(await book.migrateInfo());
    if (what === "rows" && req.method === "GET") {
      const table = url.searchParams.get("table") ?? "";
      const after = Number(url.searchParams.get("after") ?? 0) || 0;
      const limit = Math.min(PAGE_MAX, Math.max(1, Number(url.searchParams.get("limit") ?? 200) || 200));
      return Response.json(await book.migrateRows(table, after, limit));
    }
    if (what === "rows" && req.method === "POST") {
      const b = (await req.json()) as { table?: unknown; rows?: unknown; reset?: unknown };
      if (typeof b.table !== "string" || !Array.isArray(b.rows) || b.rows.length > PAGE_MAX) return Response.json({ error: "bad body" }, { status: 400 });
      return Response.json(await book.migrateLoad(b.table, b.rows as Row[], b.reset === true));
    }
    if (what === "finish" && req.method === "POST") {
      const b = (await req.json()) as { seq?: unknown };
      const seq = b.seq && typeof b.seq === "object" ? (b.seq as Record<string, number>) : {};
      return Response.json(await book.migrateFinish(seq));
    }
    return Response.json({ error: "not found" }, { status: 404 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export type { Row as MigrateRow };
