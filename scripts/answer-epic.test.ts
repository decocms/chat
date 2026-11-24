// An answer epic never stays on "Claude está escrevendo" (Gui #4210): the actual Book over an in-memory SQLite
// (bun:sqlite) standing in for the Durable Object's storage. D1, alarms and AI are fakes.
import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import { encodeCall } from "../shared/jsonRpc";
import type { RoomCommand } from "../shared/commands";
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
const email = "member@example.test";

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
  const frames: string[] = [];
  const ws = { readyState: 1, send: (frame: string) => frames.push(frame) };
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
    getWebSockets: () => [ws],
    getTags: () => [email],
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
  book.answerIntent = async () => {};
  book.wakeAt = async () => {};
  book.members = async () => [email];
  let rpc = 0;
  const run = async (command: RoomCommand) => {
    const id = `r-${++rpc}`;
    await book.webSocketMessage(
      ws as unknown as WebSocket,
      encodeCall(command, id),
    );
    const reply = frames
      .map(
        (frame) =>
          JSON.parse(frame) as { id?: string; error?: { message: string } },
      )
      .find((frame) => frame.id === id);
    if (!reply) throw Error("no reply");
    return reply.error
      ? { ok: false as const, error: reply.error.message }
      : { ok: true as const };
  };
  const messages = () =>
    db
      .query(
        `SELECT id, thread, author, kind, via, text, reply_to FROM messages ORDER BY id`,
      )
      .all() as {
      id: number;
      thread: string;
      author: string;
      kind: string | null;
      via: string | null;
      text: string;
      reply_to: number | null;
    }[];
  const epic = (id: string) =>
    db
      .query(`SELECT id, title, owner, from_msg FROM epics WHERE id = ?`)
      .get(id) as {
      id: string;
      title: string;
      owner: string | null;
      from_msg: number | null;
    } | null;
  return { book, run, messages, epic, db };
}

// The Circulei case: a question became an answer epic, and the Claude answered with reply_to in main.
async function question(
  f: ReturnType<typeof fixture>,
  text = "pras clientes? não entendi",
) {
  const q = f.book.addMessage("main", email, text);
  const made = await f.book.agentEpic(
    "abcdef",
    email,
    text,
    "",
    ["Responder no doc"],
    "Claude",
    q.id,
    "a1",
    "",
    false,
    true,
  );
  if (!made.ok || !("epic_id" in made)) throw Error("no epic");
  return { q: q.id, epic: made.epic_id as string };
}

test("a reply to the question goes into its answer epic and fills the empty doc", async () => {
  const f = fixture();
  const { q, epic } = await question(f);
  expect(f.book.answerPending(epic)).toBe(true);
  const ack = f.book.agentAck("abcdef", "a1", email, "Claude", q);
  expect(ack).toMatchObject({ ok: true, answer_thread: epic });
  const posted = await f.book.agentPost(
    "abcdef",
    email,
    "É o painel que o cliente vê na loja.",
    "",
    [],
    "Claude",
    false,
    false,
    q,
  );
  expect(posted.ok).toBe(true);
  expect(f.messages().at(-1)).toMatchObject({ thread: epic, reply_to: q });
  expect(f.book.answerPending(epic)).toBe(false);
  expect(f.book.get(`doc:${epic}`)).toContain(
    "É o painel que o cliente vê na loja.",
  );
});

test("a progress post in the epic does not count as the answer", async () => {
  const f = fixture();
  const { epic } = await question(f);
  await f.book.agentPost("abcdef", email, "Pesquisando…", epic, [], "Claude");
  expect(f.book.answerPending(epic)).toBe(true);
});

test("an answer epic is not archived as done while its doc waits for the answer", async () => {
  const f = fixture();
  const { epic } = await question(f);
  f.db
    .query(`UPDATE tasks SET status = 'done', done = 1 WHERE epic_id = ?`)
    .run(epic);
  f.book.autoArchive();
  expect(
    (
      f.db.query(`SELECT archived FROM epics WHERE id = ?`).get(epic) as {
        archived: number | null;
      }
    ).archived,
  ).not.toBe(1);
});

test("an answer epic still empty after 10 minutes gets one reminder for who asked", async () => {
  const f = fixture();
  const { epic } = await question(f);
  const created = (
    f.db.query(`SELECT ts FROM epics WHERE id = ?`).get(epic) as { ts: number }
  ).ts;
  expect(f.book.nudgeUnanswered(created + 60_000)).toBe(created + 10 * 60_000);
  f.book.nudgeUnanswered(created + 11 * 60_000);
  f.book.nudgeUnanswered(created + 12 * 60_000);
  const nudges = f.db
    .query(
      `SELECT thread, author, tag, for_who FROM messages WHERE tag = 'reminder'`,
    )
    .all();
  expect(nudges).toEqual([
    { thread: epic, author: "ai", tag: "reminder", for_who: email },
  ]);
});
