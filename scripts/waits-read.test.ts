// Reading a message clears the notification it made (PO #5172): the room's read point for you moving past an ask or
// mention (m<id>) deletes that wait, so every tab and device agrees, and your /api/me is poked. Work stays: a task in
// review (t<id>) and your Claude's questions (a/b) wait until done. The actual Book over in-memory SQLite; D1 is a
// second bun:sqlite database with the real waits/human_reads tables. Your own Claude's message is an m<id> for you too
// (Gimenes #5427): a number until you read it; other people's Claudes make none for you.
import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import { waitCount } from "../web/features/waits/model";
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
const voce = "voce@example.com",
  other = "other@example.com";

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

function fixture() {
  const room = new Database(":memory:"),
    db = new Database(":memory:");
  db.exec(`CREATE TABLE waits (book_id TEXT, ref TEXT, email TEXT, thread TEXT, topic TEXT, author TEXT, text TEXT, ts INTEGER, PRIMARY KEY (book_id, ref, email));
    CREATE TABLE human_reads (email TEXT, book_id TEXT, last_id INTEGER, PRIMARY KEY (email, book_id));
    CREATE TABLE digest_items (email TEXT, book_id TEXT, msg_id INTEGER, thread TEXT, author TEXT, text TEXT, ts INTEGER, PRIMARY KEY (email, book_id, msg_id));
    CREATE TABLE events (name TEXT, path TEXT, visitor TEXT, country TEXT, user TEXT, dims TEXT, ts INTEGER);`);
  const sql = {
    exec(query: string, ...params: (string | number | null)[]) {
      const text = query.trim();
      if (!params.length && /;\s*\S/.test(text)) {
        room.exec(text);
        return {
          toArray: () => [],
          one: () => ({}),
          rowsWritten: 0,
          [Symbol.iterator]: () => [][Symbol.iterator](),
        };
      }
      const statement = room.query(text);
      const rows = statement.columnNames.length
        ? (statement.all(...params) as Record<string, unknown>[])
        : (statement.run(...params), []);
      return {
        toArray: () => rows,
        one: () => rows[0],
        rowsWritten: 0,
        [Symbol.iterator]: () => rows[Symbol.iterator](),
      };
    },
  };
  const poked: string[] = [];
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
        get: (email: string) => ({
          fetch: async () => {
            poked.push(email);
            return new Response("ok");
          },
        }),
      },
    } as unknown as ConstructorParameters<typeof Book>[1],
  );
  book.set("book_id", "room01");
  const wait = (ref: string, email = voce) =>
    db
      .query(
        `INSERT INTO waits (book_id, ref, email, thread, topic, author, text, ts) VALUES ('room01', ?, ?, 'main', '', ?, ?, 1)`,
      )
      .run(ref, email, other, ref);
  const refs = (email = voce) =>
    (
      db
        .query(`SELECT ref FROM waits WHERE email = ? ORDER BY ref`)
        .all(email) as { ref: string }[]
    ).map((r) => r.ref);
  const held = (msg: number) =>
    db
      .query(
        `INSERT INTO digest_items (email, book_id, msg_id, thread, author, text, ts) VALUES (?, 'room01', ?, 'main', ?, 'hi', 1)`,
      )
      .run(voce, msg, other);
  const heldIds = () =>
    (
      db.query(`SELECT msg_id FROM digest_items ORDER BY msg_id`).all() as {
        msg_id: number;
      }[]
    ).map((r) => r.msg_id);
  return { book, wait, refs, poked, held, heldIds };
}

test("reading past a mention clears it; a task in review and Claude's questions stay", async () => {
  const f = fixture();
  for (const ref of ["m5", "m12", "t7", "a20", "b21"]) f.wait(ref);
  f.wait("m5", other);
  expect(waitCount(f.refs().map((ref) => ({ ref })))).toBe(2); // the room's red number: the two mentions
  await f.book.markRead([voce], 10);
  expect(f.refs()).toEqual(["a20", "b21", "m12", "t7"]); // m5 read; m12 is after the read point
  expect(f.refs(other)).toEqual(["m5"]); // someone else's read point did not move
  expect(f.poked).toEqual([voce]);
  expect(waitCount(f.refs().map((ref) => ({ ref })))).toBe(1);
  await f.book.markRead([voce], 12);
  expect(f.refs()).toEqual(["a20", "b21", "t7"]); // only work is left: the Inbox, no number on the room
  expect(waitCount(f.refs().map((ref) => ({ ref })))).toBe(0);
});

