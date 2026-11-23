// One send = one message (docs/architecture.md): the actual Book over an in-memory SQLite (bun:sqlite) standing in
// for the Durable Object's storage. D1, alarms and AI are fakes that only record calls.
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
const email = "member@example.test",
  room = "abcdef";

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
        return cursor(
          statement.all(...params) as Record<string, unknown>[],
          0,
        );
      return cursor([], statement.run(...params).changes);
    },
  };
  const tracked: string[] = [],
    frames: string[] = [];
  const ws = { readyState: 1, send: (frame: string) => frames.push(frame) };
  const statement = (query: string) => {
    const bound = (...values: unknown[]) => ({
      run: async () => {
        if (query.includes("INSERT INTO events")) tracked.push(String(values[0]));
        return { meta: { changes: 0 } };
      },
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
    { DB: { prepare: statement } } as unknown as ConstructorParameters<typeof Book>[1],
  );
  book.set("book_id", room);
  // What runs after an insert: counted, so a repeat can show that none of it ran again.
  const effects = { reopen: 0, intent: 0, wake: 0 };
  book.reopenIfArchived = () => void effects.reopen++;
  book.answerIntent = async () => void effects.intent++;
  book.wakeAt = async () => void effects.wake++;
  let rpc = 0;
  const send = async (command: Omit<Extract<RoomCommand, { t: "msg" }>, "t">) => {
    const id = `r-${++rpc}`;
    await book.webSocketMessage(
      ws as unknown as WebSocket,
      encodeCall({ t: "msg", ...command }, id),
    );
    const reply = frames
      .map((frame) => JSON.parse(frame) as { id?: string; result?: unknown; error?: { message: string } })
      .find((frame) => frame.id === id);
    if (!reply) throw Error("no reply");
    return reply.error ? { ok: false as const, error: reply.error.message } : { ok: true as const };
  };
  const rows = () =>
    db.query(`SELECT id, author, kind, text, client_id FROM messages ORDER BY id`).all() as {
      id: number;
      author: string;
      kind: string | null;
      text: string;
      client_id: string | null;
    }[];
  const pushes = () =>
    frames
      .map((frame) => JSON.parse(frame) as { method?: string; params?: { m: { id: number; client_id?: string } } })
      .filter((frame) => frame.method === "msg");
  return { book, db, send, rows, pushes, tracked, effects };
}
const id1 = "9b2f8c1e-0d5a-4c7b-8e3f-1a2b3c4d5e6f",
  id2 = "4e5d6c7b-8a9f-4012-b345-6789abcdef01";

test("the same client_id twice makes one message, one push and one round of side effects", async () => {
  const f = fixture();
  expect(await f.send({ thread: "main", text: "oi", client_id: id1 })).toEqual({ ok: true });
  const after = { ...f.effects, tracked: f.tracked.length };
  expect(await f.send({ thread: "main", text: "oi", client_id: id1 })).toEqual({ ok: true });
  expect(f.rows()).toHaveLength(1);
  expect(f.rows()[0].client_id).toBe(id1);
  // The first push went to every socket, carrying the client_id; the repeat goes to this tab only, with the same id.
  const pushes = f.pushes();
  expect(pushes).toHaveLength(2);
  expect(pushes[0].params?.m).toMatchObject({ id: f.rows()[0].id, client_id: id1 });
  expect(pushes[1].params?.m.id).toBe(f.rows()[0].id);
  expect({ ...f.effects, tracked: f.tracked.length }).toEqual(after);
  expect(f.effects).toEqual({ reopen: 1, intent: 1, wake: 1 });
});

test("the same client_id with another text is refused and stores nothing", async () => {
  const f = fixture();
  await f.send({ thread: "main", text: "oi", client_id: id1 });
  expect(await f.send({ thread: "main", text: "tchau", client_id: id1 })).toEqual({ ok: false, error: "idempotency conflict" });
  expect(f.rows().map((r) => r.text)).toEqual(["oi"]);
});

test("two client_ids with the same text are two messages", async () => {
  const f = fixture();
  await f.send({ thread: "main", text: "ok", client_id: id1 });
  await f.send({ thread: "main", text: "ok", client_id: id2 });
  expect(f.rows().map((r) => r.text)).toEqual(["ok", "ok"]);
});

test("a client_id that is not 8-64 characters of [A-Za-z0-9_-] is an invalid command", async () => {
  const f = fixture();
  for (const client_id of ["short", "x".repeat(65), "has space 123", "émoji-12345"])
    expect(await f.send({ thread: "main", text: "oi", client_id })).toEqual({ ok: false, error: "invalid command" });
  expect(f.rows()).toHaveLength(0);
});

test("without a client_id the same text within 10 s is one message, after 10 s two, and old clients are counted", async () => {
  const f = fixture();
  await f.send({ thread: "main", text: "oi" });
  await f.send({ thread: "main", text: "oi" });
  expect(f.rows()).toHaveLength(1);
  expect(f.tracked.filter((name) => name === "message_no_client_id")).toHaveLength(2);
  expect(f.tracked.filter((name) => name === "message")).toHaveLength(1);
  f.db.exec(`UPDATE messages SET ts = ts - 11000`);
  await f.send({ thread: "main", text: "oi" });
  expect(f.rows()).toHaveLength(2);
  // Another text, or another reply target, is never a repeat.
  await f.send({ thread: "main", text: "oi de novo" });
  await f.send({ thread: "main", text: "oi", reply_to: f.rows()[0].id });
  expect(f.rows()).toHaveLength(4);
});

test("the room's own posts and the server's posts in a person's name are never matched", async () => {
  const f = fixture();
  f.book.addMessage("main", "ai", "⏰ Lembrete", { tag: "reminder" });
  f.book.addMessage("main", "ai", "⏰ Lembrete", { tag: "reminder" });
  await f.book.humanPost(room, email, "primeira mensagem");
  await f.book.humanPost(room, email, "primeira mensagem");
  expect(f.rows()).toHaveLength(4);
  expect(f.tracked).not.toContain("message_no_client_id");
});

test("HTTP post: a repeat returns the first id; no client_id falls back to 10 s", async () => {
  const f = fixture();
  const a = await f.book.humanPost(room, email, "oi", "main", false, { clientId: id1 });
  const b = await f.book.humanPost(room, email, "oi", "main", false, { clientId: id1 });
  expect(a.ok && b.ok && a.id === b.id).toBe(true);
  expect(await f.book.humanPost(room, email, "outra", "main", false, { clientId: id1 })).toEqual({ ok: false, error: "idempotency conflict" });
  const c = await f.book.humanPost(room, email, "sem id", "main", false, {});
  const d = await f.book.humanPost(room, email, "sem id", "main", false, {});
  expect(c.ok && d.ok && c.id === d.id).toBe(true);
  expect(f.rows()).toHaveLength(2);
});

test("MCP post: a retry with the same client_id returns the first id; the agent's and its person's ids don't mix", async () => {
  const f = fixture();
  const a = await f.book.agentPost(room, email, "feito", "main", [], "Claude", false, false, undefined, undefined, undefined, "agent-1", id1);
  const b = await f.book.agentPost(room, email, "feito", "", [], "Claude", false, false, undefined, undefined, undefined, "agent-1", id1);
  expect(a).toMatchObject({ ok: true });
  expect(b).toEqual({ ok: true, id: (a as { id: number }).id });
  expect(await f.book.agentPost(room, email, "outro", "main", [], "Claude", false, false, undefined, undefined, undefined, "agent-1", id1)).toMatchObject({ ok: false });
  expect(await f.book.agentPost(room, email, "feito", "main", [], "Claude", false, false, undefined, undefined, undefined, "agent-1", "bad id")).toMatchObject({ ok: false });
  // The person typing the same text right after their agent is their own message.
  await f.send({ thread: "main", text: "feito" });
  expect(f.rows().map((r) => [r.kind, r.text])).toEqual([
    ["agent", "feito"],
    [null, "feito"],
  ]);
  // An old client (no client_id) repeating within 10 s gets the first post back.
  const c = await f.book.agentPost(room, email, "sem id", "main");
  const d = await f.book.agentPost(room, email, "sem id", "main");
  expect(c).toEqual(d);
  expect(f.rows()).toHaveLength(3);
});
