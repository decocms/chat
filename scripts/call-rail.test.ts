// The green speaker on the rail (a call is on in a room): the real Book over an in-memory SQLite writes who is in
// the call to D1 (books.in_call) when that changes and pokes the members, and GET /api/me (meFor, over the real
// schema in bun:sqlite) carries their names in the room list. D1 is a bun:sqlite stand-in.
import { Database } from "bun:sqlite";
import { readFileSync } from "node:fs";
import { expect, mock, test } from "bun:test";
import { callRoster, recorderEmail } from "../shared/call";
import { MeResult } from "../shared/schemas";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {
    ctx: unknown;
    env: unknown;
    constructor(ctx: unknown, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  },
  WorkerEntrypoint: class {},
  env: {},
}));
const { Book } = await import("../src/book");
const { meFor } = await import("../src/services");
import type { Env } from "../src/index";

const ROOM = "abcdef",
  ANA = "ana@x.test",
  BIA = "bia@x.test";

function d1(sqlite: Database, writes: string[]) {
  const bound = (sql: string, args: unknown[]) => ({
    bind: (...values: unknown[]) => bound(sql, values),
    async first() {
      return sqlite.query(sql).get(...(args as never[])) ?? null;
    },
    async all() {
      return { results: sqlite.query(sql).all(...(args as never[])) };
    },
    async run() {
      writes.push(sql);
      const r = sqlite.query(sql).run(...(args as never[]));
      return { meta: { changes: r.changes } };
    },
  });
  const prepare = (sql: string) => bound(sql, []);
  return {
    prepare,
    async batch(statements: { run(): Promise<unknown> }[]) {
      for (const statement of statements) await statement.run();
      return [];
    },
  } as unknown as D1Database;
}

