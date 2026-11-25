// The thread bar renames an epic in place (epic.rename). Actual Book dispatcher and renameEpic with binding doubles.
import { expect, mock, test } from "bun:test";
import type { RoomCommand } from "../shared/commands";
import { encodeCall, RpcErrorCode } from "../shared/jsonRpc";
import { sendTo } from "./book-test-wire";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { Book } = await import("../src/book");
function fixture() {
  const titles = new Map([["known", "Antes"]]),
    frames: string[] = [];
  let notifications = 0;
  const receiver: Record<string, unknown> = {
    sendTo,
    epics: () => [...titles].map(([id, title]) => ({ id, title })),
    get: (key: string) => (key === "book_id" ? "aaaaaa" : null),
    ctx: {
      getTags: () => ["member@test"],
      waitUntil: () => {},
    },
    sql: {
      exec(sql: string, ...args: unknown[]) {
        if (sql.startsWith("UPDATE epics SET title"))
          titles.set(String(args[1]), String(args[0]));
        return { toArray: () => [] };
      },
    },
    // Every epic change goes out to the room's sockets (and the Inbox's D1 rows) from here.
    epicsChanged: () => {
      notifications++;
    },
  };
  receiver.renameEpic = (id: string, title: string): unknown =>
    Reflect.apply(Book.prototype.renameEpic, receiver, [id, title]);
  receiver.runCommand = (socket: object, email: string, input: RoomCommand) =>
    Reflect.apply(
      Reflect.get(Book.prototype, "runCommand") as Function,
      receiver,
      [socket, email, input],
    );
  const socket = { send: (frame: string) => frames.push(frame) };
  const send = (command: RoomCommand, id = "rename") =>
    Reflect.apply(Book.prototype.webSocketMessage, receiver, [
      socket,
      encodeCall(command, id),
    ]);
  return {
    titles,
    send,
    replies: () => frames.map((frame) => JSON.parse(frame)),
    notifications: () => notifications,
  };
}
test("epic.rename saves the trimmed title, tells the room once and answers ok", async () => {
  const h = fixture();
  await h.send({ t: "epic.rename", id: "known", title: "  Depois  " });
  expect(h.titles.get("known")).toBe("Depois");
  expect(h.notifications()).toBe(1);
  expect(h.replies()).toEqual([{ jsonrpc: "2.0", id: "rename", result: null }]);
});
test("epic.rename cuts a long title at 200 characters", async () => {
  const h = fixture();
  await h.send({ t: "epic.rename", id: "known", title: "x".repeat(300) });
  expect(h.titles.get("known")).toBe("x".repeat(200));
});
test("epic.rename refuses the main thread, an unknown epic and an empty title, and changes nothing", async () => {
  for (const [command, error] of [
    [{ t: "epic.rename", id: "main", title: "X" }, "unknown epic"],
    [{ t: "epic.rename", id: "missing", title: "X" }, "unknown epic"],
    [{ t: "epic.rename", id: "known", title: "   " }, "empty title"],
  ] as const) {
    const h = fixture();
    await h.send(command);
    expect(h.titles.get("known")).toBe("Antes");
    expect(h.notifications()).toBe(0);
    expect(h.replies()).toEqual([
      {
        jsonrpc: "2.0",
        id: "rename",
        error: { code: RpcErrorCode.REFUSED, message: error },
      },
    ]);
  }
});
