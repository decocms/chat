// The room sidebar's bold thread names (Valls): per person and thread, the newest message they saw there
// (Book.unreadThreads). A message from someone else in a thread you do not look at makes it unread; opening the thread
// ("thread.open") reads it; what arrives in the thread your tab shows is read; your own message never counts. The
// actual Book over in-memory SQLite, with fake sockets that keep their attachment like a hibernatable one.
import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import { encodeCall } from "../shared/jsonRpc";
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

type FakeSocket = {
  tags: string[];
  attachment: unknown;
  readyState: number;
  send: () => void;
  serializeAttachment: (value: unknown) => void;
  deserializeAttachment: () => unknown;
};
function socket(email: string, thread?: string): FakeSocket {
  const ws: FakeSocket = {
    tags: [email],
    attachment: thread ? { thread } : null,
    readyState: WebSocket.OPEN,
    send: () => {},
    serializeAttachment: (value) => (ws.attachment = value),
    deserializeAttachment: () => ws.attachment,
  };
  return ws;
}

function fixture() {
  const room = new Database(":memory:");
  const sql = {
    exec(query: string, ...params: (string | number | null)[]) {
      const text = query.trim();
      if (!params.length && /;\s*\S/.test(text)) {
        room.exec(text);
        return { toArray: () => [], one: () => ({}), rowsWritten: 0, [Symbol.iterator]: () => [][Symbol.iterator]() };
      }
      const statement = room.query(text);
      const rows = statement.columnNames.length ? (statement.all(...params) as Record<string, unknown>[]) : (statement.run(...params), []);
      return { toArray: () => rows, one: () => rows[0], rowsWritten: 0, [Symbol.iterator]: () => rows[Symbol.iterator]() };
    },
  };
  const sockets: FakeSocket[] = [];
  const ctx = {
    storage: { sql, getAlarm: async () => null, setAlarm: async () => {} },
    waitUntil: (p: unknown) => void Promise.resolve(p).catch(() => {}),
    getWebSockets: () => sockets,
    getTags: (ws: FakeSocket) => ws.tags,
    blockConcurrencyWhile: (fn: () => unknown) => fn(),
  };
  const none = { prepare: () => ({ bind: () => none.prepare(), run: async () => ({ meta: { changes: 0 } }), first: async () => null, all: async () => ({ results: [] }) }), batch: async () => [] };
  const book = new Book(ctx as unknown as ConstructorParameters<typeof Book>[0], { DB: none } as unknown as ConstructorParameters<typeof Book>[1]);
  book.set("book_id", "room01");
  book.wakeAt = async () => {};
  book.sql.exec(`INSERT INTO epics (id, title, ts) VALUES ('e1', 'Ship it', 1), ('e2', 'Design', 2)`);
  const say = (thread: string, author: string, text = "oi", extra: Parameters<typeof book.addMessage>[3] = {}) => book.addMessage(thread, author, text, extra);
  const command = (ws: FakeSocket, value: Parameters<typeof encodeCall>[0]) =>
    book.webSocketMessage(ws as unknown as WebSocket, encodeCall(value));
  return { book, sockets, say, command };
}

test("a message in another thread makes it unread; opening it reads it", async () => {
  const f = fixture();
  f.say("main", other, "antes");
  // Seen for the first time: nothing from before is new to you.
  expect(f.book.unreadThreads(voce, "main")).toEqual([]);
  const tab = socket(voce, "main");
  f.sockets.push(tab);
  f.say("e1", other, "pronto pra revisar");
  expect(f.book.unreadThreads(voce, "main")).toEqual(["e1"]);
  // Someone else's read point is theirs: the author has read their own thread.
  expect(f.book.unreadThreads(other, "main")).toEqual([]);
  await f.command(tab, { t: "thread.open", thread: "e1" });
  expect(f.book.unreadThreads(voce, "e1")).toEqual([]);
  expect(f.book.unreadThreads(voce, "main")).toEqual([]);
});

test("what arrives in the thread your tab shows is read; your own message never counts", () => {
  const f = fixture();
  f.book.unreadThreads(voce, "main");
  f.sockets.push(socket(voce, "e2"));
  f.say("e2", other, "olha isso");
  f.say("e1", voce, "eu mesmo");
  expect(f.book.unreadThreads(voce, "main")).toEqual([]);
  // Your own Claude's line counts, like the room's unread dot.
  f.say("e1", voce, "Feito.", { kind: "agent" });
  expect(f.book.unreadThreads(voce, "main")).toEqual(["e1"]);
});

test("quiet lines, someone else's reminder and a Home Inbox peek leave a thread as it was", async () => {
  const f = fixture();
  f.book.unreadThreads(voce, "main");
  f.say("e1", "ai", "⚠ caiu", { tag: "issue", quiet: true });
  f.say("e2", "ai", "lembrete", { forWho: other });
  expect(f.book.unreadThreads(voce, "main")).toEqual([]);
  f.say("e2", other, "e aí?");
  const peek = socket(voce);
  peek.tags = [voce, "peek"];
  f.sockets.push(peek);
  await f.command(peek, { t: "thread.open", thread: "e2" });
  expect(f.book.unreadThreads(voce, "main")).toEqual(["e2"]);
});
