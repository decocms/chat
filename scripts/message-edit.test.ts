// Edit and delete messages (Gui #4276, #4312): who may do what, and only the room owner ever gets the old text.
// The actual Book over an in-memory SQLite (bun:sqlite) standing in for the Durable Object's storage; D1 is a fake.
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
const owner = "owner@example.test";
const other = "other@example.test";

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
  // D1 is a fake; the values bound to each statement are kept, so a test can see what was written.
  const d1: { query: string; values: unknown[] }[] = [];
  const statement = (query: string) => {
    const bound = (...values: unknown[]) => {
      d1.push({ query, values });
      return {
        run: async () => ({ meta: { changes: 0 } }),
        first: async () => null,
        all: async () => ({ results: [] }),
      };
    };
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
  book.members = async () => [email, owner, other];
  book.isOwner = async (who: string) => who === owner;
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
  return { book, run, db, frames, d1 };
}
const row = (db: Database, id: number) =>
  db
    .query(`SELECT text, files, edited, deleted FROM messages WHERE id = ?`)
    .get(id) as {
    text: string;
    files: string | null;
    edited: number | null;
    deleted: number | null;
  };

test("the author edits; nobody else does, and the edit is filtered for secrets", async () => {
  const { book, run, db, frames } = fixture();
  const id = book.addMessage("main", email, "first draft").id;
  expect(
    await book.changeMessage(id, { email: other, agent: false }, "hijack"),
  ).toMatchObject({ ok: false });
  expect(
    await book.changeMessage(id, { email: owner, agent: false }, "owner edit"),
  ).toMatchObject({ ok: false });
  // The author's own agent did not post it, so it cannot edit it either.
  expect(
    await book.changeMessage(id, { email, agent: true }, "agent edit"),
  ).toMatchObject({ ok: false });
  expect(
    await book.changeMessage(
      id,
      { email, agent: false },
      "AKIAIOSFODNN7EXAMPLE",
    ),
  ).toMatchObject({ ok: false });
  frames.length = 0;
  expect(await run({ t: "msg.edit", id, text: "final text" })).toEqual({
    ok: true,
  });
  expect(row(db, id)).toMatchObject({ text: "final text", deleted: null });
  expect(row(db, id).edited).toBeGreaterThan(0);
  // What everyone receives carries the new text only.
  expect(frames.join("\n")).not.toContain("first draft");
});

test("an agent edits and deletes only what it posted", async () => {
  const { book, db } = fixture();
  const id = book.addMessage("main", email, "agent said", { kind: "agent" }).id;
  expect(
    await book.changeMessage(id, { email, agent: false }, "human edit"),
  ).toMatchObject({ ok: false });
  expect(
    await book.agentChangeMessage("abcdef", email, id, "agent fixed"),
  ).toEqual({ ok: true });
  expect(
    await book.agentChangeMessage("abcdef", other, id, null),
  ).toMatchObject({ ok: false });
  expect(await book.agentChangeMessage("abcdef", email, id, null)).toEqual({
    ok: true,
  });
  expect(row(db, id).deleted).toBeGreaterThan(0);
});

test("the author or the room owner deletes; the content goes to the owner only", async () => {
  const { book, db, frames } = fixture();
  const a = book.addMessage("main", email, "secret client data").id;
  const b = book.addMessage("main", email, "another one").id;
  expect(
    await book.changeMessage(a, { email: other, agent: false }, null),
  ).toMatchObject({ ok: false });
  frames.length = 0;
  expect(
    await book.changeMessage(a, { email: owner, agent: false }, null),
  ).toEqual({ ok: true });
  expect(await book.changeMessage(b, { email, agent: false }, null)).toEqual({
    ok: true,
  });
  expect(row(db, a)).toMatchObject({ text: "", files: null });
  expect(frames.join("\n")).not.toContain("secret client data");
  // A deleted message is not edited back to life.
  expect(
    await book.changeMessage(a, { email, agent: false }, "back"),
  ).toMatchObject({ ok: false });
  expect(await book.messageHistory(a, other)).toBeNull();
  expect(await book.messageHistory(a, email)).toBeNull();
  expect(await book.messageHistory(a, owner)).toEqual([
    expect.objectContaining({
      kind: "delete",
      text: "secret client data",
      by: owner,
    }),
  ]);
  // Agents read a tombstone, never the old text.
  const read = JSON.stringify(await book.agentRead("abcdef", 0, other));
  expect(read).not.toContain("secret client data");
  expect(read).toContain("[message deleted]");
});

test("a message that a thread started from is not deleted, by its author, the owner or an agent (Gimenes #4621)", async () => {
  const { book, run, db } = fixture();
  const id = book.addMessage("main", email, "vamos fazer X").id;
  const own = book.addMessage("main", email, "done", { kind: "agent" }).id;
  db.query(
    `INSERT INTO epics (id, title, ts, from_msg) VALUES ('t1', 'X', 1, ?), ('t2', 'Y', 1, ?)`,
  ).run(id, own);
  expect(await run({ t: "msg.delete", id })).toMatchObject({ ok: false });
  expect(
    await book.changeMessage(id, { email: owner, agent: false }, null),
  ).toMatchObject({ ok: false });
  expect(
    await book.agentChangeMessage("abcdef", email, own, null),
  ).toMatchObject({ ok: false });
  expect(row(db, id).deleted).toBeNull();
  expect(row(db, own).deleted).toBeNull();
  // Editing it still works.
  expect(await run({ t: "msg.edit", id, text: "vamos fazer X e Y" })).toEqual({
    ok: true,
  });
});

test("a deleted message's files leave the room for everyone but the owner (#4383)", async () => {
  const { book, db } = fixture();
  const fid = "0abc1234";
  db.query(
    `INSERT INTO files (id, name, type, size, author, ts) VALUES (?, 'leak.txt', 'text/plain', 5, ?, 1)`,
  ).run(fid, email);
  const id = book.addMessage("main", email, "see file").id;
  db.query(`UPDATE messages SET files = ? WHERE id = ?`).run(
    JSON.stringify([{ id: fid, name: "leak.txt" }]),
    id,
  );
  expect(await book.fileHidden("abcdef", fid, other)).toBe(false);
  expect(await book.changeMessage(id, { email, agent: false }, null)).toEqual({
    ok: true,
  });
  expect(await book.fileHidden("abcdef", fid, other)).toBe(true);
  expect(await book.fileHidden("abcdef", fid, email)).toBe(true);
  expect(await book.fileHidden("abcdef", fid, owner)).toBe(false);
  expect(book.files().map((f) => f.id)).not.toContain(fid);
});

test("an ask you reacted to before the router read it does not wait on you (Gimenes #4604)", async () => {
  const { book, run, d1 } = fixture();
  const ask = book.addMessage("main", owner, "posso subir hoje?").id;
  // You react while the router (an LLM call) is still reading the message.
  expect(await run({ t: "react", id: ask, emoji: "👍" })).toEqual({ ok: true });
  d1.length = 0;
  // Then the router says the ask waits on you and on someone who did nothing.
  await book.saveWaits(ask, [email, other]);
  const waits = d1.filter(
    (x) => x.values.length && x.query.includes("INSERT OR IGNORE INTO waits"),
  );
  expect(waits.map((x) => x.values[2])).toEqual([other]);
});
