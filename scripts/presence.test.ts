import { expect, mock, test } from "bun:test";
import { encodeCall } from "../shared/jsonRpc";
import { parsePersonEvent, PersonEventSchema } from "../shared/person";
import {
  isOnline,
  planPresence,
  PRESENCE_GRACE,
  PRESENCE_REFRESH,
  PRESENCE_STALE,
} from "../src/presence";
import { decodePersonalNotice } from "../web/features/home/connection";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { Person } = await import("../src/person");

// DM presence (src/presence.ts, src/person.ts): the owner's transitions, the grace period and the stale rule.
const T = 1_000_000_000;

test("the first app socket says online once; more sockets say nothing", () => {
  expect(planPresence("open", 1, undefined, T)).toEqual({
    announce: true,
    alarm: T + PRESENCE_REFRESH,
  });
  expect(planPresence("open", 1, { online: false, at: T - 5 }, T)).toEqual({
    announce: true,
    alarm: T + PRESENCE_REFRESH,
  });
  // Already online: no message, the refresh keeps the last announcement's clock.
  expect(planPresence("open", 2, { online: true, at: T - 1000 }, T)).toEqual({
    alarm: T - 1000 + PRESENCE_REFRESH,
  });
});

test("the last socket starts the grace period; a socket inside it cancels the offline", () => {
  const announced = { online: true, at: T };
  expect(planPresence("close", 1, announced, T + 10)).toEqual({});
  const closed = planPresence("close", 0, announced, T + 10);
  expect(closed).toEqual({ alarm: T + 10 + PRESENCE_GRACE });
  // A reload: the new socket comes 2 s later. No announcement, the alarm moves to the refresh.
  const back = planPresence("open", 1, announced, T + 2010);
  expect(back.announce).toBeUndefined();
  expect(back.alarm).toBe(T + PRESENCE_REFRESH);
});

test("the alarm says offline when no socket came back, and refreshes while one is open", () => {
  const announced = { online: true, at: T };
  expect(planPresence("alarm", 0, announced, T + PRESENCE_GRACE)).toEqual({
    announce: false,
    alarm: null,
  });
  expect(planPresence("alarm", 0, { online: false, at: T }, T + 1)).toEqual({
    alarm: null,
  });
  expect(planPresence("alarm", 3, announced, T + PRESENCE_REFRESH)).toEqual({
    announce: true,
    alarm: T + 2 * PRESENCE_REFRESH,
  });
});

test("a stored online older than the stale limit reads as offline", () => {
  expect(isOnline({ online: true, at: T }, T + PRESENCE_STALE - 1)).toBe(true);
  expect(isOnline({ online: true, at: T }, T + PRESENCE_STALE)).toBe(false);
  expect(isOnline({ online: false, at: T }, T)).toBe(false);
  expect(isOnline(undefined, T)).toBe(false);
  // Two missed refreshes fit before the stale limit.
  expect(PRESENCE_STALE).toBeGreaterThan(2 * PRESENCE_REFRESH);
});

test("the presence event is typed on the wire and in the app", () => {
  const full = {
    t: "presence" as const,
    people: [{ email: "b@x.com", online: true }],
    all: 1 as const,
  };
  expect(PersonEventSchema.safeParse(full).success).toBe(true);
  expect(parsePersonEvent(encodeCall(full))).toEqual(full);
  expect(decodePersonalNotice(encodeCall(full))).toEqual({
    kind: "presence",
    people: full.people,
    all: true,
  });
  const change = {
    t: "presence" as const,
    people: [{ email: "b@x.com", online: false }],
  };
  expect(decodePersonalNotice(encodeCall(change))).toEqual({
    kind: "presence",
    people: change.people,
    all: false,
  });
  expect(
    parsePersonEvent(
      JSON.stringify({
        jsonrpc: "2.0",
        method: "presence",
        params: { people: [{ email: "b@x.com" }] },
      }),
    ),
  ).toBe(null);
});

test("the alert event is typed on the wire and in the app", () => {
  const alert = { t: "alert" as const, book: "dm-abc" };
  expect(parsePersonEvent(encodeCall(alert))).toEqual(alert);
  expect(decodePersonalNotice(encodeCall(alert))).toEqual({
    kind: "alert",
    book: "dm-abc",
  });
  expect(
    parsePersonEvent(
      JSON.stringify({ jsonrpc: "2.0", method: "alert", params: {} }),
    ),
  ).toBe(null);
});

