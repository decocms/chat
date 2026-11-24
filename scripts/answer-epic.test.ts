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

test("an answer epic does not go to review while its doc waits for the answer", async () => {
  const f = fixture();
  const { epic } = await question(f);
  f.db
    .query(`UPDATE tasks SET status = 'done', done = 1 WHERE epic_id = ?`)
    .run(epic);
  f.book.autoReview();
  expect(status(f, epic)).toEqual({ archived: 0, status: "todo" });
});

const status = (f: ReturnType<typeof fixture>, id: string) => {
  const row = f.db
    .query(`SELECT archived, status FROM epics WHERE id = ?`)
    .get(id) as { archived: number | null; status: string | null };
  return { archived: row.archived ?? 0, status: row.status ?? "todo" };
};

test("a thread goes todo → doing → review on its own, and never to done (Gimenes #4247)", () => {
  const f = fixture();
  const id = f.book.createEpic("Trabalho", ["Um", "Dois"]);
  expect(status(f, id)).toEqual({ archived: 0, status: "todo" });
  const [one, two] = (
    f.db
      .query(`SELECT id FROM tasks WHERE epic_id = ? ORDER BY ts`)
      .all(id) as { id: string }[]
  ).map((row) => row.id);
  f.book.setStatus(one!, "doing");
  expect(status(f, id)).toEqual({ archived: 0, status: "doing" });
  f.book.setStatus(one!, "done");
  f.book.setStatus(two!, "done");
  expect(status(f, id)).toEqual({ archived: 0, status: "review" });
  // Someone asks for more: doing stays while the old round is still all done.
  f.book.setEpicStatus(id, "doing");
  expect(status(f, id)).toEqual({ archived: 0, status: "doing" });
  // A new task, then done again: review again.
  const three = f.book.addTask(id, "Três")!;
  f.book.setStatus(three, "done");
  expect(status(f, id)).toEqual({ archived: 0, status: "review" });
});

test('a person sending "Mark as done" marks the thread done; writing in a done thread opens it again (Gimenes #4249)', () => {
  const f = fixture();
  const id = f.book.createEpic("Trabalho", ["Um"]);
  f.book.addMessage(id, email, "Mark as done");
  f.book.personWrote(id, "Mark as done");
  expect(status(f, id)).toEqual({ archived: 1, status: "done" });
  f.book.addMessage(id, email, "faltou uma coisa");
  f.book.personWrote(id, "faltou uma coisa");
  expect(status(f, id)).toEqual({ archived: 0, status: "doing" });
  // Another message is just a message: it does not mark done.
  f.book.personWrote(id, "mark as done when the PR merges");
  expect(status(f, id)).toEqual({ archived: 0, status: "doing" });
});

test("the migration: archived or dismissed is done, open with nothing started is todo, the rest is review (Gimenes #4251)", () => {
  const f = fixture();
  const row = (
    id: string,
    archived: number | null,
    chosen: string | null,
    tasks: string[],
  ) => {
    f.db
      .query(
        `INSERT INTO epics (id, title, ts, archived, status) VALUES (?, ?, 1, ?, ?)`,
      )
      .run(id, id, archived, chosen);
    tasks.forEach((task, i) =>
      f.db
        .query(
          `INSERT INTO tasks (id, epic_id, title, ts, done, status) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(`${id}${i}`, id, task, i, task === "done" ? 1 : 0, task),
    );
  };
  row("arch", 1, null, ["done"]);
  row("dism", 1, "dismissed", ["todo"]);
  row("kept", -1, null, ["done"]);
  row("fresh", 0, null, ["todo"]);
  row("prod", 0, null, ["todo", "doing"]);
  row("alldone", null, null, ["done", "done"]);
  f.db.query(`DELETE FROM meta WHERE k = 'epic_status_v2'`).run();
  f.book.migrateEpicStatus();
  expect(status(f, "arch")).toEqual({ archived: 1, status: "done" });
  expect(status(f, "dism")).toEqual({ archived: 1, status: "done" });
  expect(status(f, "kept")).toEqual({ archived: 0, status: "review" });
  expect(status(f, "fresh")).toEqual({ archived: 0, status: "todo" });
  expect(status(f, "prod")).toEqual({ archived: 0, status: "review" });
  expect(status(f, "alldone")).toEqual({ archived: 0, status: "review" });
  // Once: a later change of status is not undone by the next start.
  f.book.setEpicStatus("alldone", "doing");
  f.book.migrateEpicStatus();
  f.book.autoReview();
  expect(status(f, "alldone")).toEqual({ archived: 0, status: "doing" });
});

test("an agent's delivery puts the thread in review, not done", async () => {
  const f = fixture();
  const id = f.book.createEpic("Trabalho", ["Um"]);
  await f.book.agentPost(
    "abcdef",
    email,
    "Pronto, testei.",
    id,
    [],
    "Claude",
    true,
  );
  expect(status(f, id)).toEqual({ archived: 0, status: "review" });
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

test("an answer epic that became work, or a question older than a day, is not held or nudged", async () => {
  const f = fixture();
  const { epic } = await question(f);
  f.db
    .query(
      `INSERT INTO tasks (id, epic_id, title, done, ts) VALUES ('t-extra', ?, 'Remover o botão', 0, 0)`,
    )
    .run(epic);
  expect(f.book.answerPending(epic)).toBe(false);
  const old = await question(f, "uma pergunta antiga sobre o perfil");
  const created = (
    f.db.query(`SELECT ts FROM epics WHERE id = ?`).get(old.epic) as {
      ts: number;
    }
  ).ts;
  f.book.nudgeUnanswered(created + 2 * 864e5);
  expect(
    f.db.query(`SELECT 1 FROM messages WHERE tag = 'reminder'`).all(),
  ).toEqual([]);
});