test("reading a held-back mention takes it out of the Inbox and the digest", async () => {
  const f = fixture();
  f.held(3);
  f.held(15);
  await f.book.markRead([voce], 10);
  expect(f.heldIds()).toEqual([15]);
  expect(f.poked).toEqual([voce]);
});

test("reading with nothing to clear does not poke the person", async () => {
  const f = fixture();
  f.wait("t7");
  await f.book.markRead([voce], 99);
  expect(f.refs()).toEqual(["t7"]);
  expect(f.poked).toEqual([]);
});

// Your own Claude speaking in a room is like someone mentioning you (Gimenes #5427): its message is an m<id> wait for
// you, the room's red number, until you read it. The real agent post path (Book.agentPost).
const settle = () => new Promise((r) => setTimeout(r, 20));
function quiet(f: ReturnType<typeof fixture>) {
  f.book.wakeAt = async () => {};
  f.book.markBusy = async () => {};
}

test("your own Claude's reply is a number for you until you read it", async () => {
  const f = fixture();
  quiet(f);
  const r = await f.book.agentPost("room01", voce, "Pronto: o gráfico está no doc. Quer que eu publique?");
  if (!("id" in r) || typeof r.id !== "number") throw Error(JSON.stringify(r));
  await settle();
  expect(f.refs()).toEqual([`m${r.id}`]);
  expect(f.refs(other)).toEqual([]); // nobody else's number: it is your Claude talking to you
  expect(waitCount(f.refs().map((ref) => ({ ref })))).toBe(1);
  expect(f.poked).toContain(voce);
  await f.book.markRead([voce], r.id); // you opened the room
  expect(f.refs()).toEqual([]);
  expect(waitCount(f.refs().map((ref) => ({ ref })))).toBe(0);
});

test("no number when you have the room open, or already read past it", async () => {
  const f = fixture();
  quiet(f);
  f.book.online = () => [voce];
  await f.book.agentPost("room01", voce, "Feito.");
  await settle();
  expect(f.refs()).toEqual([]);
  const g = fixture();
  quiet(g);
  await g.book.markRead([voce], 999);
  await g.book.agentPost("room01", voce, "Feito.");
  await settle();
  expect(g.refs()).toEqual([]);
});

test("someone else's Claude talking makes no number for you", async () => {
  const f = fixture();
  quiet(f);
  const r = await f.book.agentPost("room01", other, "Terminei a migração, você pode revisar?");
  if (!("id" in r) || typeof r.id !== "number") throw Error(JSON.stringify(r));
  await settle();
  expect(f.refs()).toEqual([]); // its "você" is its own human
  expect(f.refs(other)).toEqual([`m${r.id}`]);
});

test("your Claude's question with buttons stays an a<id> in the Inbox, not a second m<id>", async () => {
  const f = fixture();
  quiet(f);
  const r = await f.book.agentPost("room01", voce, "❓ Seu Claude pergunta: qual cor?", "main", [], "", false, false, undefined, { options: ["azul", "verde"], multi: false });
  if (!("id" in r) || typeof r.id !== "number") throw Error(JSON.stringify(r));
  await settle();
  expect(f.refs()).toEqual([`a${r.id}`]);
});

test("a person's @mention still makes a number for whoever is not looking, cleared on read", async () => {
  const f = fixture();
  f.wait("m40"); // the router's wait for the mention, after the message
  expect(waitCount(f.refs().map((ref) => ({ ref })))).toBe(1);
  await f.book.markRead([other], 40); // the author's read point moves, not yours
  expect(f.refs()).toEqual(["m40"]);
  await f.book.markRead([voce], 40);
  expect(f.refs()).toEqual([]);
});
