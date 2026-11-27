import { expect, mock, test } from "bun:test";
import { Database } from "bun:sqlite";
import { MeData, MeResult } from "../shared/schemas";
// src/services.ts reaches modules that import the Workers runtime; the bits they name are enough here.
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { meFor, services } = await import("../src/services");
const { Person, pokeRoommates, socketWire } = await import("../src/person");
import type { Env } from "../src/index";

// GET /api/me's cache in the Person DO (src/person.ts), with a fake DO and a fake D1 that counts reads.
function fakeEnv(
  cached: unknown,
  profile: Record<string, unknown> = { name: "A", avatar: null, lang: "pt" },
) {
  let gen = 3;
  let stored: string | null =
    cached === undefined ? null : JSON.stringify(cached);
  const reads: string[] = [];
  const person = {
    async fetch(url: string, init?: RequestInit) {
      if (init?.method === "PUT") {
        if (Number(new Headers(init.headers).get("x-gen")) === gen)
          stored = String(init.body);
        return new Response(null, { status: 204 });
      }
      return stored
        ? new Response(stored, { headers: { "x-gen": String(gen) } })
        : new Response(null, {
            status: 404,
            headers: { "x-gen": String(gen) },
          });
    },
  };
  const rows = (sql: string): unknown[] =>
    sql.includes("FROM books")
      ? [
          {
            id: "r1",
            title: null,
            folder: null,
            summary: null,
            updated_at: 5,
            created_at: null,
            icon: null,
            busy_until: null,
            position: null,
            tint: null,
            opened_at: null,
            last_human_id: 0,
            last_agent_id: 0,
            read_id: 0,
            sandboxes_running: 0,
            members: "a@x.com",
          },
        ]
      : sql.includes("FROM friends")
        ? [
            {
              email: "b@x.com",
              name: null,
              avatar: null,
              joined: 1,
              shared: 2,
            },
            { email: null, name: null, avatar: null, joined: 0, shared: 0 },
          ]
        : sql.includes("FROM waits")
          ? [
              {
                book_id: "r1",
                room: null,
                ref: "m1",
                thread: null,
                topic: null,
                author: "b@x.com",
                author_name: null,
                text: null,
                ts: 9,
              },
            ]
          : [];
  const DB = {
    prepare(sql: string) {
      const st = {
        bind: () => st,
        all: async () => (reads.push(sql), { results: rows(sql) }),
        first: async () => (reads.push(sql), profile),
        run: async () => ({}),
      };
      return st;
    },
  };
  const env = {
    DB,
    PEOPLE: { idFromName: (x: string) => x, get: () => person },
    ASSETS: {
      fetch: async () => new Response(null, { headers: { etag: '"v9"' } }),
    },
  } as unknown as Env;
  return { env, reads, stored: () => stored, bump: () => gen++ };
}
const ctx = { waitUntil: (p: Promise<unknown>) => void p };
const req = new Request("https://vibebook.dev/api/me", {
  headers: { cookie: "vb_lang=pt" },
});
const flush = () => new Promise((r) => setTimeout(r, 0));

test("SQLite malformed optional avatar preserves valid profile and produces a valid cached consumer response", async () => {
  const db = new Database(":memory:");
  try {
    db.run("CREATE TABLE users (name TEXT, avatar INTEGER, lang TEXT)");
    db.run("INSERT INTO users VALUES ('A', 'broken', 'pt')");
    const profile = db
      .query<Record<string, unknown>, []>(
        "SELECT name, avatar, lang FROM users",
      )
      .get();
    if (!profile) throw Error("Missing SQLite fixture");
    const f = fakeEnv(undefined, profile);
    const response = MeResult.parse(await meFor(f.env, ctx, "a@x.com", req));
    expect(response.name).toBe("A");
    expect(response.avatar).toBeNull();
    await flush();
    expect(MeData.parse(JSON.parse(f.stored()!)).avatar).toBeNull();
    const reads = f.reads.length;
    expect((await meFor(f.env, ctx, "a@x.com", req)).cached).toBe(true);
    expect(f.reads.length).toBe(reads);
  } finally {
    db.close();
  }
});

test("an off-schema cache is recomputed, replaced, and the next request skips D1", async () => {
  const f = fakeEnv({ email: "a@x.com", books: "old shape" });
  const first = await meFor(f.env, ctx, "a@x.com", req);
  await flush();
  expect(first.cached).toBeUndefined();
  expect(f.reads.length).toBeGreaterThan(0);
  // Legacy nulls get neutral values; a row that can't be fixed (friend with no email) is dropped, never served.
  expect(first.books[0]!.title).toBeNull();
  expect(first.friends.map((x) => x.email)).toEqual(["b@x.com"]);
  expect(first.waits[0]).toMatchObject({ room: "", thread: "main", text: "" });
  expect(JSON.parse(f.stored()!).books).toHaveLength(1);
  const before = f.reads.length;
  const second = await meFor(f.env, ctx, "a@x.com", req);
  expect(second.cached).toBe(true);
  // The app version is cached per isolate (src/services.ts), so another test file can set it first: compare, not "v9".
  expect(second.v).toBe(first.v);
  expect(f.reads.length).toBe(before);
});

