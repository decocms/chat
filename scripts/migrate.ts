// Moving vibebook to another Cloudflare account: rooms (Book Durable Objects) and the OAuth KV.
// Runbook: the doc of epic a256f2ae in the project room. D1 and R2 use Cloudflare's own tools.
//
//   MIGRATE_TOKEN=… bun scripts/migrate.ts export --from https://vibebook.dev --out migration-dump
//   MIGRATE_TOKEN=… bun scripts/migrate.ts import --to https://chat.decocms.com --dir migration-dump
//   MIGRATE_TOKEN=… bun scripts/migrate.ts verify --dir migration-dump --to https://chat.decocms.com
//   CF_API_TOKEN=… bun scripts/migrate.ts kv-export --account <id> --namespace <id> --out migration-dump
//   CF_API_TOKEN=… bun scripts/migrate.ts kv-import --account <id> --namespace <id> --dir migration-dump
//
// MIGRATE_TOKEN is the Workers' secret of the same name (FROM_TOKEN / TO_TOKEN when the two differ).
// export and import resume: a room already dumped / already imported is skipped (--again redoes it).
import { mkdir, readdir, readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, unknown>;
type Info = { tables: { name: string; rows: number }[]; seq: Record<string, number> };
type Dump = { id: string; info: Info; tables: Record<string, Row[]> };

const [cmd, ...rest] = process.argv.slice(2);
const flags: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith("--")) flags[rest[i].slice(2)] = rest[i + 1]?.startsWith("--") || rest[i + 1] === undefined ? "1" : rest[++i];
const need = (k: string) => flags[k] ?? die(`missing --${k}`);
function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}
const PAGE = Number(flags.page ?? 200);
const JOBS = Number(flags.jobs ?? 4);

async function call<T>(base: string, token: string, path: string, body?: unknown): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(base.replace(/\/$/, "") + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.ok) return (await res.json()) as T;
    const text = await res.text();
    if (res.status < 500 || attempt >= 4) die(`${path}: ${res.status} ${text.slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

/** Runs `fn` on each item, `JOBS` at a time. */
async function each<T>(items: T[], fn: (item: T, i: number) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, items.length) }, async () => { while (next < items.length) { const i = next++; await fn(items[i], i); } }));
}

async function dumpRoom(base: string, token: string, id: string): Promise<Dump> {
  const info = await call<Info>(base, token, `/migrate/room/${id}/info`);
  const tables: Record<string, Row[]> = {};
  for (const t of info.tables) {
    tables[t.name] = [];
    for (let after = 0; ; ) {
      const page = await call<{ rows: Row[]; next: number | null }>(base, token, `/migrate/room/${id}/rows?table=${encodeURIComponent(t.name)}&after=${after}&limit=${PAGE}`);
      tables[t.name].push(...page.rows);
      if (page.next === null) break;
      after = page.next;
    }
    // A room keeps getting writes until the freeze; a count that moved means this dump isn't the final one.
    if (tables[t.name].length !== t.rows) console.warn(`  ${id}.${t.name}: counted ${t.rows}, read ${tables[t.name].length} (room changed while exporting; export again after the freeze)`);
  }
  return { id, info, tables };
}

const sameCounts = (a: Info, b: Info) => {
  const m = new Map(b.tables.map((t) => [t.name, t.rows]));
  return a.tables.filter((t) => t.rows > 0 || m.has(t.name)).filter((t) => m.get(t.name) !== t.rows).map((t) => `${t.name}: ${t.rows} → ${m.get(t.name) ?? "missing"}`);
};

async function exportRooms() {
  const from = need("from");
  const out = need("out");
  const token = process.env.FROM_TOKEN ?? process.env.MIGRATE_TOKEN ?? die("set MIGRATE_TOKEN");
  await mkdir(join(out, "rooms"), { recursive: true });
  const { rooms } = await call<{ rooms: string[] }>(from, token, "/migrate/rooms");
  console.log(`${rooms.length} rooms on ${from}`);
  let done = 0;
  await each(rooms, async (id) => {
    const file = join(out, "rooms", `${id}.json`);
    if (existsSync(file) && !flags.again) return void done++;
    const dump = await dumpRoom(from, token, id);
    await writeFile(file, JSON.stringify(dump));
    const msgs = dump.info.tables.find((t) => t.name === "messages")?.rows ?? 0;
    console.log(`[${++done}/${rooms.length}] ${id}: ${msgs} messages`);
  });
  await writeFile(join(out, "rooms.json"), JSON.stringify({ from, at: new Date().toISOString(), rooms }));
  console.log("export done");
}

async function importRooms() {
  const to = need("to");
  const dir = need("dir");
  const token = process.env.TO_TOKEN ?? process.env.MIGRATE_TOKEN ?? die("set MIGRATE_TOKEN");
  const log = join(dir, "imported.txt");
  const already = new Set(existsSync(log) && !flags.again ? (await readFile(log, "utf8")).split("\n").filter(Boolean) : []);
  const files = (await readdir(join(dir, "rooms"))).filter((f) => f.endsWith(".json"));
  const bad: string[] = [];
  let done = 0;
  await each(files, async (f) => {
    const dump = JSON.parse(await readFile(join(dir, "rooms", f), "utf8")) as Dump;
    if (already.has(dump.id)) return void done++;
    for (const [table, rows] of Object.entries(dump.tables)) {
      // Even an empty table is sent once (reset), so importing again over a half-done room comes out right.
      for (let i = 0; i === 0 || i < rows.length; i += PAGE)
        await call(to, token, `/migrate/room/${dump.id}/rows`, { table, rows: rows.slice(i, i + PAGE), reset: i === 0 });
    }
    const after = await call<Info>(to, token, `/migrate/room/${dump.id}/finish`, { seq: dump.info.seq });
    const diff = sameCounts(dump.info, after);
    if (diff.length) bad.push(`${dump.id}: ${diff.join(", ")}`);
    else await appendFile(log, dump.id + "\n");
    console.log(`[${++done}/${files.length}] ${dump.id}${diff.length ? ` MISMATCH ${diff.join(", ")}` : " ok"}`);
  });
  if (bad.length) die(`\n${bad.length} rooms don't match:\n${bad.join("\n")}`);
  console.log("import done, every room matches its dump");
}

