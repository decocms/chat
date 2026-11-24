// Every new thread starts from a message in the main thread (Gimenes #4123, #4126): the actual Book over an
// in-memory SQLite (bun:sqlite) standing in for the Durable Object's storage. D1, alarms and AI are fakes.
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
  return { book, run, messages, epic };
}

test("the sidebar's Nova thread writes the title in main and the thread starts from it; the same id again makes nothing", async () => {
  const f = fixture();
  expect(
    await f.run({ t: "epic", title: "Novo onboarding", id: "aaaa0001" }),
  ).toEqual({ ok: true });
  const [line] = f.messages();
  expect(line).toMatchObject({
    thread: "main",
    author: email,
    kind: null,
    text: "Novo onboarding",
  });
  expect(f.epic("aaaa0001")).toMatchObject({
    title: "Novo onboarding",
    owner: email,
    from_msg: line.id,
  });
  expect(
    await f.run({ t: "epic", title: "Novo onboarding", id: "aaaa0001" }),
  ).toEqual({ ok: true });
  expect(f.messages()).toHaveLength(1);
});

test("a thread from a message in main starts from that message, with no new line", async () => {
  const f = fixture();
  await f.run({ t: "msg", thread: "main", text: "vamos mudar o onboarding?" });
  const [source] = f.messages();
  expect(
    await f.run({
      t: "epic",
      title: "Onboarding",
      from: source.id,
      id: "aaaa0002",
    }),
  ).toEqual({ ok: true });
  expect(f.messages()).toHaveLength(1);
  expect(f.epic("aaaa0002")?.from_msg).toBe(source.id);
  expect(f.book.epics().find((e) => e.id === "aaaa0002")?.parent).toBeNull();
});

test("a thread from a message inside a thread starts from a new line in main that links it: no sub-thread", async () => {
  const f = fixture();
  await f.run({ t: "epic", title: "Pagamentos", id: "aaaa0003" });
  await f.run({ t: "msg", thread: "aaaa0003", text: "e o reembolso?" });
  const source = f.messages().find((m) => m.thread === "aaaa0003")!;
  expect(
    await f.run({
      t: "epic",
      title: "Reembolso",
      from: source.id,
      id: "aaaa0004",
    }),
  ).toEqual({ ok: true });
  const line = f.messages().at(-1)!;
  expect(line).toMatchObject({
    thread: "main",
    author: email,
    kind: null,
    reply_to: source.id,
  });
  expect(line.text).toBe("Nova thread a partir desta mensagem de “Pagamentos”");
  expect(f.epic("aaaa0004")?.from_msg).toBe(line.id);
  expect(f.book.epics().find((e) => e.id === "aaaa0004")?.parent).toBeNull();
  // The request's own thread is found through that line.
  expect(f.book.epicsFrom(source.id).map((e) => e.id)).toEqual(["aaaa0004"]);
});

test("a thread from an unknown message is refused", async () => {
  const f = fixture();
  expect(await f.run({ t: "epic", title: "X", from: 999 })).toEqual({
    ok: false,
    error: "unknown message",
  });
  expect(f.messages()).toHaveLength(0);
});

test("an agent's start_thread inside a thread: a line in main by the agent, and a sibling thread", async () => {
  const f = fixture();
  await f.run({ t: "epic", title: "Pagamentos", id: "aaaa0005" });
  await f.run({
    t: "msg",
    thread: "aaaa0005",
    text: "cria um épico pro reembolso",
  });
  const source = f.messages().find((m) => m.thread === "aaaa0005")!;
  const out = (await f.book.agentEpic(
    "abcdef",
    email,
    "Reembolso",
    "",
    ["Fazer"],
    "Claude Opus 5.5",
    source.id,
  )) as { ok: boolean; epic_id: string };
  expect(out.ok).toBe(true);
  const line = f.messages().at(-1)!;
  expect(line).toMatchObject({
    thread: "main",
    author: email,
    kind: "agent",
    via: "Claude Opus 5.5",
    reply_to: source.id,
  });
  expect(f.epic(out.epic_id)?.from_msg).toBe(line.id);
  expect(f.book.epics().find((e) => e.id === out.epic_id)?.parent).toBeNull();
});

test("an agent's start_thread with no request: its line in main is the thread's origin", async () => {
  const f = fixture();
  const out = (await f.book.agentEpic(
    "abcdef",
    email,
    "Limpeza",
    "",
    [],
    "Claude Opus 5.5",
  )) as { ok: boolean; epic_id: string };
  const line = f.messages().at(-1)!;
  expect(line).toMatchObject({ thread: "main", kind: "agent" });
  expect(line.text).toContain("Limpeza");
  expect(f.epic(out.epic_id)?.from_msg).toBe(line.id);
});