test("an answer computed before a poke is not stored after it (race guard kept)", async () => {
  const f = fakeEnv(undefined);
  const p = meFor(f.env, ctx, "a@x.com", req);
  f.bump(); // a change lands while D1 is being read
  await p;
  await flush();
  expect(f.stored()).toBeNull();
});

// A changed picture reaches everyone who draws it: you and each person you share a room with (DMs too), one query.
function roommatesEnv() {
  const db = new Database(":memory:");
  db.run("CREATE TABLE members (book_id TEXT, email TEXT)");
  db.run("CREATE TABLE users (email TEXT, avatar INTEGER, avatar_src TEXT)");
  const rows: [string, string][] = [
    ["r1", "a@x.com"],
    ["r1", "b@x.com"],
    ["dm1", "a@x.com"],
    ["dm1", "c@x.com"],
    ["r2", "b@x.com"],
    ["r2", "d@x.com"],
  ];
  for (let i = 0; i < 120; i++) rows.push(["big", `p${i}@x.com`]);
  rows.push(["big", "a@x.com"]);
  for (const [book, email] of rows)
    db.run("INSERT INTO members VALUES (?, ?)", [book, email]);
  const poked: { email: string; body: string }[] = [];
  const DB = {
    prepare(sql: string) {
      let args: unknown[] = [];
      const st = {
        bind: (...values: unknown[]) => ((args = values), st),
        all: async () => ({
          results: db.query(sql).all(...(args as [])) as unknown[],
        }),
        first: async () => db.query(sql).get(...(args as [])),
        run: async () => (db.query(sql).run(...(args as [])), {}),
      };
      return st;
    },
  };
  const env = {
    DB,
    FILES: { put: async () => {} },
    PEOPLE: {
      idFromName: (x: string) => x,
      get: (email: string) => ({
        fetch: async (_url: string, init?: RequestInit) => {
          poked.push({ email, body: String(init?.body) });
          return new Response(null, { status: 204 });
        },
      }),
    },
  } as unknown as Env;
  return { env, poked, close: () => db.close() };
}

test("a changed picture pokes you and everyone you share a room or DM with, past the 50-per-call cap", async () => {
  const f = roommatesEnv();
  try {
    await pokeRoommates(f.env, "A@x.com", { t: "me" });
    const emails = f.poked.map((p) => p.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(emails).toContain("a@x.com");
    expect(emails).toContain("b@x.com");
    expect(emails).toContain("c@x.com"); // the DM peer
    expect(emails).not.toContain("d@x.com"); // b's roommate, not yours
    expect(emails).toHaveLength(1 + 2 + 120);
    expect(f.poked.every((p) => p.body === '{"t":"me"}')).toBe(true);
  } finally {
    f.close();
  }
});

test("saving your picture pokes the people who draw it", async () => {
  const f = roommatesEnv();
  try {
    const waits: Promise<unknown>[] = [];
    const svc = services(
      f.env,
      { waitUntil: (p) => void waits.push(p) },
      "a@x.com",
      req,
    );
    expect(await svc.saveAvatar("image/png", new ArrayBuffer(1))).toBeNumber();
    await Promise.all(waits);
    expect(f.poked.map((p) => p.email)).toContain("c@x.com");
  } finally {
    f.close();
  }
});

// The person socket: the app and a new CLI hub get JSON-RPC, an older CLI hub keeps the tagged JSON.
test("socketWire: /ws-me and /mcp?wire=jsonrpc get JSON-RPC, plain /mcp stays tagged", () => {
  expect(socketWire(new URL("https://x/ws-me"))).toBe("jsonrpc");
  expect(socketWire(new URL("https://x/mcp?wire=jsonrpc"))).toBe("jsonrpc");
  expect(socketWire(new URL("https://x/mcp"))).toBe("tagged");
});

test("Person poke sends each socket its own format", async () => {
  const sent: Record<string, string[]> = { jsonrpc: [], tagged: [] };
  const sockets = (["jsonrpc", "tagged"] as const).map((wire) => ({
    wire,
    send: (frame: string) => sent[wire].push(frame),
  }));
  const person = Object.create(Person.prototype);
  person.ctx = {
    getWebSockets: () => sockets,
    getTags: (ws: { wire: string }) => [ws.wire],
    storage: {
      get: async () => 0,
      put: async () => {},
      delete: async () => {},
    },
  };
  const body = JSON.stringify({ t: "agents", book: "r1" });
  await person.fetch(
    new Request("https://person/poke", { method: "POST", body }),
  );
  expect(sent.tagged).toEqual([body]);
  expect(sent.jsonrpc.map((frame) => JSON.parse(frame))).toEqual([
    { jsonrpc: "2.0", method: "agents", params: { book: "r1" } },
  ]);
});