// A Person DO with fake sockets, storage, D1 and contacts' DOs.
function fakePerson(contacts: string[] = []) {
  const store = new Map<string, unknown>();
  const sockets: { tags: string[]; sent: string[] }[] = [];
  const posted: { to: string; body: unknown }[] = [];
  const alarms: (number | null)[] = [];
  const waits: Promise<unknown>[] = [];
  const person = Object.create(Person.prototype);
  person.ctx = {
    acceptWebSocket: (
      ws: { tags: string[]; sent: string[] },
      tags: string[],
    ) => {
      ws.tags = tags;
      sockets.push(ws);
    },
    getWebSockets: (tag?: string) =>
      sockets.filter((ws) => !tag || ws.tags.includes(tag)),
    getTags: (ws: { tags: string[] }) => ws.tags,
    waitUntil: (p: Promise<unknown>) => waits.push(p),
    storage: {
      get: async (key: string) => store.get(key),
      put: async (key: string, value: unknown) => void store.set(key, value),
      delete: async (key: string) => store.delete(key),
      list: async ({ prefix }: { prefix: string }) =>
        new Map([...store].filter(([key]) => key.startsWith(prefix))),
      setAlarm: async (at: number) => void alarms.push(at),
      deleteAlarm: async () => void alarms.push(null),
    },
  };
  person.env = {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: contacts.map((email) => ({ email })) }),
        }),
      }),
    },
    PEOPLE: {
      idFromName: (name: string) => name,
      get: (to: string) => ({
        fetch: async (_url: string, init: RequestInit) => {
          posted.push({ to, body: JSON.parse(String(init.body)) });
          return new Response(null, { status: 204 });
        },
      }),
    },
  };
  // The runtime's WebSocketPair: the server end is a fake socket.
  Object.defineProperty(globalThis, "WebSocketPair", {
    configurable: true,
    writable: true,
    value: class {
      0 = {};
      1 = {
        tags: [] as string[],
        sent: [] as string[],
        send(frame: string) {
          this.sent.push(frame);
        },
      };
    },
  });
  const open = async () => {
    await person
      .fetch(
        new Request("https://person/ws-me", {
          headers: { upgrade: "websocket", "x-person": "A@x.com" },
        }),
      )
      .catch(() => null); // Response with status 101 is not allowed outside the runtime
    await Promise.all(waits.splice(0));
    return sockets.at(-1)!;
  };
  return { person, store, sockets, posted, alarms, open };
}

test("Person: the first tab gets the full list and tells the DM contacts once; the grace alarm says offline", async () => {
  const f = fakePerson(["b@x.com", "c@x.com"]);
  f.store.set("p:b@x.com", { online: true, at: Date.now() });
  f.store.set("p:old@x.com", {
    online: true,
    at: Date.now() - PRESENCE_STALE - 1,
  });
  const first = await f.open();
  expect(f.store.get("email")).toBe("a@x.com");
  expect(JSON.parse(first.sent[0]!)).toEqual({
    jsonrpc: "2.0",
    method: "presence",
    params: {
      people: [
        { email: "b@x.com", online: true },
        { email: "old@x.com", online: false },
      ],
      all: 1,
    },
  });
  expect(f.posted.map((p) => p.to)).toEqual(["b@x.com", "c@x.com"]);
  expect(f.posted[0]!.body).toMatchObject({ email: "a@x.com", online: true });
  // A second tab, then both close: nothing until the alarm.
  const second = await f.open();
  expect(f.posted.length).toBe(2);
  await f.person.webSocketClose(second);
  f.sockets.splice(f.sockets.indexOf(second), 1);
  expect(f.posted.length).toBe(2);
  await f.person.webSocketClose(first);
  f.sockets.splice(f.sockets.indexOf(first), 1);
  expect(f.posted.length).toBe(2);
  expect(f.alarms.at(-1)).toBeGreaterThan(Date.now() + PRESENCE_GRACE - 1000);
  await f.person.alarm();
  expect(
    f.posted
      .slice(2)
      .map((p) => [p.to, (p.body as { online: boolean }).online]),
  ).toEqual([
    ["b@x.com", false],
    ["c@x.com", false],
  ]);
});

test("Person: a contact's news goes to the app sockets only, and a new contact gets an answer once", async () => {
  const f = fakePerson(["b@x.com"]);
  const app = await f.open();
  const hub = { tags: ["jsonrpc"], sent: [] as string[] };
  f.sockets.push(hub);
  f.posted.length = 0;
  const post = (body: unknown) =>
    f.person.fetch(
      new Request("https://person/presence", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  await post({ email: "B@x.com", online: true, at: Date.now() });
  expect(JSON.parse(app.sent.at(-1)!).params).toEqual({
    people: [{ email: "b@x.com", online: true }],
  });
  expect(hub.sent).toEqual([]);
  // b did not know a: a answers with its own state, marked as a reply.
  expect(f.posted).toEqual([
    {
      to: "b@x.com",
      body: expect.objectContaining({
        email: "a@x.com",
        online: true,
        reply: true,
      }),
    },
  ]);
  await post({ email: "b@x.com", online: false, at: Date.now() });
  expect(f.posted.length).toBe(1);
  // A late, older message does not undo a newer one.
  await post({ email: "b@x.com", online: true, at: 1 });
  expect(f.store.get("p:b@x.com")).toMatchObject({ online: false });
  // Not a presence notice: refused quietly.
  await post({ email: "b@x.com" });
  expect(f.store.get("p:b@x.com")).toMatchObject({ online: false });
});
