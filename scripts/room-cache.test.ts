// The rooms saved in IndexedDB (cache plan PR 3): the store over a small in-memory IndexedDB, and the room session
// that draws a saved room first and resumes its socket from it.
import { expect, test } from "bun:test";
import type { Room } from "../shared/room";
import { createRoomCache, savedRoom } from "../web/features/room-cache/store";
import { createRootRoomSession } from "../web/features/root-room/session";
import type { RoomConnectionOptions } from "../web/app/roomConnection";

/** The part of IndexedDB the store uses: one database, one store by keyPath "id", async callbacks. */
function fakeIndexedDb() {
  const rows = new Map<string, unknown>();
  const later = (fn: () => void) => queueMicrotask(fn);
  // One transaction: it completes after its last request (a cursor counts until it ends).
  const store = (done: () => void) => {
    let open = 0;
    const settle = () => {
      if (--open === 0) later(done);
    };
    const track = <T>(fn: () => T) => {
      open++;
      const r: { result?: T } = {};
      later(() => {
        r.result = fn();
        settle();
      });
      return r;
    };
    return {
      get: (id: string) => track(() => rows.get(id)),
      put: (row: { id: string }) =>
        track(() => void rows.set(row.id, structuredClone(row))),
      delete: (id: string) => track(() => void rows.delete(id)),
      clear: () => track(() => rows.clear()),
      openCursor: () => {
        const ids = [...rows.keys()];
        let i = 0;
        const cursor: { result: unknown; onsuccess?: () => void } = {
          result: null,
        };
        open++;
        const step = () =>
          later(() => {
            const id = ids[i++];
            cursor.result =
              id === undefined
                ? null
                : {
                    value: rows.get(id),
                    delete: () => rows.delete(id),
                    continue: step,
                  };
            cursor.onsuccess?.();
            if (id === undefined) settle();
          });
        step();
        return cursor;
      },
    };
  };
  const db = {
    createObjectStore: () => ({}),
    transaction: () => {
      const tx: {
        oncomplete?: () => void;
        onerror?: () => void;
        onabort?: () => void;
        objectStore: () => unknown;
      } = {
        objectStore: () => objectStore,
      };
      const objectStore = store(() => tx.oncomplete?.());
      return tx;
    },
  };
  return {
    rows,
    idb: {
      open: () => {
        const r: {
          result: unknown;
          onupgradeneeded?: () => void;
          onsuccess?: () => void;
        } = { result: db };
        later(() => {
          r.onupgradeneeded?.();
          r.onsuccess?.();
        });
        return r;
      },
    } as unknown as IDBFactory,
  };
}
const room = (
  id: string,
  me = "a@test",
  changes: Partial<Room> = {},
): Room => ({
  id,
  me,
  book: { title: id, owner: me },
  members: [me],
  messages: [{ id: 5, author: me, text: "hi", ts: 1, thread: "main" }],
  epics: [],
  typing: { "5": "smart" },
  online: [],
  suggestions: [],
  at: 100,
  eh: "h1",
  ...changes,
});
const tick = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};

test("the store saves in batches (DMs too), reads back only this account's rooms, expires, prunes and clears", async () => {
  const { idb, rows } = fakeIndexedDb();
  let now = 1_000_000_000;
  const timers: (() => void)[] = [];
  const cache = createRoomCache(idb, {
    now: () => now,
    schedule: (fn) => timers.push(fn),
  });
  cache.save("a@test", room("r1"));
  cache.save("a@test", room("r1", "a@test", { at: 200 }));
  cache.save("a@test", room("r2"));
  cache.save(
    "a@test",
    room("dm", "a@test", { book: { title: "x", owner: "a@test", dm: true } }),
  );
  expect(timers).toHaveLength(1);
  timers.shift()!();
  await tick();
  // A DM is a room like any other: it is saved too.
  expect([...rows.keys()].sort()).toEqual(["dm", "r1", "r2"]);
  const saved = await cache.load("a@test", "r1");
  expect(saved?.at).toBe(200);
  expect(saved?.typing).toEqual({});
  expect(await cache.load("b@test", "r1")).toBeNull();
  // keep: rooms that are no longer yours go.
  cache.keep("a@test", ["r1"]);
  await tick();
  expect([...rows.keys()]).toEqual(["r1"]);
  now += 8 * 86_400_000;
  expect(await cache.load("a@test", "r1")).toBeNull();
  await tick();
  expect(rows.size).toBe(0);
  cache.save("a@test", room("r3"));
  timers.shift()!();
  await tick();
  cache.clear();
  await tick();
  expect(rows.size).toBe(0);
  // No IndexedDB (a private window): nothing breaks, nothing is read.
  const none = createRoomCache(undefined);
  none.save("a@test", room("r1"));
  expect(await none.load("a@test", "r1")).toBeNull();
});

