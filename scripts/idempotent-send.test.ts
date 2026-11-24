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
        return cursor(statement.all(...params) as Record<string, unknown>[], 0);
      return cursor([], statement.run(...params).changes);
    },
  };
  const tracked: string[] = [],
    frames: string[] = [],
    peerFrames: string[] = [];
  // ws: the tab that sends; peer: another open tab of the room.
  const ws = { readyState: 1, send: (frame: string) => frames.push(frame) };
  const peer = {
    readyState: 1,
    send: (frame: string) => peerFrames.push(frame),
  };
  const statement = (query: string) => {
    const bound = (...values: unknown[]) => ({
      run: async () => {
        if (query.includes("INSERT INTO events"))
          tracked.push(String(values[0]));
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
    getWebSockets: () => [ws, peer],
    getTags: () => [email],
    blockConcurrencyWhile: (fn: () => unknown) => fn(),
  };
  const book = new Book(
    ctx as unknown as ConstructorParameters<typeof Book>[0],
    { DB: { prepare: statement } } as unknown as ConstructorParameters<
      typeof Book
    >[1],
  );
  book.set("book_id", room);
  // What runs after an insert: counted, so a repeat can show that none of it ran again.
  const effects = { reopen: 0, intent: 0, wake: 0 };
  book.reopenIfDone = () => void effects.reopen++;
  book.routerActions = async () => {
    effects.intent++;
    return { action: null, via: null, p: 0, cost: 0, asked: [], read: {} };
  };
  book.wakeAt = async () => void effects.wake++;
  let rpc = 0;
  const send = async (
    command: Omit<Extract<RoomCommand, { t: "msg" }>, "t">,
  ) => {
    const id = `r-${++rpc}`;
    await book.webSocketMessage(
      ws as unknown as WebSocket,
      encodeCall({ t: "msg", ...command }, id),
    );
    const reply = frames
      .map(
        (frame) =>
          JSON.parse(frame) as {
            id?: string;
            result?: unknown;
            error?: { message: string };
          },
      )
      .find((frame) => frame.id === id);
    if (!reply) throw Error("no reply");
    return reply.error
      ? { ok: false as const, error: reply.error.message }
      : { ok: true as const };
  };
  const rows = () =>
    db
      .query(
        `SELECT id, author, kind, text, client_id FROM messages ORDER BY id`,
      )
      .all() as {
      id: number;
      author: string;
      kind: string | null;
      text: string;
      client_id: string | null;
    }[];
  const pushes = (of = frames) =>
    of
      .map(
        (frame) =>
          JSON.parse(frame) as {
            method?: string;
            params?: { m: { id: number; client_id?: string } };
          },
      )
      .filter((frame) => frame.method === "msg");
  return { book, db, send, rows, pushes, tracked, effects, peerFrames };
}
const id1 = "9b2f8c1e-0d5a-4c7b-8e3f-1a2b3c4d5e6f",
  id2 = "4e5d6c7b-8a9f-4012-b345-6789abcdef01";

test("the same client_id twice makes one message, one push and one round of side effects", async () => {
  const f = fixture();
  expect(await f.send({ thread: "main", text: "oi", client_id: id1 })).toEqual({
    ok: true,
  });
  const after = { ...f.effects, tracked: f.tracked.length };
  expect(await f.send({ thread: "main", text: "oi", client_id: id1 })).toEqual({
    ok: true,
  });
  expect(f.rows()).toHaveLength(1);
  expect(f.rows()[0].client_id).toBe(id1);
  // The first push went to every socket, carrying the client_id; the repeat goes to the sending tab only.
  const pushes = f.pushes();
  expect(pushes).toHaveLength(2);
  expect(pushes[0].params?.m).toMatchObject({
    id: f.rows()[0].id,
    client_id: id1,
  });
  expect(pushes[1].params?.m.id).toBe(f.rows()[0].id);
  expect(f.pushes(f.peerFrames).map((push) => push.params?.m.id)).toEqual([
    f.rows()[0].id,
  ]);
  expect({ ...f.effects, tracked: f.tracked.length }).toEqual(after);
  expect(f.effects).toEqual({ reopen: 1, intent: 1, wake: 1 });
});

test("the same client_id with another text is refused and stores nothing", async () => {
  const f = fixture();
  await f.send({ thread: "main", text: "oi", client_id: id1 });
  expect(
    await f.send({ thread: "main", text: "tchau", client_id: id1 }),
  ).toEqual({ ok: false, error: "idempotency conflict" });
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
  for (const client_id of [
    "short",
    "x".repeat(65),
    "has space 123",
    "émoji-12345",
  ])
    expect(await f.send({ thread: "main", text: "oi", client_id })).toEqual({
      ok: false,
      error: "invalid command",
    });
  expect(f.rows()).toHaveLength(0);
});

test("without a client_id the same text within 10 s is one message, after 10 s two, and old clients are counted", async () => {
  const f = fixture();
  await f.send({ thread: "main", text: "oi" });
  await f.send({ thread: "main", text: "oi" });
  expect(f.rows()).toHaveLength(1);
  expect(
    f.tracked.filter((name) => name === "message_no_client_id"),
  ).toHaveLength(2);
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
  const a = await f.book.humanPost(room, email, "oi", "main", false, {
    clientId: id1,
  });
  const b = await f.book.humanPost(room, email, "oi", "main", false, {
    clientId: id1,
  });
  expect(a.ok && b.ok && a.id === b.id).toBe(true);
  expect(
    await f.book.humanPost(room, email, "outra", "main", false, {
      clientId: id1,
    }),
  ).toEqual({ ok: false, error: "idempotency conflict" });
  const c = await f.book.humanPost(room, email, "sem id", "main", false, {});
  const d = await f.book.humanPost(room, email, "sem id", "main", false, {});
  expect(c.ok && d.ok && c.id === d.id).toBe(true);
  expect(f.rows()).toHaveLength(2);
});

test("MCP post: a retry with the same client key returns the first id, marked as a repeat", async () => {
  const f = fixture();
  const key = `agent-1:${id1}`;
  const a = await f.book.agentPost(
    room,
    email,
    "feito",
    "main",
    [],
    "Claude",
    false,
    false,
    undefined,
    undefined,
    undefined,
    "agent-1",
    key,
  );
  const b = await f.book.agentPost(
    room,
    email,
    "feito",
    "",
    [],
    "Claude",
    false,
    false,
    undefined,
    undefined,
    undefined,
    "agent-1",
    key,
  );
  expect(a).toMatchObject({ ok: true });
  expect(b).toEqual({ ok: true, id: (a as { id: number }).id, repeat: true });
  expect(
    await f.book.agentPost(
      room,
      email,
      "outro",
      "main",
      [],
      "Claude",
      false,
      false,
      undefined,
      undefined,
      undefined,
      "agent-1",
      key,
    ),
  ).toMatchObject({ ok: false });
  // The person typing the same text right after their agent is their own message.
  await f.send({ thread: "main", text: "feito" });
  expect(f.rows().map((r) => [r.kind, r.text])).toEqual([
    ["agent", "feito"],
    [null, "feito"],
  ]);
  // An old client (no client_id) repeating within 10 s gets the first post back.
  const c = await f.book.agentPost(room, email, "sem id", "main");
  const d = await f.book.agentPost(room, email, "sem id", "main");
  expect(d).toEqual({ ok: true, id: (c as { id: number }).id, repeat: true });
  expect(f.rows()).toHaveLength(3);
});

test("a retry with a client_id matches after 10 s too", async () => {
  const f = fixture();
  await f.send({ thread: "main", text: "oi", client_id: id1 });
  f.db.exec(`UPDATE messages SET ts = ts - 3600000`);
  expect(await f.send({ thread: "main", text: "oi", client_id: id1 })).toEqual({
    ok: true,
  });
  expect(f.rows()).toHaveLength(1);
});

test("a retry after closeAsk or move_message returns the first message, not a conflict", async () => {
  const f = fixture();
  f.db.exec(`INSERT INTO epics (id, title, ts) VALUES ('e1', 'Epic', 1)`);
  const key = `agent-1:${id1}`;
  const ask = await f.book.agentPost(
    room,
    email,
    "⏸ Seu Claude pede permissão: **Bash**",
    "main",
    [],
    "Claude",
    false,
    false,
    undefined,
    { options: ["Aprovar", "Negar"], multi: false },
    undefined,
    "agent-1",
    key,
  );
  if (!ask.ok || !("id" in ask) || !ask.id) throw Error("no ask");
  expect(f.book.closeAsk(room, ask.id, email)).toEqual({ ok: true });
  expect(
    await f.book.agentPost(
      room,
      email,
      "⏸ Seu Claude pede permissão: **Bash**",
      "",
      [],
      "Claude",
      false,
      false,
      undefined,
      { options: ["Aprovar", "Negar"], multi: false },
      undefined,
      "agent-1",
      key,
    ),
  ).toEqual({ ok: true, id: ask.id, repeat: true });
  await f.send({ thread: "main", text: "move isso", client_id: id2 });
  const moved = f.rows().at(-1)!.id;
  expect(
    await f.book.agentEdit(room, email, "move_message", {
      message_id: moved,
      thread: "e1",
    }),
  ).toEqual({ ok: true });
  expect(
    await f.send({ thread: "main", text: "move isso", client_id: id2 }),
  ).toEqual({ ok: true });
  expect(f.rows()).toHaveLength(2);
});

test("two agents of one person with the same client_id make two messages", async () => {
  const f = fixture();
  await f.book.agentPost(
    room,
    email,
    "pronto",
    "main",
    [],
    "Claude",
    false,
    false,
    undefined,
    undefined,
    undefined,
    "agent-1",
    `agent-1:${id1}`,
  );
  await f.book.agentPost(
    room,
    email,
    "pronto",
    "main",
    [],
    "Claude",
    false,
    false,
    undefined,
    undefined,
    undefined,
    "agent-2",
    `agent-2:${id1}`,
  );
  expect(f.rows().map((r) => r.client_id)).toEqual([
    `agent-1:${id1}`,
    `agent-2:${id1}`,
  ]);
});

test("the fallback skips a done post, and posts of another model", async () => {
  const f = fixture();
  await f.book.agentPost(room, email, "publiquei", "main", [], "Claude");
  await f.book.agentPost(room, email, "publiquei", "main", [], "Claude", true);
  await f.book.agentPost(room, email, "publiquei", "main", [], "Codex");
  expect(f.rows()).toHaveLength(3);
});

test("an html retry: the room answers before any check or file, with the first post", async () => {
  const f = fixture();
  f.db.exec(
    `INSERT INTO files (id, name, type, size, author, ts) VALUES ('ff11', 'embed.html', 'text/html', 10, '${email}', 1)`,
  );
  const key = `agent-1:${id1}`;
  const first = await f.book.agentPost(
    room,
    email,
    "gráfico",
    "main",
    ["ff11"],
    "Claude",
    false,
    true,
    undefined,
    undefined,
    undefined,
    "agent-1",
    key,
  );
  if (!first.ok || !("id" in first) || !first.id) throw Error("not posted");
  // src/agent.ts asks agentRepeat before checkEmbed and storeFile; a repeat returns here, with no new file.
  expect(f.book.agentRepeat(room, email, key, " gráfico ")).toEqual({
    ok: true,
    id: first.id,
    repeat: true,
  });
  expect(
    f.book.agentRepeat(room, email, `agent-1:${id2}`, "gráfico"),
  ).toBeNull();
  expect(f.book.agentRepeat(room, email, key, "outro")).toMatchObject({
    ok: false,
  });
  expect(f.db.query(`SELECT count(*) AS n FROM files`).get()).toEqual({ n: 1 });
});

test("the agent's read cursor never moves back", async () => {
  const { keepCaughtUp } = await import("../src/agent");
  const db = new Database(":memory:");
  db.exec(
    `CREATE TABLE agent_reads (agent TEXT, book_id TEXT, last_id INTEGER)`,
  );
  db.exec(`INSERT INTO agent_reads VALUES ('agent-1', '${room}', 41)`);
  const d1 = {
    prepare: (query: string) => ({
      bind: (...values: (string | number)[]) => ({
        run: async () => db.query(query).run(...values),
      }),
    }),
  };
  const cursor = () =>
    (db.query(`SELECT last_id FROM agent_reads`).get() as { last_id: number })
      .last_id;
  await keepCaughtUp(
    d1 as unknown as Parameters<typeof keepCaughtUp>[0],
    "agent-1",
    room,
    42,
  );
  expect(cursor()).toBe(42);
  await keepCaughtUp(
    d1 as unknown as Parameters<typeof keepCaughtUp>[0],
    "agent-1",
    room,
    7,
  );
  expect(cursor()).toBe(42);
});
