// People's read receipts (Valls): each person's read point in a room is a "seen" face under the messages, like an
// agent's. In a DM it is reciprocal, like WhatsApp: when either person turned "Read receipts" off, neither sees the
// other's; rooms always show them, and agents' reads are never hidden. The server enforces it: the list a DM sends
// carries no person's read point then. The actual Book over in-memory SQLite; D1 is a second bun:sqlite database.
import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
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
const ana = "ana@example.com",
  bia = "bia@example.com";
const DM = "dm0123456789abcdef0123",
  ROOM = "room01";

function d1(db: Database) {
  const prepare = (query: string) => {
    const bound = (...params: (string | number | null)[]) => ({
      run: async () => ({
        meta: { changes: db.query(query).run(...params).changes },
      }),
      first: async () => db.query(query).get(...params) ?? null,
      all: async () => ({ results: db.query(query).all(...params) }),
    });
    return { bind: bound, ...bound() };
  };
  return {
    prepare,
    batch: async (statements: { run: () => Promise<unknown> }[]) => {
      const out = [];
      for (const s of statements) out.push(await s.run());
      return out;
    },
  };
}

function fixture(bookId: string) {
  const room = new Database(":memory:"),
    db = new Database(":memory:");
  db.exec(`CREATE TABLE waits (book_id TEXT, ref TEXT, email TEXT, thread TEXT, topic TEXT, author TEXT, text TEXT, ts INTEGER, about TEXT, PRIMARY KEY (book_id, ref, email));
    CREATE TABLE human_reads (email TEXT, book_id TEXT, last_id INTEGER, PRIMARY KEY (email, book_id));
    CREATE TABLE digest_items (email TEXT, book_id TEXT, msg_id INTEGER, thread TEXT, author TEXT, text TEXT, ts INTEGER, PRIMARY KEY (email, book_id, msg_id));
    CREATE TABLE members (book_id TEXT, email TEXT);
    CREATE TABLE users (email TEXT PRIMARY KEY, read_receipts INTEGER);
    CREATE TABLE events (name TEXT, path TEXT, visitor TEXT, country TEXT, user TEXT, dims TEXT, ts INTEGER);`);
  for (const e of [ana, bia]) {
    db.query(`INSERT INTO members (book_id, email) VALUES (?, ?)`).run(bookId, e);
    db.query(`INSERT INTO users (email) VALUES (?)`).run(e);
  }
  const sql = {
    exec(query: string, ...params: (string | number | null)[]) {
      const text = query.trim();
      if (!params.length && /;\s*\S/.test(text)) {
        room.exec(text);
        return { toArray: () => [], one: () => ({}), rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() };
      }
      const statement = room.query(text);
      const rows = statement.columnNames.length
        ? (statement.all(...params) as Record<string, unknown>[])
        : (statement.run(...params), []);
      return { toArray: () => rows, one: () => rows[0], rowsWritten: 0, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
  const ctx = {
    storage: { sql, getAlarm: async () => null, setAlarm: async () => {} },
    waitUntil: (p: unknown) => void Promise.resolve(p).catch(() => {}),
    getWebSockets: () => [],
    getTags: () => [],
    blockConcurrencyWhile: (fn: () => unknown) => fn(),
  };
  const book = new Book(
    ctx as unknown as ConstructorParameters<typeof Book>[0],
    {
      DB: d1(db),
      PEOPLE: {
        idFromName: (email: string) => email,
        get: () => ({ fetch: async () => new Response("ok") }),
      },
    } as unknown as ConstructorParameters<typeof Book>[1],
  );
  book.set("book_id", bookId);
  const off = (email: string) => db.query(`UPDATE users SET read_receipts = 0 WHERE email = ?`).run(email);
  const on = (email: string) => db.query(`UPDATE users SET read_receipts = 1 WHERE email = ?`).run(email);
  const people = async () =>
    (await book.receiptsFor()).filter((r) => r.person).map((r) => `${r.email}:${r.read}`).sort();
  const agents = async () => (await book.receiptsFor()).filter((r) => !r.person).map((r) => r.email);
  return { book, off, on, people, agents };
}

test("a person's read point is a receipt for the room, read and delivered alike, never for @vibe", async () => {
  const f = fixture(ROOM);
  await f.book.markRead([ana, "ai"], 7);
  await f.book.markRead([ana], 5); // never goes back
  await f.book.markRead([bia], 9);
  const list = await f.book.receiptsFor();
  expect(list.map((r) => [r.agent, r.email, r.read, r.delivered, r.person])).toEqual(
    expect.arrayContaining([
      [`p:${ana}`, ana, 7, 7, true],
      [`p:${bia}`, bia, 9, 9, true],
    ]),
  );
  expect(list).toHaveLength(2);
});

test("rooms ignore the setting: people's reads always show", async () => {
  const f = fixture(ROOM);
  f.off(ana);
  f.off(bia);
  await f.book.markRead([ana, bia], 3);
  expect(await f.people()).toEqual([`${ana}:3`, `${bia}:3`]);
});

test("a DM is reciprocal: either person off hides both read points; agents stay; both on shows them", async () => {
  const f = fixture(DM);
  await f.book.markRead([ana, bia], 4);
  f.book.receipt({ agent: "a1", email: ana, who: "claude-opus-5-5", read: 4, delivered: 4 });
  expect(await f.people()).toEqual([`${ana}:4`, `${bia}:4`]);
  f.off(bia); // Bia turned it off: Ana does not see Bia's, and Bia does not see Ana's
  expect(await f.people()).toEqual([]);
  expect(await f.agents()).toEqual([ana]); // Ana's Claude still shows it read
  f.on(bia);
  f.off(ana);
  expect(await f.people()).toEqual([]);
  f.on(ana);
  expect(await f.people()).toEqual([`${ana}:4`, `${bia}:4`]);
});