/** Compares every dumped room with the target, live (and with the source too when --from is given). */
async function verify() {
  const to = need("to");
  const dir = need("dir");
  const token = process.env.TO_TOKEN ?? process.env.MIGRATE_TOKEN ?? die("set MIGRATE_TOKEN");
  const fromToken = process.env.FROM_TOKEN ?? process.env.MIGRATE_TOKEN!;
  const files = (await readdir(join(dir, "rooms"))).filter((f) => f.endsWith(".json"));
  const bad: string[] = [];
  await each(files, async (f) => {
    const dump = JSON.parse(await readFile(join(dir, "rooms", f), "utf8")) as Dump;
    const target = await call<Info>(to, token, `/migrate/room/${dump.id}/info`);
    const diff = sameCounts(dump.info, target);
    if (flags.from) diff.push(...sameCounts(await call<Info>(flags.from, fromToken, `/migrate/room/${dump.id}/info`), target).map((d) => `source ${d}`));
    if (diff.length) bad.push(`${dump.id}: ${diff.join(", ")}`);
  });
  if (bad.length) die(`${bad.length} of ${files.length} rooms differ:\n${bad.join("\n")}`);
  console.log(`${files.length} rooms match`);
}

// ---- KV (OAUTH_KV: the Claudes' OAuth grants and tokens), through Cloudflare's REST API ----
type KvKey = { name: string; expiration?: number; metadata?: unknown };
const kvBase = () => `https://api.cloudflare.com/client/v4/accounts/${need("account")}/storage/kv/namespaces/${need("namespace")}`;
async function cf(path: string, init?: RequestInit) {
  const token = process.env.CF_API_TOKEN ?? die("set CF_API_TOKEN (Workers KV Storage: Read on the source / Edit on the target)");
  const res = await fetch(kvBase() + path, { ...init, headers: { authorization: `Bearer ${token}`, ...init?.headers } });
  if (!res.ok) die(`${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

async function kvExport() {
  const out = need("out");
  await mkdir(out, { recursive: true });
  const keys: KvKey[] = [];
  for (let cursor = ""; ; ) {
    const j = (await (await cf(`/keys?limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`)).json()) as { result: KvKey[]; result_info: { cursor?: string } };
    keys.push(...j.result);
    if (!j.result_info.cursor) break;
    cursor = j.result_info.cursor;
  }
  console.log(`${keys.length} keys`);
  const entries: { key: string; value: string; base64: true; expiration?: number; metadata?: unknown }[] = [];
  await each(keys, async (k) => {
    const buf = Buffer.from(await (await cf(`/values/${encodeURIComponent(k.name)}`)).arrayBuffer());
    entries.push({ key: k.name, value: buf.toString("base64"), base64: true, ...(k.expiration ? { expiration: k.expiration } : {}), ...(k.metadata ? { metadata: k.metadata } : {}) });
  });
  await writeFile(join(out, "kv.json"), JSON.stringify(entries));
  console.log(`kv export done: ${entries.length} keys`);
}

async function kvImport() {
  const dir = need("dir");
  const now = Date.now() / 1000;
  // KV refuses an expiration less than 60 s away; those tokens are about to die anyway.
  const all = JSON.parse(await readFile(join(dir, "kv.json"), "utf8")) as { expiration?: number }[];
  const entries = all.filter((e) => !e.expiration || e.expiration > now + 120);
  for (let i = 0; i < entries.length; i += 5000) {
    await cf(`/bulk`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(entries.slice(i, i + 5000)) });
    console.log(`${Math.min(i + 5000, entries.length)}/${entries.length}`);
  }
  console.log(`kv import done (${all.length - entries.length} expired keys skipped)`);
}

const commands: Record<string, () => Promise<void>> = { export: exportRooms, import: importRooms, verify, "kv-export": kvExport, "kv-import": kvImport };
await (commands[cmd] ?? (() => die(`usage: bun scripts/migrate.ts ${Object.keys(commands).join(" | ")} [flags] (see the top of this file)`)))();
