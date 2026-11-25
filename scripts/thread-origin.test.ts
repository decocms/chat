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
  const acks = () =>
    db.query(`SELECT msg_id, agent, status FROM acks`).all() as {
      msg_id: number;
      agent: string;
      status: string;
    }[];
  const ageAcks = (ms: number) =>
    db.query(`UPDATE acks SET ts = ts - ?`).run(ms);
  return { book, run, messages, epic, acks, ageAcks };
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

test("a thread made from someone else's message is theirs, a retry still works, and @vibe's goes to the maker (Gimenes #4594)", async () => {
  const f = fixture();
  const gui = "gui@example.test";
  const theirs = f.book.addMessage("main", gui, "e se a gente mudar o inbox?");
  expect(
    await f.run({ t: "epic", title: "Inbox", from: theirs.id, id: "aaaa0010" }),
  ).toEqual({ ok: true });
  expect(f.epic("aaaa0010")?.owner).toBe(gui);
  // The same click again (a lost answer) is not refused.
  expect(
    await f.run({ t: "epic", title: "Inbox", from: theirs.id, id: "aaaa0010" }),
  ).toEqual({ ok: true });
  const vibe = f.book.addMessage("main", "ai", "lembrete: revisar o PR");
  await f.run({ t: "epic", title: "Revisar", from: vibe.id, id: "aaaa0011" });
  expect(f.epic("aaaa0011")?.owner).toBe(email);
});

test("start_epic with no from_message_id never quotes an unrelated message: it starts from its own title and why", async () => {
  const f = fixture();
  const other = "other@example.test";
  // Recent, unrelated messages: the human's own in main and in a thread, and someone else's.
  await f.run({ t: "epic", title: "Pagamentos", id: "aaaa0020" });
  f.book.addMessage("main", email, "alguém viu o deploy de ontem?");
  f.book.addMessage("aaaa0020", email, "e o reembolso?");
  f.book.addMessage("main", other, "almoço às 13h?");
  const before = f.messages().map((m) => m.id);
  const out = (await f.book.agentEpic(
    "abcdef",
    email,
    "Card de app mais bonito",
    "O card de app no chat fica mais legível.",
    ["Ajustar o card"],
    "Claude Opus 5.5",
    undefined,
    "agent-1",
  )) as { ok: boolean; epic_id: string };
  expect(out.ok).toBe(true);
  const line = f.messages().at(-1)!;
  expect(before).not.toContain(line.id);
  expect(line).toMatchObject({
    thread: "main",
    author: email,
    kind: "agent",
    reply_to: null,
    text: "**Card de app mais bonito**\n\nO card de app no chat fica mais legível.",
  });
  expect(f.epic(out.epic_id)?.from_msg).toBe(line.id);
  // Nothing unrelated is marked as taken by the agent.
  expect(f.acks()).toEqual([]);
});

test("start_epic with from_message_id starts from that message and takes it", async () => {
  const f = fixture();
  const source = f.book.addMessage(
    "main",
    email,
    "deixa o card de app mais bonito",
  );
  f.book.addMessage("main", email, "outra coisa depois");
  const out = (await f.book.agentEpic(
    "abcdef",
    email,
    "Card de app",
    "",
    ["Ajustar"],
    "Claude Opus 5.5",
    source.id,
    "agent-1",
  )) as { ok: boolean; epic_id: string };
  expect(out.ok).toBe(true);
  expect(f.epic(out.epic_id)?.from_msg).toBe(source.id);
  expect(f.acks()).toEqual([
    { msg_id: source.id, agent: "agent-1", status: "doing" },
  ]);
});

test("start_epic right after acking a request takes that request's thread; an old ack is not the request", async () => {
  const f = fixture();
  const request = f.book.addMessage(
    "main",
    email,
    "melhora o card de app no chat",
  );
  f.book.agentAck("abcdef", "agent-1", email, "Claude Opus 5.5", request.id);
  f.book.addMessage("main", email, "e o deploy?");
  const out = (await f.book.agentEpic(
    "abcdef",
    email,
    "Card de app",
    "",
    ["Ajustar"],
    "Claude Opus 5.5",
    undefined,
    "agent-1",
  )) as { ok: boolean; epic_id: string };
  expect(f.epic(out.epic_id)?.from_msg).toBe(request.id);
  expect(f.book.epicsFrom(request.id).map((e) => e.id)).toEqual([out.epic_id]);

  // Later, an ack older than a few minutes: the next thread with no from_message_id has its own line.
  const g = fixture();
  const old = g.book.addMessage("main", email, "melhora o card de app no chat");
  g.book.agentAck("abcdef", "agent-1", email, "Claude Opus 5.5", old.id);
  g.ageAcks(60 * 60_000);
  const later = (await g.book.agentEpic(
    "abcdef",
    email,
    "Limpeza",
    "",
    [],
    "Claude Opus 5.5",
    undefined,
    "agent-1",
  )) as { ok: boolean; epic_id: string };
  const line = g.messages().at(-1)!;
  expect(line).toMatchObject({
    thread: "main",
    kind: "agent",
    reply_to: null,
    text: "**Limpeza**",
  });
  expect(g.epic(later.epic_id)?.from_msg).toBe(line.id);
});

test("one thread per message (Gimenes #5068): a second create is refused, and start_epic returns the thread it has", async () => {
  const f = fixture();
  const gui = "gui@example.test";
  const ask = f.book.addMessage("main", gui, "dá pra limpar as threads?");
  expect(
    await f.run({ t: "epic", title: "Limpar", from: ask.id, id: "aaaa0030" }),
  ).toEqual({ ok: true });
  // Someone else clicks "Criar thread" on the same message with a new id.
  expect(
    await f.run({ t: "epic", title: "Limpar 2", from: ask.id, id: "aaaa0031" }),
  ).toEqual({ ok: false, error: "this message already has a thread" });
  // An agent asked to start a thread from it gets the same one back, with its new task.
  const out = (await f.book.agentEpic(
    "abcdef",
    email,
    "Outra thread",
    "",
    ["Apagar as duplicadas"],
    "Claude Opus 5.5",
    ask.id,
  )) as { ok: boolean; epic_id: string; note?: string };
  expect(out.ok).toBe(true);
  expect(out.epic_id).toBe("aaaa0030");
  expect(out.note).toContain("aaaa0030");
  expect(
    f.book.epics().find((e) => e.id === "aaaa0030")?.tasks.map((t) => t.title),
  ).toContain("Apagar as duplicadas");
  expect(f.book.epics().filter((e) => e.from_msg === ask.id)).toHaveLength(1);
});