test("a saved room keeps the newest 400 messages and drops typing and history", () => {
  const big = room("r1", "a@test", {
    messages: Array.from({ length: 450 }, (_, i) => ({
      id: i + 1,
      author: "a@test",
      text: `m${i}`,
      ts: i,
      thread: "main",
    })),
    history: { 1: [] },
  });
  const saved = savedRoom(big);
  expect(saved.messages).toHaveLength(400);
  expect(saved.messages[0]?.id).toBe(51);
  expect(saved.history).toBeUndefined();
  expect(saved.typing).toEqual({});
});

test("after a reload, once the account is known, a room not in memory draws from IndexedDB first and its socket resumes from it", async () => {
  const urls: string[] = [];
  let callbacks!: RoomConnectionOptions;
  let started = 0;
  const loads: string[] = [];
  const saved = room("aaaaaa", "a@test", {
    messages: [
      { id: 9, author: "a@test", text: "saved", ts: 1, thread: "main" },
    ],
    at: 500,
    eh: "h9",
  });
  const session = createRootRoomSession({
    url: (id, thread, code, resume) => {
      const url = `${id}/${thread}?since=${resume?.since ?? ""}&at=${resume?.at ?? ""}&eh=${resume?.eh ?? ""}`;
      urls.push(url);
      return url;
    },
    acceptIdentity: () => false,
    onOpen: () => {},
    onTransition: () => {},
    onTerminal: () => {},
    whenAccount: (found) => {
      queueMicrotask(() => found("a@test"));
      return () => {};
    },
    schedule: () => 0,
    persist: {
      load: async (account, id) => {
        loads.push(`${account}/${id}`);
        return saved;
      },
      save: () => {},
      drop: () => {},
      keep: () => {},
      clear: () => {},
    },
    connection: (options) => {
      callbacks = options;
      return {
        start() {
          started++;
          options.url("");
        },
        dispose() {},
        resync() {},
        send: () => true,
        request: async () => ({ ok: true }),
      };
    },
  });
  session.open("aaaaaa");
  expect(started).toBe(0);
  await tick();
  expect(loads).toEqual(["a@test/aaaaaa"]);
  expect(session.read().phase).toBe("cached");
  expect(session.read().room?.messages.map((m) => m.text)).toEqual(["saved"]);
  expect(started).toBe(1);
  expect(urls.at(-1)).toBe("aaaaaa/main?since=9&at=500&eh=h9");
  expect(callbacks).toBeDefined();
  session.dispose();
});

test("with IndexedDB, memory keeps only the open room: going back to a room reads it from IndexedDB (cache plan PR 4)", async () => {
  const loads: string[] = [];
  const sockets: RoomConnectionOptions[] = [];
  const session = createRootRoomSession({
    url: (id) => id,
    acceptIdentity: () => false,
    onOpen: () => {},
    onTransition: () => {},
    onTerminal: () => {},
    schedule: () => 0,
    persist: {
      load: async (account, id) => {
        loads.push(`${account}/${id}`);
        return room(id, account, {
          messages: [
            {
              id: 1,
              author: account,
              text: `saved ${id}`,
              ts: 1,
              thread: "main",
            },
          ],
        });
      },
      save: () => {},
      drop: () => {},
      keep: () => {},
      clear: () => {},
    },
    connection: (options) => {
      sockets.push(options);
      return {
        start() {},
        dispose() {},
        resync() {},
        send: () => true,
        request: async () => ({ ok: true }),
      };
    },
  });
  const dm = room("dmdmdm", "a@test", {
    book: { title: "dm", owner: "a@test", dm: true },
  });
  session.open("dmdmdm");
  sockets.at(-1)!.onEvent({ t: "state", ...dm } as never);
  session.open("aaaaaa");
  sockets.at(-1)!.onEvent({ t: "state", ...room("aaaaaa") } as never);
  session.open("bbbbbb");
  sockets.at(-1)!.onEvent({ t: "state", ...room("bbbbbb") } as never);
  // A DM is a room like any other: it is not kept in memory either, and comes back from IndexedDB.
  session.open("dmdmdm");
  expect(session.read().room).toBeNull();
  await tick();
  expect(loads.at(-1)).toBe("a@test/dmdmdm");
  session.open("aaaaaa");
  expect(session.read().room).toBeNull();
  await tick();
  expect(loads.at(-1)).toBe("a@test/aaaaaa");
  expect(session.read().phase).toBe("cached");
  expect(session.read().room?.messages[0]?.text).toBe("saved aaaaaa");
  session.dispose();
});
