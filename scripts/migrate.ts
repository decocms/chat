// Moving vibebook to another Cloudflare account, entirely through the Workers' /migrate/* (src/migrate.ts).
// Runbook: the doc of epic a256f2ae in the project room.
//
//   bun scripts/migrate.ts all     --from https://vibebook.dev --to https://<new worker> --out migration-dump
//
// or one step at a time:
//   bun scripts/migrate.ts export  --from <url> --out <dir>    D1 + rooms + KV to disk (the backup)
//   bun scripts/migrate.ts import  --to <url> --dir <dir>      D1 first, then rooms, then KV
//   bun scripts/migrate.ts files   --from <url> --to <url>     R2, streamed Worker to Worker
//   bun scripts/migrate.ts verify  --dir <dir> --to <url> [--from <url>]
//
// MIGRATE_TOKEN is the secret of the same name on both Workers (FROM_TOKEN / TO_TOKEN when they differ).
// Each run copies D1, the rooms and KV again from scratch (every table is emptied before its rows go in), so the
// last run, right before the switch, carries everything written since a rehearsal. --resume continues a run that
// stopped (skips rooms already dumped / imported in <dir>). Files always skip a key the target has with the same bytes (size + etag).
// Flags: --page (rows per request, 200), --jobs (parallel rooms/files, 4).
import { mkdir, readdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, unknown>;
type Info = { tables: { name: string; rows: number }[]; seq: Record<string, number> };
type Dump = { id: string; info: Info; tables: Record<string, Row[]> };
type KvEntry = { key: string; value: string; expiration: number | null; metadata: unknown };

const [cmd, ...rest] = process.argv.slice(2);
const flags: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith("--")) flags[rest[i].slice(2)] = rest[i + 1] === undefined || rest[i + 1].startsWith("--") ? "1" : rest[++i];
function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}
const need = (k: string) => flags[k] ?? die(`missing --${k}`);
const PAGE = Number(flags.page ?? 200);
const JOBS = Number(flags.jobs ?? 4);
const fromToken = () => process.env.FROM_TOKEN ?? process.env.MIGRATE_TOKEN ?? die("set MIGRATE_TOKEN");
const toToken = () => process.env.TO_TOKEN ?? process.env.MIGRATE_TOKEN ?? die("set MIGRATE_TOKEN");

