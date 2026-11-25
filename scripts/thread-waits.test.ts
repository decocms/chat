// Every open thread you own is in your Inbox (a D1 wait e<epic>), and @vibe calls you about one that stood still for
// 3 days (Gimenes #5242, PO #5257). The actual Book over in-memory SQLite; D1 is a second bun:sqlite database with the
// real waits table and the rows names/handles read.
import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import {
  STALE_THREAD_MS,
  threadWait,
  urgentThreadWait,
} from "../shared/threadWait";
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
  ana = "ana@example.com";

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
    CREATE TABLE books (id TEXT PRIMARY KEY, epics TEXT, title TEXT, owner TEXT);
    CREATE TABLE members (book_id TEXT, email TEXT);
    CREATE TABLE users (email TEXT PRIMARY KEY, name TEXT, handle TEXT);
    CREATE TABLE events (name TEXT, path TEXT, visitor TEXT, country TEXT, user TEXT, dims TEXT, ts INTEGER);
    CREATE TABLE human_reads (email TEXT, book_id TEXT, last_id INTEGER, PRIMARY KEY (email, book_id));
    CREATE TABLE digest_items (email TEXT, book_id TEXT, msg_id INTEGER, thread TEXT, author TEXT, text TEXT, ts INTEGER, PRIMARY KEY (email, book_id, msg_id));
    INSERT INTO books (id, title) VALUES ('room01', 'Produto');
    INSERT INTO members VALUES ('room01', '${voce}'), ('room01', '${ana}');
    INSERT INTO users VALUES ('${voce}', 'Você Silva', 'voce'), ('${ana}', 'Ana Souza', 'ana');`);
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
      let written = 0;
      const rows = statement.columnNames.length
        ? (statement.all(...params) as Record<string, unknown>[])
        : ((written = statement.run(...params).changes), []);
      return {
        toArray: () => rows,
        one: () => rows[0],
        rowsWritten: written,
        [Symbol.iterator]: () => rows[Symbol.iterator](),
      };
    },
  };
  const pending: Promise<unknown>[] = [];
  const ctx = {
    storage: { sql, getAlarm: async () => null, setAlarm: async () => {} },
    waitUntil: (p: unknown) =>
      void pending.push(Promise.resolve(p).catch(() => {})),
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
      DOC_ROOMS: {
        idFromName: () => "doc",
        get: () => ({ setText: async () => {}, kickAll: async () => {} }),
      },
    } as unknown as ConstructorParameters<typeof Book>[1],
  );
  book.set("book_id", "room01");
  /** Let every waitUntil (the D1 writes) finish. */
  const settle = async () => {
    while (pending.length) await Promise.all(pending.splice(0));
  };
  const waits = () =>
    db
      .query(
        `SELECT ref, email, thread, topic, author, text FROM waits WHERE ref LIKE 'e%' ORDER BY ref, email`,
      )
      .all() as {
      ref: string;
      email: string;
      thread: string;
      topic: string;
      author: string;
      text: string;
    }[];
  const thread = async (
    title: string,
    owner: string | null,
    tasks = ["fazer"],
  ) => {
    const id = book.createEpic(title, tasks);
    if (owner) await book.setEpicOwner(id, owner);
    await settle();
    return id;
  };
  const messages = (id: string) =>
    room
      .query(`SELECT author, text FROM messages WHERE thread = ? ORDER BY id`)
      .all(id) as { author: string; text: string }[];
  /** Pretend the thread (and everything said in it) happened `ms` ago. */
  const age = (id: string, ms: number) => {
    room.query(`UPDATE epics SET ts = ts - ? WHERE id = ?`).run(ms, id);
    room.query(`UPDATE messages SET ts = ts - ? WHERE thread = ?`).run(ms, id);
  };
  return { book, room, waits, thread, settle, messages, age };
}

test("an open thread you own is a wait in your Inbox, until it is done or deleted", async () => {
  const f = fixture();
  const id = await f.thread("Lançar o app", voce, ["build", "deploy"]);
  expect(f.waits()).toEqual([
    {
      ref: `e${id}`,
      email: voce,
      thread: id,
      topic: "Lançar o app",
      author: "",
      text: "todo|0/2",
    },
  ]);
  const quiet = f.waits()[0]!;
  expect(urgentThreadWait(quiet)).toBe(false); // only in "Suas threads", not "Para você"

  // All its tasks done: the thread moves to review and the wait says "ready to close" (it is for you now).
  f.room
    .query(`UPDATE tasks SET done = 1, status = 'done' WHERE epic_id = ?`)
    .run(id);
  f.book.epicsChanged();
  await f.settle();
  const ready = f.waits()[0]!;
  expect(ready.text).toBe("review|2/2");
  expect(threadWait(ready)).toMatchObject({
    ready: true,
    stale: false,
    done: 2,
    total: 2,
  });
  expect(urgentThreadWait(ready)).toBe(true);

  // Renamed: the same row follows.
  f.book.renameEpic(id, "Lançar o app v2");
  await f.settle();
  expect(f.waits().map((w) => w.topic)).toEqual(["Lançar o app v2"]);

  // "Marcar como feita" from the Inbox: done, and the wait goes.
  expect(f.book.inboxDone("room01", id, voce)).toBe(true);
  await f.settle();
  expect(f.waits()).toEqual([]);
  expect(f.book.inboxDone("room01", id, voce)).toBe(false); // already done

  // Opened again: back in the Inbox. Deleted: gone.
  f.book.setEpicStatus(id, "doing");
  await f.settle();
  expect(f.waits().map((w) => w.ref)).toEqual([`e${id}`]);
  f.book.deleteEpic(id);
  await f.settle();
  expect(f.waits()).toEqual([]);
});

test("a thread with no owner, or an answer thread, is no one's wait", async () => {
  const f = fixture();
  await f.thread("Sem dono", null);
  const answer = await f.thread("Uma pergunta", voce);
  f.book.set(`answer:${answer}`, "1");
  f.book.epicsChanged();
  await f.settle();
  expect(f.waits()).toEqual([]);
});

test("a new owner takes the wait over", async () => {
  const f = fixture();
  const id = await f.thread("Contrato", voce);
  expect(f.waits().map((w) => w.email)).toEqual([voce]);
  await f.book.setEpicOwner(id, ana);
  await f.settle();
  expect(f.waits().map((w) => [w.ref, w.email])).toEqual([[`e${id}`, ana]]);
  await f.book.setEpicOwner(id, "");
  await f.settle();
  expect(f.waits()).toEqual([]);
});

test("@vibe calls the owner of a thread quiet for 3 days, once per quiet period", async () => {
  const f = fixture();
  const id = await f.thread("Migração", voce);
  f.book.addMessage(id, ana, "comecei");
  await f.settle();

  // Not yet 3 days: nothing, and it says when to look again.
  expect(await f.book.nudgeStale()).toBeGreaterThan(Date.now());
  expect(f.messages(id).filter((m) => m.author === "ai")).toEqual([]);

  f.age(id, STALE_THREAD_MS + 60_000);
  await f.book.nudgeStale();
  await f.settle();
  const said = f.messages(id).filter((m) => m.author === "ai");
  expect(said).toHaveLength(1);
  expect(said[0]!.text).toBe(
    "@voce essa thread está parada há 3 dias: marcar como feita, cancelar ou continuar?",
  );
  // The owner's wait moved to "Para você": from @vibe.
  const called = f.waits()[0]!;
  expect(called.author).toBe("ai");
  expect(threadWait(called)).toMatchObject({ stale: true });
  expect(urgentThreadWait(called)).toBe(true);

  // Same quiet period (its own line doesn't count as activity): no second call.
  await f.book.nudgeStale(Date.now() + STALE_THREAD_MS);
  await f.settle();
  expect(f.messages(id).filter((m) => m.author === "ai")).toHaveLength(1);

  // Someone speaks there: the call is over, the wait is quiet again, and no call until 3 more days.
  f.book.addMessage(id, voce, "vou continuar amanhã");
  await f.settle();
  expect(f.waits()[0]!.author).toBe("");
  await f.book.nudgeStale();
  expect(f.messages(id).filter((m) => m.author === "ai")).toHaveLength(1);

  // The next quiet period calls again.
  await f.book.nudgeStale(Date.now() + STALE_THREAD_MS + 60_000);
  await f.settle();
  expect(f.messages(id).filter((m) => m.author === "ai")).toHaveLength(2);
});

test("done and answer threads are never called about, and a pass calls about at most 3", async () => {
  const f = fixture();
  const done = await f.thread("Feita", voce);
  f.book.setEpicStatus(done, "done");
  const answer = await f.thread("Pergunta", voce);
  f.book.set(`answer:${answer}`, "1");
  const open = await Promise.all(
    [1, 2, 3, 4].map((n) => f.thread(`Aberta ${n}`, voce)),
  );
  await f.settle();
  const later = Date.now() + STALE_THREAD_MS + 60_000;
  const next = await f.book.nudgeStale(later);
  await f.settle();
  expect(f.messages(done).filter((m) => m.author === "ai")).toEqual([]);
  expect(f.messages(answer).filter((m) => m.author === "ai")).toEqual([]);
  const called = open.filter((id) =>
    f.messages(id).some((m) => m.author === "ai"),
  );
  expect(called).toHaveLength(3);
  expect(next).toBe(later + 3600_000); // the fourth one in the next pass
  // The alarm fires again sooner (a message, a board change): still no one more until the pass gap.
  expect(await f.book.nudgeStale(later + 600_000)).toBe(later + 3600_000);
  expect(
    open.filter((id) => f.messages(id).some((m) => m.author === "ai")),
  ).toHaveLength(3);
  await f.book.nudgeStale(later + 3600_000);
  expect(
    open.filter((id) => f.messages(id).some((m) => m.author === "ai")),
  ).toHaveLength(4);
});
