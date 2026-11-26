// The room's search in its Durable Object (Book.search): by words, by a person with no words, both, and the pages.
// The actual Book over an in-memory SQLite (bun:sqlite) standing in for the Durable Object's storage; D1 is a fake.
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
const ana = "ana@example.test";
const bruno = "bruno@example.test";

function cursor(rows: Record<string, unknown>[], written: number) {
  return {
    toArray: () => rows,
    one: () => {
      if (!rows[0]) throw Error("no row");
      return rows[0];
    },
    rowsWritten: written,
    [Symbol.iterator]: () => rows[Symbol.iterator](),
  };
}
function fixture() {
  const db = new Database(":memory:");
  const sql = {
    exec(query: string, ...params: (string | number | null)[]) {
      const text = query.trim();
      if (!params.length && /;\s*\S/.test(text)) {
        db.exec(text);
        return cursor([], 0);
      }
      const statement = db.query(text);
      if (statement.columnNames.length)
        return cursor(statement.all(...params) as Record<string, unknown>[], 0);
      return cursor([], statement.run(...params).changes);
    },
  };
  const statement = () => {
    const bound = () => ({
      run: async () => ({ meta: { changes: 0 } }),
      first: async () => null,
      all: async () => ({ results: [] }),
    });
    return { bind: bound, ...bound() };
  };
  const ctx = {
    storage: { sql, getAlarm: async () => null, setAlarm: async () => {} },
    waitUntil: (p: unknown) => void Promise.resolve(p).catch(() => {}),
    getWebSockets: () => [],
    acceptWebSocket: () => {},
    getTags: () => [ana],
    blockConcurrencyWhile: (fn: () => unknown) => fn(),
  };
  const book = new Book(
    ctx as unknown as ConstructorParameters<typeof Book>[0],
    {
      DB: { prepare: statement, batch: async () => [] },
      DOC_ROOMS: {
        idFromName: () => "doc",
        get: () => ({ setText: async () => {} }),
      },
    } as unknown as ConstructorParameters<typeof Book>[1],
  );
  book.set("book_id", "abcdef");
  book.wakeAt = async () => {};
  book.members = async () => [ana, bruno];
  return { book, db };
}
const ids = (out: { messages: { id: number }[] }) =>
  out.messages.map((m) => m.id);

test("a person alone lists their own messages, newest first, without their agent's or deleted ones", () => {
  const { book, db } = fixture();
  const first = book.addMessage("main", ana, "bom dia").id;
  book.addMessage("main", bruno, "bom dia, Ana");
  book.addMessage("main", ana, "deploy feito", {
    kind: "agent",
    via: "claude",
  });
  const gone = book.addMessage("main", ana, "vou apagar").id;
  db.query(
    `UPDATE messages SET text = '', files = NULL, deleted = 1 WHERE id = ?`,
  ).run(gone);
  const last = book.addMessage("main", ana, "fechei o orçamento").id;
  const out = book.search("abcdef", "", 30, ana, { from: ana });
  expect(ids(out)).toEqual([last, first]);
  expect(out.more).toBe(false);
  expect(out.epics).toEqual([]);
  expect(out.messages[0]).toMatchObject({
    author: ana,
    by_agent: false,
    snippet: "fechei o orçamento",
  });
  // The email is matched as the room stores it (lowercase).
  expect(
    ids(book.search("abcdef", "", 30, ana, { from: " Ana@Example.test " })),
  ).toEqual([last, first]);
});

test("words and a person narrow together; words alone still find everyone's", () => {
  const { book } = fixture();
  const mine = book.addMessage("main", ana, "o deploy de hoje").id;
  const theirs = book.addMessage("main", bruno, "deploy amanhã").id;
  book.addMessage("main", ana, "almoço?");
  expect(ids(book.search("abcdef", "deploy", 30, ana, { from: ana }))).toEqual([
    mine,
  ]);
  expect(ids(book.search("abcdef", "deploy", 30, ana))).toEqual([theirs, mine]);
  // No words and no person: nothing to look for.
  expect(ids(book.search("abcdef", " ", 30, ana))).toEqual([]);
});

test("pages: `more` says an older match exists, and `before` starts the next page", () => {
  const { book } = fixture();
  const sent = Array.from(
    { length: 5 },
    (_, i) => book.addMessage("main", ana, `mensagem ${i + 1}`).id,
  );
  const page1 = book.search("abcdef", "", 2, ana, { from: ana });
  expect(ids(page1)).toEqual([sent[4], sent[3]]);
  expect(page1.more).toBe(true);
  const page2 = book.search("abcdef", "", 2, ana, {
    from: ana,
    before: sent[3],
  });
  expect(ids(page2)).toEqual([sent[2], sent[1]]);
  const page3 = book.search("abcdef", "", 2, ana, {
    from: ana,
    before: sent[1],
  });
  expect(ids(page3)).toEqual([sent[0]]);
  expect(page3.more).toBe(false);
});

test("a person's private ask stays theirs: another viewer does not get it by filtering on them", () => {
  const { book } = fixture();
  const ask = book.addMessage(
    "main",
    bruno,
    "⏸ Seu Claude pede permissão: **Bash**\n`ls`\n\nSó vale a resposta da sua conta logada aqui.",
    { kind: "agent", choices: { options: ["Aprovar", "Negar"], multi: false } },
  ).id;
  const answer = book.addMessage("main", bruno, "Aprovar", { replyTo: ask }).id;
  const hello = book.addMessage("main", bruno, "oi").id;
  expect(ids(book.search("abcdef", "", 30, ana, { from: bruno }))).toEqual([
    hello,
  ]);
  expect(ids(book.search("abcdef", "", 30, bruno, { from: bruno }))).toEqual([
    hello,
    answer,
  ]);
});