// D1's schema as the Worker makes it (src/index.ts: SCHEMA, then ALTERS), read from its source: importing the
// Worker's entry needs built assets.
const DDL = [
  ...readFileSync(new URL("../src/index.ts", import.meta.url), "utf8").matchAll(
    /`((?:CREATE|ALTER) [^`]+)`/g,
  ),
].map((m) => m[1]!);

async function world() {
  const main = new Database(":memory:");
  for (const statement of DDL)
    try {
      main.run(statement);
    } catch {
      // An ALTER whose column CREATE already has, as on D1.
    }
  const writes: string[] = [];
  const DB = d1(main, writes);
  const rosterWrites = () =>
    writes.filter((sql) => sql.includes("SET in_call")).length;
  main.run(
    `INSERT INTO books (id, title, owner, created_at, updated_at) VALUES (?, 'Sala', ?, 1, 1)`,
    [ROOM, ANA],
  );
  for (const email of [ANA, BIA])
    main.run(`INSERT INTO members (book_id, email) VALUES (?, ?)`, [
      ROOM,
      email,
    ]);
  main.run(`INSERT INTO users (email, name) VALUES (?, 'Ana')`, [ANA]);
  // The Book's own storage.
  const own = new Database(":memory:");
  const cursor = (rows: Record<string, unknown>[], written: number) => ({
    toArray: () => rows,
    one: () => rows[0],
    rowsWritten: written,
    [Symbol.iterator]: () => rows[Symbol.iterator](),
  });
  const sql = {
    exec(query: string, ...params: (string | number | null)[]) {
      const text = query.trim();
      if (!params.length && /;\s*\S/.test(text)) {
        own.exec(text);
        return cursor([], 0);
      }
      const statement = own.query(text);
      if (statement.columnNames.length)
        return cursor(statement.all(...params) as Record<string, unknown>[], 0);
      return cursor([], statement.run(...params).changes);
    },
  };
  const pending: Promise<unknown>[] = [];
  const ctx = {
    storage: { sql, getAlarm: async () => null, setAlarm: async () => {} },
    waitUntil: (p: unknown) =>
      void pending.push(Promise.resolve(p).catch(() => {})),
    getWebSockets: () => [],
    getTags: () => [ANA],
    blockConcurrencyWhile: (fn: () => unknown) => fn(),
  };
  const pokes: { to: string; t: string }[] = [];
  const PEOPLE = {
    idFromName: (name: string) => name,
    get: (to: string) => ({
      fetch: async (url: string, init?: { body?: string; method?: string }) => {
        // /api/me's cache: always a miss here, so meFor reads D1.
        if (url === "https://person/me")
          return new Response(null, { status: 404 });
        pokes.push({
          to,
          ...(JSON.parse(init?.body ?? "{}") as { t: string }),
        });
        return new Response(null, { status: 204 });
      },
    }),
  };
  const env = {
    DB,
    PEOPLE,
    SESSION_SECRET: "test-secret",
    ASSETS: {
      fetch: async () => new Response(null, { headers: { etag: '"v1"' } }),
    },
    DOC_ROOMS: {
      idFromName: () => "doc",
      get: () => ({ setText: async () => {}, kickAll: async () => {} }),
    },
  } as unknown as Env;
  const book = new Book(
    ctx as unknown as ConstructorParameters<typeof Book>[0],
    env as unknown as ConstructorParameters<typeof Book>[1],
  );
  // Other test files in the same run may mock cloudflare:workers with a DurableObject that keeps neither.
  Object.assign(book, { ctx, env });
  book.set("book_id", ROOM);
  book.wakeAt = async () => {};
  book.members = async () => [ANA, BIA];
  const settle = async () => {
    while (pending.length) await Promise.all(pending.splice(0));
  };
  const stored = () =>
    (
      main.query(`SELECT in_call FROM books WHERE id = ?`).get(ROOM) as {
        in_call: string | null;
      }
    ).in_call;
  const listed = async (email: string) => {
    const me = MeResult.parse(
      await meFor(
        env,
        { waitUntil: () => {} },
        email,
        new Request("https://x.test/api/me", {
          headers: { cookie: "vb_lang=pt" },
        }),
      ),
    );
    return me.books.find((room) => room.id === ROOM)!;
  };
  return { book, settle, stored, listed, pokes, rosterWrites };
}

test("who is in a call: people only, each once, in a stable order", () => {
  expect(
    callRoster([
      { email: BIA },
      { email: recorderEmail(ROOM) },
      { email: ANA },
      { email: BIA },
    ]),
  ).toEqual([ANA, BIA]);
  expect(callRoster([{ email: recorderEmail(ROOM) }])).toEqual([]);
});

test("a call on in a room puts who is in it in the room list (/api/me), live, and its end takes it off", async () => {
  const w = await world();
  // No call: no flag.
  expect((await w.listed(BIA)).in_call ?? null).toBeNull();

  w.book.callJoin(ROOM, ANA, "s-ana", "https://x.test");
  await w.settle();
  expect(JSON.parse(w.stored()!)).toEqual([ANA]);
  // Every member's open app refetches /api/me: the rail changes without a reload.
  expect(
    [...new Set(w.pokes.filter((p) => p.t === "me").map((p) => p.to))].sort(),
  ).toEqual([ANA, BIA]);
  // By name (users.name), or the email's start when there is none; yours too.
  expect(JSON.parse((await w.listed(BIA)).in_call!)).toEqual(["Ana"]);
  expect(JSON.parse((await w.listed(ANA)).in_call!)).toEqual(["Ana"]);

  w.book.callJoin(ROOM, BIA, "s-bia", "https://x.test");
  await w.settle();
  expect(JSON.parse((await w.listed(ANA)).in_call!)).toEqual(["Ana", "bia"]);

  // A change of tracks, the recorder coming in, or the same person on a new tab: nobody new, nothing written.
  const before = w.rosterWrites();
  w.book.callTracks(ANA, ["t1"], []);
  w.book.callJoin(ROOM, recorderEmail(ROOM), "s-rec", "https://x.test");
  w.book.callJoin(ROOM, BIA, "s-bia2", "https://x.test");
  await w.settle();
  expect(w.rosterWrites()).toBe(before);
  expect(JSON.parse(w.stored()!)).toEqual([ANA, BIA]);

  w.book.callLeave(ANA);
  await w.settle();
  expect(JSON.parse((await w.listed(BIA)).in_call!)).toEqual(["bia"]);
  w.book.callLeave(BIA);
  await w.settle();
  // Only the recorder is left: the call is over for the rail.
  expect(w.stored()).toBeNull();
  expect((await w.listed(BIA)).in_call ?? null).toBeNull();
});