/** One request to a Worker's /migrate/*, retried on 5xx and network errors. */
async function raw(base: string, token: string, path: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(base.replace(/\/$/, "") + path, { ...init, headers: { authorization: `Bearer ${token}`, ...init.headers } }).catch((e) => e as Error);
    if (res instanceof Response && res.ok) return res;
    const why = res instanceof Response ? `${res.status} ${(await res.text()).slice(0, 300)}` : res.message;
    if ((res instanceof Response && res.status < 500) || attempt >= 5) die(`${path}: ${why}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}
const get = async <T>(base: string, token: string, path: string) => (await (await raw(base, token, path)).json()) as T;
const post = async <T>(base: string, token: string, path: string, body: unknown) =>
  (await (await raw(base, token, path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json()) as T;

/** Runs `fn` on each item, `JOBS` at a time. */
async function each<T>(items: T[], fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, items.length) }, async () => { while (next < items.length) await fn(items[next++]); }));
}

/** Every table of a SQLite (D1 at `/migrate/d1`, a room at `/migrate/room/<id>`), page by page. */
async function dumpTables(base: string, token: string, prefix: string, label: string) {
  const info = await get<Info>(base, token, `${prefix}/info`);
  const tables: Record<string, Row[]> = {};
  for (const t of info.tables) {
    tables[t.name] = [];
    for (let after = 0; ; ) {
      const page = await get<{ rows: Row[]; next: number | null }>(base, token, `${prefix}/rows?table=${encodeURIComponent(t.name)}&after=${after}&limit=${PAGE}`);
      tables[t.name].push(...page.rows);
      if (page.next === null) break;
      after = page.next;
    }
    // The source stays live, so a table can grow between the count and the read. The dump keeps what it read:
    // that is what the import must match.
    if (tables[t.name].length !== t.rows) console.log(`  ${label}.${t.name}: counted ${t.rows}, read ${tables[t.name].length} (it changed while exporting)`);
  }
  return { info: { ...info, tables: info.tables.map((t) => ({ ...t, rows: tables[t.name].length })) }, tables };
}
async function loadTables(base: string, token: string, prefix: string, tables: Record<string, Row[]>) {
  for (const [table, rows] of Object.entries(tables))
    // Even an empty table is sent once (reset), so importing again over a half-done copy comes out right.
    for (let i = 0; i === 0 || i < rows.length; i += PAGE) await post(base, token, `${prefix}/rows`, { table, rows: rows.slice(i, i + PAGE), reset: i === 0 });
}
/** The counts of what a dump holds (a dump from before this fix kept the counts from before the read). */
const heldCounts = (d: { info: Info; tables: Record<string, Row[]> }): Info => ({ ...d.info, tables: d.info.tables.map((t) => ({ ...t, rows: d.tables[t.name]?.length ?? 0 })) });
/** The tables whose counts differ between two snapshots (ignoring tables empty on both sides). */
function diffCounts(a: Info, b: Info) {
  const m = new Map(b.tables.map((t) => [t.name, t.rows]));
  return a.tables.filter((t) => m.get(t.name) !== t.rows && (t.rows > 0 || m.has(t.name))).map((t) => `${t.name}: ${t.rows} → ${m.get(t.name) ?? "missing"}`);
}

// ---- export: D1, rooms, KV to disk ----
async function exportAll(from = need("from"), out = need("out")) {
  const token = fromToken();
  await mkdir(join(out, "rooms"), { recursive: true });

  const d1 = await dumpTables(from, token, "/migrate/d1", "d1");
  await writeFile(join(out, "d1.json"), JSON.stringify(d1));
  console.log(`d1: ${d1.info.tables.length} tables, ${d1.info.tables.reduce((n, t) => n + t.rows, 0)} rows`);

  const { rooms } = await get<{ rooms: string[] }>(from, token, "/migrate/rooms");
  let done = 0;
  await each(rooms, async (id) => {
    const file = join(out, "rooms", `${id}.json`);
    if (flags.resume && existsSync(file)) return void done++;
    const dump: Dump = { id, ...(await dumpTables(from, token, `/migrate/room/${id}`, id)) };
    await writeFile(file, JSON.stringify(dump));
    if (++done % 25 === 0 || done === rooms.length) console.log(`rooms: ${done}/${rooms.length}`);
  });

  const entries: KvEntry[] = [];
  for (let cursor: string | null = ""; cursor !== null; ) {
    const page: { keys: { name: string; expiration: number | null }[]; cursor: string | null } = await get(from, token, `/migrate/kv/list${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    for (let i = 0; i < page.keys.length; i += 100) entries.push(...(await post<{ entries: KvEntry[] }>(from, token, "/migrate/kv/get", { keys: page.keys.slice(i, i + 100) })).entries);
    cursor = page.cursor;
  }
  await writeFile(join(out, "kv.json"), JSON.stringify(entries));
  console.log(`kv: ${entries.length} keys`);
  await writeFile(join(out, "export.json"), JSON.stringify({ from, at: new Date().toISOString(), rooms: rooms.length }));
  console.log("export done");
}

// ---- import: D1, rooms, KV from disk ----
async function importAll(to = need("to"), dir = need("dir")) {
  const token = toToken();
  const log = join(dir, "imported.txt");
  const done = new Set(flags.resume && existsSync(log) ? (await readFile(log, "utf8")).split("\n").filter(Boolean) : []);
  if (!flags.resume) await writeFile(log, "");

  if (!done.has("d1")) {
    const d1 = JSON.parse(await readFile(join(dir, "d1.json"), "utf8")) as { info: Info; tables: Record<string, Row[]> };
    await loadTables(to, token, "/migrate/d1", d1.tables);
    const diff = diffCounts(heldCounts(d1), await get<Info>(to, token, "/migrate/d1/info"));
    if (diff.length) die(`d1 doesn't match: ${diff.join(", ")}`);
    await appendFile(log, "d1\n");
    console.log("d1 ok");
  }

  const files = (await readdir(join(dir, "rooms"))).filter((f) => f.endsWith(".json"));
  const bad: string[] = [];
  let n = 0;
  await each(files, async (f) => {
    const dump = JSON.parse(await readFile(join(dir, "rooms", f), "utf8")) as Dump;
    if (done.has(dump.id)) return void n++;
    await loadTables(to, token, `/migrate/room/${dump.id}`, dump.tables);
    const diff = diffCounts(heldCounts(dump), await post<Info>(to, token, `/migrate/room/${dump.id}/finish`, { seq: dump.info.seq }));
    if (diff.length) bad.push(`${dump.id}: ${diff.join(", ")}`);
    else await appendFile(log, dump.id + "\n");
    if (++n % 25 === 0 || n === files.length) console.log(`rooms: ${n}/${files.length}`);
  });
  if (bad.length) die(`${bad.length} rooms don't match their dump:\n${bad.join("\n")}`);

  if (!done.has("kv")) {
    const entries = JSON.parse(await readFile(join(dir, "kv.json"), "utf8")) as KvEntry[];
    let put = 0, skipped = 0;
    for (let i = 0; i < entries.length; i += 100) {
      const r = await post<{ put: number; skipped: number }>(to, token, "/migrate/kv/put", { entries: entries.slice(i, i + 100) });
      put += r.put;
      skipped += r.skipped;
    }
    await appendFile(log, "kv\n");
    console.log(`kv: ${put} keys (${skipped} expiring, skipped)`);
  }
  console.log("import done");
}

// ---- files: R2, Worker to Worker ----
/** key → "size:etag". The etag is the MD5 of the bytes, so an avatar replaced with one of the same size still differs. */
async function listR2(base: string, token: string) {
  const all = new Map<string, string>();
  for (let cursor: string | null = ""; cursor !== null; ) {
    const page: { objects: { key: string; size: number; etag: string }[]; cursor: string | null } = await get(base, token, `/migrate/r2/list${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
    for (const o of page.objects) all.set(o.key, `${o.size}:${o.etag}`);
    cursor = page.cursor;
  }
  return all;
}
async function copyFiles(from = need("from"), to = need("to")) {
  const [src, dst] = await Promise.all([listR2(from, fromToken()), listR2(to, toToken())]);
  const todo = [...src].filter(([k, sig]) => dst.get(k) !== sig);
  const bytes = todo.reduce((n, [, sig]) => n + Number(sig.split(":")[0]), 0);
  console.log(`files: ${src.size} on the source, ${todo.length} to copy (${(bytes / 1e6).toFixed(1)} MB)`);
  let n = 0;
  await each(todo, async ([key]) => {
    const q = `/migrate/r2/object?key=${encodeURIComponent(key)}`;
    const res = await raw(from, fromToken(), q);
    const body = await res.arrayBuffer();
    await raw(to, toToken(), q, { method: "PUT", headers: { "x-migrate-meta": res.headers.get("x-migrate-meta") ?? "" }, body });
    if (++n % 100 === 0 || n === todo.length) console.log(`files: ${n}/${todo.length}`);
  });
  console.log("files done");
}

// ---- verify ----
async function verify(dir = need("dir"), to = need("to"), from = flags.from) {
  const token = toToken();
  const bad: string[] = [];
  const d1 = JSON.parse(await readFile(join(dir, "d1.json"), "utf8")) as { info: Info };
  bad.push(...diffCounts(d1.info, await get<Info>(to, token, "/migrate/d1/info")).map((d) => `d1 ${d}`));
  const files = (await readdir(join(dir, "rooms"))).filter((f) => f.endsWith(".json"));
  await each(files, async (f) => {
    const dump = JSON.parse(await readFile(join(dir, "rooms", f), "utf8")) as Dump;
    const diff = diffCounts(dump.info, await get<Info>(to, token, `/migrate/room/${dump.id}/info`));
    if (diff.length) bad.push(`room ${dump.id}: ${diff.join(", ")}`);
  });
  if (from) {
    const [src, dst] = await Promise.all([listR2(from, fromToken()), listR2(to, token)]);
    const missing = [...src].filter(([k, s]) => dst.get(k) !== s).length;
    if (missing) bad.push(`files: ${missing} of ${src.size} missing or different on the target`);
    else console.log(`files: ${src.size} match`);
  }
  if (bad.length) die(`${bad.length} differences:\n${bad.join("\n")}`);
  console.log(`verify ok: d1, ${files.length} rooms${from ? ", files" : ""}`);
}

async function all() {
  const from = need("from"), to = need("to"), out = need("out");
  await exportAll(from, out);
  await importAll(to, out);
  await copyFiles(from, to);
  await verify(out, to, from);
}

const commands: Record<string, () => Promise<void>> = { all, export: () => exportAll(), import: () => importAll(), files: () => copyFiles(), verify: () => verify() };
await (commands[cmd] ?? (() => die(`usage: bun scripts/migrate.ts ${Object.keys(commands).join(" | ")} (see the top of this file)`)))();
