import { expect, test } from "bun:test";
import { Hono } from "hono";
import { hc, type InferRequestType } from "hono/client";
import {
  uploadsApi as api,
  testPush,
  type ApiCtx,
  type ApiServices,
} from "../src/api";
import { AgentDbRow, UploadHeaders } from "../src/apiServerSchemas";
import { encodeCall } from "../shared/jsonRpc";
import { parsePersonEvent, PersonEventSchema } from "../shared/person";
import type { SearchQuery } from "../shared/schemas";
import { RoomEventSchemas } from "../shared/events";
import {
  connectionIdentity,
  type ConnectionIdentityPorts,
} from "../src/connectionIdentity";
import type { StoredConnection } from "../src/connectionRows";

// Compile-time route contracts must come from the actual validator chain, not a
// client-side query cast/wrapper that could hide missing server inference.
type PersonalClient = ReturnType<typeof hc<typeof api>>;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
export type PersonalQueryContracts = [
  Assert<
    Equal<
      InferRequestType<PersonalClient["api"]["search"]["$get"]>["query"],
      SearchQuery
    >
  >,
];

// Exercise the real handlers/validators without Worker bindings or unchecked Env casts.
// Authentication middleware and persistence are separate Worker integration gates.
const conn = {
  id: "c1",
  title: "Mock",
  host: "mcp.example",
  scope: "room" as const,
  owner: "test@example.com",
  mine: true,
  created_at: 1,
  auth: "identity" as const,
  signed_in: true,
  apps: [],
  tools: [{ name: "t", description: "", read_only: true, app: false }],
  context: {},
};

function fixture(overrides: Partial<ApiServices> = {}) {
  const writes: { query: string; values: (string | number | null)[] }[] = [];
  const posted: { room: string; text: string; thread: string }[] = [];
  const pages: Record<string, unknown>[] = [];
  const uploaded: { room: string; type: string; size: number; name: string }[] =
    [];
  const saved: { table: string; value: string }[] = [];
  const svc: ApiServices = {
    en: false,
    isMember: async () => true,
    callsOn: true,
    allowCall: async () => true,
    callJoin: async () => ({ session: "s1" }),
    callTracks: async () => ({}),
    callAnswer: async () => true,
    callClose: async () => true,
    callLeave: async () => {},
    callDecline: async () => {},
    allowStt: async () => true,
    transcribe: async () => ({ ok: true, text: "spoken" }),
    pokeFocus: () => {},
    roomMessages: async (room, query) => {
      pages.push({ room, ...query });
      return { thread: query.thread, messages: [], acks: [], more: false };
    },
    roomState: async (room, query) => {
      pages.push({ state: room, ...query });
      return {
        t: "state",
        me: "test@example.com",
        book: { title: "Sala", owner: "test@example.com" },
        members: ["test@example.com"],
        messages: [],
        epics: [],
        online: [],
        suggestions: [],
        at: 5,
        ...(query.since ? { resume: true } : {}),
      };
    },
    linkTarget: async (room, query) => {
      pages.push({ link: room, ...query });
      return { kind: "private" };
    },
    humanPost: async (room, text, thread) => {
      posted.push({ room, text, thread });
      return text.trim()
        ? { ok: true, id: 42, thread }
        : { ok: false, error: "empty" };
    },
    storeFile: async (room, type, body, name) => {
      if (body.byteLength > 4) throw new Error("too large");
      uploaded.push({ room, type, size: body.byteLength, name });
      return {
        id: "file",
        name,
        type,
        size: body.byteLength,
        author: "test@example.com",
        ts: 1,
      };
    },
    fileTypes: ["text/plain"],
    maxBytes: () => 4,
    sizeError: () => "too large",
    typesError: "unsupported type",
    sql: async (query, ...values) => {
      writes.push({ query, values });
    },
    sqlBatch: async (query, rows) => {
      writes.push(...rows.map((values) => ({ query, values })));
    },
    track: () => {},
    pokeMe: () => {},
    waitCleared: () => {},
    vapidKey: "public-key",
    pushToMe: async () => 1,
    sqlAll: async () => [],
    search: async () => ({ rooms: 0, epics: [], messages: [] }),
    roomSearch: async () => ({ messages: [], more: false }),
    inbox: async () => ({ waits: [], mentions: [], tasks: [] }),
    threadDone: async () => true,
    isEmail: (value) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value),
    connect: async (email) =>
      email === "member@test.com"
        ? { id: "dm00000000000000000001" }
        : email === "limited@test.com"
          ? { error: "rate" }
          : {},
    dismiss: async () => {},
    answerInvite: async (room) => room === "aaaaaa",
    invite: async () => {},
    removeMember: async () => null,
    pokeAgents: () => {},
    pokeListeners: () => {},
    requestAccess: async () => "asked",
    roomOrg: async () => ({ domain: "example.com", org: null }),
    setRoomOrg: async (_room, open) => ({ org: open ? "example.com" : null }),
    orgRooms: async () => ({ domain: "example.com", rooms: [] }),
    decideRequest: async () => true,
    createRoom: async () => "room",
    startRoom: async () => ({ id: "room" }),
    routeHome: async () => ({ pick: null }),
    sameOrigin: true,
    allowSecretTry: async () => true,
    saveSecret: async (table, value) => {
      saved.push({ table, value });
    },
    listenFresh: 720_000,
    sandboxes: {
      list: async () => ({ connected: true, claude: false, sandboxes: [] }),
      create: async (_room, name) => {
        if (name === "boom") throw new Error("Limite de 3 sandboxes por sala.");
        return { id: "sb1", vm_id: "vm1", name: name || "auto" };
      },
      power: async (sid) =>
        sid === "mine"
          ? null
          : sid === "flaky"
            ? "502: freestyle down"
            : "not_found",
      setup: async (sid) => {
        if (sid !== "mine") throw new Error("not found");
        return { ok: true, log: "done" };
      },
      remove: async (sid) => sid === "mine",
      terminal: async (sid) =>
        sid === "mine" ? { token: "t", url: "wss://x" } : null,
    },
    allowUpload: async () => true,
    saveAvatar: async (type, bytes) => {
      saved.push({ table: "avatar", value: `${type}:${bytes.byteLength}` });
      return 7;
    },
    setRoomIcon: async (_room, img) => {
      if (img && img.type !== "image/png")
        throw new Error("Use PNG, JPEG, WebP, GIF ou ICO.");
      return img ? 9 : null;
    },
    me: async () => ({
      email: "test@example.com",
      name: null,
      dm: "dm000000000000000000aa",
      requests: [],
      sent: [],
      invites: [],
      people: [],
      avatar: null,
      books: [],
      friends: [],
      waits: [],
      v: "v1",
    }),
    connections: {
      identity: async () => ({
        direct: true,
        url: "https://mcp.example/mcp",
        identity: "signed-identity",
        expires_in: 300,
      }),
      list: async () => ({ connections: [conn] }),
      create: async (_room, b) =>
        b.token
          ? { error: "conexões não levam mais token", status: 400 }
          : { ok: true, connection: { ...conn, needs_sign_in: false } },
      remove: async (_room, cid) =>
        cid === "c1"
          ? { ok: true }
          : { error: "só quem conectou pode remover", status: 400 },
      refresh: async (_room, cid) =>
        cid === "c1"
          ? { ok: true, connection: conn }
          : { error: "conexão não encontrada", status: 404 },
      ui: async (_room, cid, tool) =>
        cid === "c1"
          ? { html: "<p>" + tool, tool: { name: tool } }
          : { error: "auth", status: 401, sign_in: true },
      call: async (_room, cid, name, args) =>
        cid === "c1"
          ? { result: { name, args } }
          : { error: "muitas chamadas no último minuto", status: 429 },
      context: async (_room, _cid, tool, text) => {
        saved.push({ table: "ctx", value: `${tool}:${text.length}` });
        return { ok: true };
      },
      signout: async () => ({ ok: true }),
    },
    studio: { disconnect: async () => {}, projects: async () => [] },
    checkFreestyleKey: async (key) =>
      key.startsWith("good") ? null : "401 unauthorized",
    grants: {
      list: async () => ({
        agents: [
          { id: "g1", client: "vibebook CLI", connected_at: 1, used_at: 2 },
          { id: "g0", client: "Claude", connected_at: 0 },
        ],
        last_used: 2,
      }),
      revoke: async (ids) => {
        saved.push({ table: "revoke", value: ids.join(",") });
        return ids.length;
      },
    },
    reportRoom: (room) => room === "report",
    infraMonitor: async (window) => ({
      window,
      days: [
        {
          day: "2026-11-23",
          requests: 100,
          errors: 1,
          bytes: 2048,
          cpu_p50_ms: 3,
          wall_p50_ms: 9,
          visitors: 5,
        },
      ],
      worker_error: null,
      generated_at: "2026-11-24T00:00:00.000Z",
    }),
    aiSpend: async () => ({
      recorded: {
        jev: 0.01,
        llm: 0.5,
        router: 0.001,
        since: "2026-10-01T00:00:00.000Z",
      },
      by_event: [
        { event: "grade", kind: "jev", model: "jev", calls: 500, cost: 0.01 },
      ],
      router: [{ arm: "jev", n: 3, cost: 0.0001 }],
      days: [{ day: "2026-11-12", jev: 0.001, llm: 0.02, router: 0 }],
      openrouter_key: {
        usage: 12.34,
        limit: null,
        daily: 0.5,
        weekly: 2,
        monthly: 9,
      },
      note: "n",
    }),
    setProfilePublic: async (on) => ({ handle: "test", public: on }),
    setHandle: async (handle) =>
      handle === "taken" ? { error: "taken" as const } : { handle },
    routerStats: async (room) => {
      const arm = { n: 2, ignore: 1, answer: 0, wake: 1, cost: 0.0001 };
      return {
        since: "2026-11-01T00:00:00.000Z",
        arms: {
          jev: { ...arm, p50: 300, p95: 500 },
          hybrid: { ...arm, p50: 900, p95: 1500 },
          haiku: { ...arm, p50: 1800, p95: 2100 },
          rule: { n: 0, ignore: 0, answer: 0, wake: 0, cost: 0 },
        },
        recent: room
          ? []
          : [
              {
                book_id: "r1",
                room: "Room",
                who: "a@test.vibebook.dev",
                msg_id: 8,
                arm: "jev",
                decision: "ignore",
                why: "thanks",
                source: null,
                reply_id: null,
                ms: 300,
                cost: 0.00002,
                text: "Gui: valeu",
                ts: 1,
              },
            ],
      };
    },
    consentContext: async () => ({
      context: {
        client_name: "Claude",
        client_domain: null,
        redirect_host: "127.0.0.1",
        redirect_is_loopback: true,
        scope: ["vibebook"],
        email: "test@example.com",
        handle: "h1",
      },
      headers: [
        ["Set-Cookie", "__Host-oauth-consent-x=y; Path=/; Secure; HttpOnly"],
        ["Cache-Control", "no-store"],
      ],
    }),
    ...overrides,
  };
  const app = new Hono<ApiCtx>()
    .use("*", async (c, next) => {
      c.set("email", "test@example.com");
      c.set("svc", svc);
      await next();
    })
    .route("/", api);
  const json = (path: string, value: unknown) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
  return { app, json, writes, posted, pages, uploaded, saved, svc };
}

test("post validates HTTP input and preserves success and business-error responses", async () => {
  const f = fixture();
  const success = await f.json("/api/books/room/post", {
    text: "hello",
    thread: "epic",
  });
  expect(success.status).toBe(200);
  expect(await success.json()).toEqual({ ok: true, id: 42, thread: "epic" });
  const empty = await f.json("/api/books/room/post", { text: " " });
  expect(empty.status).toBe(400);
  expect(await empty.json()).toEqual({ ok: false, error: "empty" });
  for (const payload of [
    null,
    [],
    {},
    { text: 42 },
    { text: "hello", thread: 42 },
  ]) {
    expect((await f.json("/api/books/room/post", payload)).status).toBe(400);
  }
  const malformed = await f.app.request("/api/books/room/post", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  expect(malformed.status).toBe(400);
  expect(f.posted).toEqual([
    { room: "room", text: "hello", thread: "epic" },
    { room: "room", text: " ", thread: "main" },
  ]);
});

test("GET link: the query validated, the answer the resolver's, never a 403", async () => {
  const f = fixture({ isMember: async () => false });
  const ok = await f.app.request("/api/books/room/link?t=e1&m=42");
  expect(ok.status).toBe(200);
  expect(ok.headers.get("cache-control")).toBe("private, no-store");
  expect(await ok.json()).toEqual({ kind: "private" });
  expect((await f.app.request("/api/books/room/link")).status).toBe(200);
  expect(f.pages).toEqual([{ link: "room", t: "e1", m: 42 }, { link: "room" }]);
  for (const query of ["m=0", "m=x", "t=", `t=${"x".repeat(65)}`])
    expect((await f.app.request(`/api/books/room/link?${query}`)).status).toBe(
      400,
    );
});

test("GET messages: a page by id cursor, members only, the query validated (cache plan, PR 1)", async () => {
  const f = fixture();
  const ok = await f.app.request(
    "/api/books/room/messages?thread=e1&before=90&limit=20",
  );
  expect(ok.status).toBe(200);
  expect(ok.headers.get("cache-control")).toBe("private, no-store");
  expect(await ok.json()).toEqual({
    thread: "e1",
    messages: [],
    acks: [],
    more: false,
  });
  expect((await f.app.request("/api/books/room/messages")).status).toBe(200);
  expect((await f.app.request("/api/books/room/messages?after=7")).status).toBe(
    200,
  );
  expect(f.pages).toEqual([
    { room: "room", thread: "e1", before: 90, limit: 20 },
    { room: "room", thread: "main", limit: 50 },
    { room: "room", thread: "main", after: 7, limit: 50 },
  ]);
  for (const query of [
    "limit=0",
    "limit=101",
    "before=-1",
    "before=x",
    "thread=",
  ])
    expect(
      (await f.app.request(`/api/books/room/messages?${query}`)).status,
    ).toBe(400);
  const outsider = fixture({ isMember: async () => false });
  expect((await outsider.app.request("/api/books/room/messages")).status).toBe(
    403,
  );
  expect(outsider.pages).toHaveLength(0);
});

test("GET room: the room's state over HTTP, members only, with the socket's params, and tracked", async () => {
  const tracked: { name: string; dims?: Record<string, unknown> }[] = [];
  const f = fixture({
    track: (name, dims) => void tracked.push({ name, dims }),
  });
  const ok = await f.app.request("/api/books/room/room?t=e1");
  expect(ok.status).toBe(200);
  expect(ok.headers.get("cache-control")).toBe("private, no-store");
  const state = await ok.json();
  expect(RoomEventSchemas.state.safeParse(state).success).toBe(true);
  expect(state).toMatchObject({ t: "state", me: "test@example.com", at: 5 });
  const resumed = await f.app.request(
    "/api/books/room/room?t=main&since=40&at=1795618413891&eh=18k75oq4jio",
  );
  expect(await resumed.json()).toMatchObject({ resume: true });
  expect((await f.app.request("/api/books/room/room")).status).toBe(200);
  expect(f.pages).toEqual([
    { state: "room", t: "e1" },
    {
      state: "room",
      t: "main",
      since: 40,
      at: 1795618413891,
      eh: "18k75oq4jio",
    },
    { state: "room", t: "main" },
  ]);
  expect(tracked.map((t) => t.name)).toEqual([
    "room_state",
    "room_state",
    "room_state",
  ]);
  expect(tracked[0]?.dims).toMatchObject({
    book: "room",
    bytes: JSON.stringify(state).length,
  });
  expect(tracked[1]?.dims).toMatchObject({ resume: "epics" });
  for (const query of [
    "t=",
    "since=x",
    "at=-1",
    "eh=a%26b",
    `t=${"x".repeat(65)}`,
  ])
    expect((await f.app.request(`/api/books/room/room?${query}`)).status).toBe(
      400,
    );
  const outsider = fixture({ isMember: async () => false });
  expect((await outsider.app.request("/api/books/room/room")).status).toBe(403);
  expect(outsider.pages).toHaveLength(0);
});

test("room operations reject nonmembers before any write", async () => {
  const f = fixture({ isMember: async () => false });
  for (const [path, body] of [
    ["post", { text: "forbidden" }],
    ["archive", { archived: true }],
    ["tint", { tint: "blue" }],
    ["read", {}],
  ] as const) {
    expect((await f.json(`/api/books/room/${path}`, body)).status).toBe(403);
  }
  const upload = await f.app.request("/api/books/room/files", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "hi",
  });
  expect(upload.status).toBe(403);
  expect(f.writes).toHaveLength(0);
  expect(f.posted).toHaveLength(0);
  expect(f.uploaded).toHaveLength(0);
});

test("binary upload validates metadata, encoded names and limits", async () => {
  const f = fixture();
  const request = (
    type: string,
    name: string,
    content: string,
    length?: string,
  ) =>
    f.app.request("/api/books/room/files", {
      method: "POST",
      headers: {
        "content-type": type,
        "x-filename": name,
        ...(length === undefined ? {} : { "content-length": length }),
      },
      body: content,
    });
  const result = await request("text/plain; charset=utf-8", "a%20b.txt", "hi");
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    id: "file",
    name: "a b.txt",
    type: "text/plain",
    size: 2,
    author: "test@example.com",
    ts: 1,
  });
  expect((await request("image/svg+xml", "bad.svg", "x")).status).toBe(415);
  expect((await request("text/plain", "large.txt", "large", "5")).status).toBe(
    413,
  );
  // Actual streamed bytes must reject oversize before calling storage, regardless of this header.
  expect((await request("text/plain", "large.txt", "large")).status).toBe(413);
  expect((await request("text/plain", "%ZZ", "hi")).status).toBe(400);
  expect(f.uploaded).toEqual([
    { room: "room", type: "text/plain", size: 2, name: "a b.txt" },
  ]);
});

test("push settings expose the public key and validate subscription writes", async () => {
  const f = fixture();
  const key = await f.app.request("/api/push/key");
  expect(key.status).toBe(200);
  expect(await key.json()).toEqual({ key: "public-key" });
  for (const payload of [
    { endpoint: "http://bad", p256dh: "k", auth: "a" },
    { endpoint: "https://push", p256dh: "k" },
  ]) {
    expect((await f.json("/api/push/subscribe", payload)).status).toBe(400);
  }
  expect(f.writes).toHaveLength(0);
  expect(
    (
      await f.json("/api/push/subscribe", {
        endpoint: "https://push",
        p256dh: "k",
        auth: "a",
      })
    ).status,
  ).toBe(200);
  expect(
    (await f.json("/api/push/unsubscribe", { endpoint: "https://push" }))
      .status,
  ).toBe(200);
  expect(
    f.writes.every((write) => write.values.includes("test@example.com")),
  ).toBe(true);
  const sent = await f.json("/api/push/test", {});
  expect(sent.status).toBe(200);
  expect(await sent.json()).toEqual({ ok: true, sent: 1 });
});

test("the welcome test push goes to this device only, with the first name in the person's language", async () => {
  const pushes: { title: string; body: string; endpoint?: string }[] = [];
  const pushToMe: ApiServices["pushToMe"] = async (p, endpoint) => {
    pushes.push({ title: p.title, body: p.body, endpoint });
    return 1;
  };
  const pt = fixture({
    pushToMe,
    sqlAll: async () => [{ name: "Ana Souza" }],
  });
  expect(
    (await pt.json("/api/push/test", { endpoint: "https://push/device" }))
      .status,
  ).toBe(200);
  const en = fixture({ en: true, pushToMe, sqlAll: async () => [] });
  expect((await en.json("/api/push/test", {})).status).toBe(200);
  expect(pushes).toEqual([
    {
      title: "Notificações do deco.chat ativadas 👋",
      body: "Oi, Ana! A gente te avisa quando alguém falar com você.",
      endpoint: "https://push/device",
    },
    {
      title: "deco.chat notifications are on 👋",
      body: "Hi! We'll let you know when someone talks to you.",
      endpoint: undefined,
    },
  ]);
  expect(testPush(true, "  Bia  Lima ").body).toBe(
    "Hi Bia! We'll let you know when someone talks to you.",
  );
});

test("room and wait mutations validate inputs and scope writes to the signed-in person", async () => {
  const f = fixture();
  for (const [path, value] of [
    ["/api/books/room/archive", { archived: "no" }],
    ["/api/books/room/tint", { tint: 1 }],
    ["/api/rooms/order", { ids: [] }],
    ["/api/waits/resolve", { book_id: "room", ref: "x1" }],
    ["/api/waits/resolve", { book_id: "room", ref: "d" }],
    ["/api/waits/resolve-many", { items: [{ book_id: "room", ref: "x1" }] }],
    ["/api/waits/resolve-many", { items: [] }],
  ] as const)
    expect((await f.json(path, value)).status).toBe(400);
  expect(f.writes).toHaveLength(0);
  for (const [path, value] of [
    ["/api/books/room/archive", { archived: false }],
    ["/api/books/room/tint", { tint: "blue" }],
    ["/api/books/room/read", {}],
    ["/api/rooms/order", { ids: ["room", "other"] }],
    ["/api/waits/resolve", { book_id: "room", ref: "m1" }],
    [
      "/api/waits/resolve-many",
      {
        items: [
          { book_id: "room", ref: "m1" },
          { book_id: "other", ref: "m2" },
        ],
      },
    ],
  ] as const)
    expect((await f.json(path, value)).status).toBe(200);
  expect(f.writes).toHaveLength(9);
  expect(
    f.writes.every((write) => write.values.includes("test@example.com")),
  ).toBe(true);
  // Marking a room read also clears what waited on you there, only there.
  expect(
    f.writes.find((write) => write.query.startsWith("DELETE FROM waits"))
      ?.values,
  ).toEqual(["room", "test@example.com"]);
  // Anything in the Inbox can be acknowledged: a task in review (t) is a wait; a held @mention (d) leaves the digest.
  const earlier = f.writes.length;
  expect(
    (await f.json("/api/waits/resolve", { book_id: "room", ref: "t9" })).status,
  ).toBe(200);
  expect(
    (await f.json("/api/waits/resolve", { book_id: "room", ref: "d42" }))
      .status,
  ).toBe(200);
  expect(
    f.writes.slice(earlier).map((write) => [write.query, write.values]),
  ).toEqual([
    [
      "DELETE FROM waits WHERE book_id = ? AND ref = ? AND email = ?",
      ["room", "t9", "test@example.com"],
    ],
    [
      "DELETE FROM digest_items WHERE book_id = ? AND msg_id = ? AND email = ?",
      ["room", 42, "test@example.com"],
    ],
  ]);
});

test("a forward sends counts only, from a member of the room", async () => {
  const events: { name: string; dims?: Record<string, unknown> }[] = [];
  const track: ApiServices["track"] = (name, dims) => {
    events.push({ name, dims });
  };
  const body = { n: 3, files: 1, to: "room", thread: true, range: true };
  const f = fixture({ track });
  expect((await f.json("/api/books/room/forwarded", body)).status).toBe(200);
  expect(events).toEqual([
    {
      name: "messages_forwarded",
      dims: {
        book: "room",
        n: 3,
        files: 1,
        to: "room",
        thread: true,
        range: true,
      },
    },
  ]);
  for (const bad of [
    { ...body, n: 0 },
    { ...body, n: 1.5 },
    { ...body, to: "elsewhere" },
    { ...body, text: "the forwarded words" },
  ])
    expect((await f.json("/api/books/room/forwarded", bad)).status).toBe(
      "text" in bad ? 200 : 400,
    );
  // "Copiar" counts as a forward to the clipboard.
  expect(
    (
      await f.json("/api/books/room/forwarded", {
        ...body,
        to: "clipboard",
        thread: false,
      })
    ).status,
  ).toBe(200);
  expect(events.at(-1)?.dims?.to).toBe("clipboard");
  const outsider = fixture({ isMember: async () => false, track });
  expect((await outsider.json("/api/books/room/forwarded", body)).status).toBe(
    403,
  );
  // The text never reaches the event.
  expect(JSON.stringify(events)).not.toContain("forwarded words");
});

test("freestyle key and Claude token: validated, checked, sealed, never echoed back", async () => {
  const f = fixture();
  const status = await f.app.request("/api/freestyle");
  expect(await status.json()).toEqual({ connected: false });
  expect((await f.json("/api/freestyle", { key: "short" })).status).toBe(400);
  const refused = await f.json("/api/freestyle", {
    key: "bad-key-0123456789abcdef",
  });
  expect(refused.status).toBe(400);
  expect(await refused.json()).toEqual({
    error: "O freestyle recusou a key: 401 unauthorized",
  });
  const accepted = await f.json("/api/freestyle", {
    key: "  good-key-0123456789abcdef  ",
  });
  expect(await accepted.json()).toEqual({ ok: true });
  expect((await f.json("/api/claude-token", { token: "nope" })).status).toBe(
    400,
  );
  const wrapped = await f.json("/api/claude-token", {
    token: "sk-ant-oat01-abcdefghij\n  klmnopqrstuvwxyz",
  });
  expect(await wrapped.json()).toEqual({ ok: true });
  expect(f.saved).toEqual([
    { table: "freestyle_keys", value: "good-key-0123456789abcdef" },
    {
      table: "claude_tokens",
      value: "sk-ant-oat01-abcdefghijklmnopqrstuvwxyz",
    },
  ]);
  for (const path of ["/api/freestyle", "/api/claude-token"])
    expect((await f.app.request(path, { method: "DELETE" })).status).toBe(200);
  expect(f.writes.map((w) => w.values)).toEqual([
    ["test@example.com"],
    ["test@example.com"],
  ]);
  const limited = fixture({ allowSecretTry: async () => false });
  expect(
    (await limited.json("/api/claude-token", { token: "sk-ant-x" })).status,
  ).toBe(429);
  expect(limited.saved).toHaveLength(0);
});

test("room agents: members only, listening and context derived from the rows, bad limits JSON dropped", async () => {
  const now = Date.now();
  const rows = (claude: boolean) => async (query: string) =>
    query.includes("FROM members WHERE")
      ? claude
        ? [{ claude_on: 1 }]
        : []
      : query.includes("FROM machines")
        ? []
        : query.includes("FROM sandboxes")
          ? [
              {
                id: "s1",
                email: "a@x.co",
                name: "box",
                state: "running",
                run_s: 60,
                rate: 0.1,
                disk_rate: 0.01,
                checked_at: now,
                created_at: now,
              },
            ]
          : [
              {
                email: "a@x.co",
                who: "claude-opus-5-5",
                repo: "vb",
                seen_at: now,
                listening_at: now - 1000,
                listen_room: "room",
                ctx_tokens: 500,
                ctx_window: 1000,
                ctx_at: now,
                ctx_limits: '{"five_hour":{"p":40,"r":1}}',
                id: "s_a",
                client: "vibebook CLI",
                machine_id: null,
                delivers: 1,
              },
              {
                email: "b@x.co",
                who: null,
                repo: null,
                seen_at: now,
                listening_at: now - 3_600_000,
                listen_room: null,
                ctx_tokens: 1,
                ctx_window: 2,
                ctx_at: now,
                ctx_limits: "{bad",
                id: "s_b",
                client: null,
                machine_id: null,
                delivers: 1,
              },
            ];
  const outsider = fixture({ sqlAll: rows(false) });
  expect((await outsider.app.request("/api/books/room/agents")).status).toBe(
    403,
  );
  const f = fixture({ sqlAll: rows(true) });
  const res = await f.app.request("/api/books/room/agents");
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    claude_on: boolean;
    sandboxes: unknown[];
    agents: {
      who: string;
      listening: boolean;
      all_rooms: boolean;
      context: { limits: unknown } | null;
    }[];
  };
  expect(body.claude_on).toBe(true);
  expect(body.sandboxes).toHaveLength(1);
  expect(body.agents.map((a) => [a.who, a.listening, a.all_rooms])).toEqual([
    ["claude-opus-5-5", true, false],
    ["agent", false, true],
  ]);
  expect(body.agents[0].context?.limits).toEqual({
    five_hour: { p: 40, r: 1 },
  });
  expect(body.agents[1].context?.limits).toBeNull();
});

test("sandboxes: members only, errors keep their old status and shape", async () => {
  const outsider = fixture({ isMember: async () => false });
  expect((await outsider.app.request("/api/books/room/sandboxes")).status).toBe(
    403,
  );
  expect((await outsider.json("/api/books/room/sandboxes", {})).status).toBe(
    403,
  );
  const f = fixture();
  expect(
    await (await f.app.request("/api/books/room/sandboxes")).json(),
  ).toEqual({ connected: true, claude: false, sandboxes: [] });
  expect(await (await f.json("/api/books/room/sandboxes", {})).json()).toEqual({
    ok: true,
    id: "sb1",
    vm_id: "vm1",
    name: "auto",
  });
  const limit = await f.json("/api/books/room/sandboxes", { name: "boom" });
  expect([limit.status, await limit.json()]).toEqual([
    400,
    { error: "Limite de 3 sandboxes por sala." },
  ]);
  expect((await f.json("/api/books/room/sandboxes", { name: 3 })).status).toBe(
    400,
  );
  const post = (path: string) => f.app.request(path, { method: "POST" });
  expect((await post("/api/sandboxes/mine/pause")).status).toBe(200);
  expect((await post("/api/sandboxes/other/start")).status).toBe(404);
  const down = await post("/api/sandboxes/flaky/pause");
  expect([down.status, await down.json()]).toEqual([
    502,
    { error: "502: freestyle down" },
  ]);
  expect(await (await post("/api/sandboxes/mine/setup")).json()).toEqual({
    ok: true,
    log: "done",
  });
  expect((await post("/api/sandboxes/other/setup")).status).toBe(502);
  expect(
    (await f.app.request("/api/sandboxes/other", { method: "DELETE" })).status,
  ).toBe(404);
  expect(
    (await f.app.request("/api/sandboxes/mine", { method: "DELETE" })).status,
  ).toBe(200);
  expect(await (await post("/api/sandboxes/mine/terminal")).json()).toEqual({
    token: "t",
    url: "wss://x",
  });
  expect((await post("/api/sandboxes/other/terminal")).status).toBe(404);
});

test("connections: members only, typed bodies, sign_in on 401, errors keep { error } and status", async () => {
  const outsider = fixture({ isMember: async () => false });
  expect(
    (await outsider.app.request("/api/books/room/connections")).status,
  ).toBe(403);
  expect(
    (await outsider.json("/api/books/room/connections/c1/call", { name: "x" }))
      .status,
  ).toBe(403);
  const f = fixture();
  expect(
    await (await f.app.request("/api/books/room/connections")).json(),
  ).toEqual({ connections: [conn] });
  const made = await f.json("/api/books/room/connections", {
    url: "https://mcp.example/mcp",
    scope: "room",
  });
  expect([made.status, (await made.json()).connection.needs_sign_in]).toEqual([
    200,
    false,
  ]);
  const tok = await f.json("/api/books/room/connections", {
    url: "https://x",
    token: "abc",
  });
  expect([tok.status, await tok.json()]).toEqual([
    400,
    { error: "conexões não levam mais token" },
  ]);
  expect((await f.json("/api/books/room/connections", { url: 3 })).status).toBe(
    400,
  );
  expect(
    (
      await f.app.request("/api/books/room/connections/c1", {
        method: "DELETE",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await f.app.request("/api/books/room/connections/c2", {
        method: "DELETE",
      })
    ).status,
  ).toBe(400);
  expect(
    (await f.json("/api/books/room/connections/c2/refresh", {})).status,
  ).toBe(404);
  expect(
    await (
      await f.app.request("/api/books/room/connections/c1/ui?tool=board")
    ).json(),
  ).toEqual({
    html: "<p>board",
    tool: { name: "board" },
  });
  const auth = await f.app.request(
    "/api/books/room/connections/c2/ui?tool=board",
  );
  expect([auth.status, await auth.json()]).toEqual([
    401,
    { error: "auth", sign_in: true },
  ]);
  expect(
    await (
      await f.json("/api/books/room/connections/c1/call", {
        name: "t",
        arguments: { a: 1 },
      })
    ).json(),
  ).toEqual({
    result: { name: "t", args: { a: 1 } },
  });
  expect(
    (await f.json("/api/books/room/connections/c2/call", { name: "t" })).status,
  ).toBe(429);
  expect(
    (
      await f.json("/api/books/room/connections/c1/context", {
        tool: "t",
        text: "x".repeat(5000),
      })
    ).status,
  ).toBe(200);
  expect(f.saved).toContainEqual({ table: "ctx", value: "t:4000" });
  expect(
    (await f.json("/api/books/room/connections/c1/signout", {})).status,
  ).toBe(200);
});

test("me: the home's one read, typed end to end", async () => {
  const f = fixture();
  const r = await f.app.request("/api/me");
  expect([r.status, (await r.json()).v]).toEqual([200, "v1"]);
});

test("personal query contracts preserve first duplicates, search normalization", async () => {
  const searches: string[] = [];
  const f = fixture({
    search: async (q) => {
      searches.push(q);
      return { rooms: 0, epics: [], messages: [] };
    },
  });
  const rpc = hc<typeof api>("http://localhost", { fetch: f.app.request });
  expect((await rpc.api.me.$get()).status).toBe(200);
  expect(
    (await rpc.api.search.$get({ query: { q: "  typed search  " } })).status,
  ).toBe(200);
  expect(searches).toEqual(["typed search"]);
  await f.app.request("/api/search?q=%20first%20&q=second");
  expect(searches.at(-1)).toBe("first");
  await f.app.request(
    `/api/search?q=${encodeURIComponent("  " + "x".repeat(130) + "  ")}`,
  );
  expect(searches.at(-1)).toBe("x".repeat(120));
  const count = searches.length;
  for (const path of [
    "/api/search",
    "/api/search?q=",
    "/api/search?q=%20a%20&q=longer",
  ]) {
    const response = await f.app.request(path);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      rooms: 0,
      epics: [],
      messages: [],
    });
  }
  expect(searches).toHaveLength(count);
  if (false) {
    // @ts-expect-error inferred q accepts a string, not an untyped numeric value.
    await rpc.api.search.$get({ query: { q: 123 } });
    // @ts-expect-error there is no room search query in this existing endpoint.
    await rpc.api.search.$get({ query: { room: "room" } });
  }
});

test("room search: members only, a person alone is enough, and the page cursor is a positive id", async () => {
  const calls: { room: string; q: string; from?: string; before?: number }[] =
    [];
  const hit = {
    id: 9,
    thread: "main",
    topic: null,
    author: "ana@example.test",
    by_agent: false,
    via: null,
    ts: 1,
    files: [],
    snippet: "oi",
  };
  const f = fixture({
    roomSearch: async (room, q, from, before) => {
      calls.push({ room, q, from, before });
      return { messages: [hit], more: true };
    },
  });
  const rpc = hc<typeof api>("http://localhost", { fetch: f.app.request });
  const room = rpc.api.books[":id"].search;
  const ok = await room.$get({
    param: { id: "aaaaaa" },
    query: { from: " Ana@Example.test " },
  });
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual({ messages: [hit], more: true });
  await room.$get({
    param: { id: "aaaaaa" },
    query: { q: "  deploy  ", from: "ana@example.test", before: "40" },
  });
  await f.app.request("/api/books/aaaaaa/search?q=deploy&before=-3");
  expect(calls).toEqual([
    { room: "aaaaaa", q: "", from: "ana@example.test", before: undefined },
    { room: "aaaaaa", q: "deploy", from: "ana@example.test", before: 40 },
    { room: "aaaaaa", q: "deploy", from: undefined, before: undefined },
  ]);
  // Nothing to look for: an empty answer, and the room is not asked.
  const none = await f.app.request("/api/books/aaaaaa/search?q=a");
  expect(await none.json()).toEqual({ messages: [], more: false });
  expect(calls).toHaveLength(3);
  const outsider = fixture({ isMember: async () => false });
  const denied = await outsider.app.request(
    "/api/books/aaaaaa/search?from=ana@example.test",
  );
  expect(denied.status).toBe(403);
  const limited = fixture({ roomSearch: async () => false });
  expect(
    (await limited.app.request("/api/books/aaaaaa/search?q=hello")).status,
  ).toBe(429);
});

test("personal query contracts leave rate limits and cached me payloads unchanged", async () => {
  const limited = fixture({ search: async () => false });
  const response = await limited.app.request("/api/search?q=hello");
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: "rate limited" });
  let calls = 0;
  const cached = fixture({
    me: async () => {
      calls++;
      return {
        email: "test@example.com",
        name: null,
        avatar: null,
        dm: "dm000000000000000000aa",
        requests: [],
        sent: [],
        invites: [],
        people: [],
        books: [],
        friends: [],
        waits: [],
        v: "current",
        cached: true,
      };
    },
  });
  const me = await cached.app.request("/api/me");
  expect(me.status).toBe(200);
  expect(await me.json()).toMatchObject({ v: "current", cached: true });
  expect(calls).toBe(1);
});

test("personal event contracts decode raw ws-me data and retain the literal new-message flag", () => {
  for (const notice of [
    { t: "me" },
    { t: "me", book: "room", msg: 1 },
    { t: "agents", book: "*" },
  ] as const) {
    expect(parsePersonEvent(encodeCall(notice))).toEqual(notice);
    expect(PersonEventSchema.safeParse(notice).success).toBe(true);
  }
  for (const value of [
    null,
    {},
    new Uint8Array([1]),
    "pong",
    "{",
    "[]",
    "null",
    encodeCall({ t: "agents" }),
    encodeCall({ t: "me", msg: 2 }),
    encodeCall({ t: "me", book: 3 }),
    encodeCall({ t: "unknown" }),
  ])
    expect(parsePersonEvent(value)).toBeNull();
  expect(parsePersonEvent(encodeCall({ t: "me", extra: "ignored" }))).toEqual({
    t: "me",
  });
  // The old tagged frame is not a JSON-RPC notification.
  expect(parsePersonEvent('{"t":"me"}')).toBeNull();
});

test("avatar and room icon: same origin, type, size and rate limits keep their old answers", async () => {
  const f = fixture();
  const send = (path: string, type: string, body: BodyInit, origin?: string) =>
    f.app.request(path, {
      method: "POST",
      headers: { "content-type": type, ...(origin ? { origin } : {}) },
      body,
    });
  const png = new Uint8Array([137, 80, 78, 71]);
  expect(await (await send("/api/me/avatar", "image/png", png)).json()).toEqual(
    { ok: true, avatar: 7 },
  );
  expect(f.saved).toContainEqual({ table: "avatar", value: "image/png:4" });
  expect((await send("/api/me/avatar", "image/svg+xml", png)).status).toBe(415);
  expect(
    (await send("/api/me/avatar", "image/png", new Uint8Array(0))).status,
  ).toBe(413);
  expect(
    (await send("/api/me/avatar", "image/png", new Uint8Array(1_000_001)))
      .status,
  ).toBe(413);
  const crossSite = fixture({ sameOrigin: false });
  expect(
    (
      await crossSite.app.request("/api/me/avatar", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: png,
      })
    ).status,
  ).toBe(403);
  const limited = fixture({ allowUpload: async () => false });
  expect(
    (
      await limited.app.request("/api/me/avatar", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: png,
      })
    ).status,
  ).toBe(429);
  expect(
    await (await send("/api/books/room/icon", "image/png", png)).json(),
  ).toEqual({ ok: true, icon: 9 });
  expect(
    await (await send("/api/books/room/icon", "application/json", "{}")).json(),
  ).toEqual({ ok: true, icon: null });
  const bad = await send("/api/books/room/icon", "image/bmp", png);
  expect([bad.status, await bad.json()]).toEqual([
    400,
    { error: "Use PNG, JPEG, WebP, GIF ou ICO." },
  ]);
  const outsider = fixture({ isMember: async () => false });
  expect(
    (
      await outsider.app.request("/api/books/room/icon", {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: png,
      })
    ).status,
  ).toBe(403);
});

test("global middleware answers (401 signed out, 403 cross-site) are typed by globalFailure", async () => {
  const { globalFailure } = await import("../web/lib/client/api");
  const { CROSS_SITE, UNAUTHENTICATED } = await import("../shared/schemas");
  expect(globalFailure({ status: 401 }, UNAUTHENTICATED)).toEqual({
    status: 401,
    error: "unauthenticated",
  });
  expect(globalFailure({ status: 403 }, CROSS_SITE)).toEqual({
    status: 403,
    error: "cross-site request refused",
  });
  expect(globalFailure({ status: 401 }, "<html>")).toEqual({
    status: 401,
    error: "HTTP 401",
  });
  expect(globalFailure({ status: 200 }, {})).toBeNull();
  expect(globalFailure({ status: 404 }, { error: "not found" })).toBeNull();
});

test("raw-body adapters (icon, avatar) go through the typed routes and check the answers", async () => {
  const { createRoomApi, createAccountApi } =
    await import("../web/app/transport");
  const f = fixture();
  const fetcher = (input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(
      f.app.request(input instanceof Request ? input : String(input), init),
    );
  const room = createRoomApi("room", fetcher);
  const png = new Uint8Array([137, 80, 78, 71]);
  expect(await room.setIcon({ type: "image/png", body: png })).toEqual({
    ok: true,
    icon: 9,
  });
  expect(await room.setIcon(null)).toEqual({ ok: true, icon: null });
  await expect(room.setIcon({ type: "image/bmp", body: png })).rejects.toThrow(
    "Use PNG, JPEG, WebP, GIF ou ICO.",
  );
  const me = createAccountApi(fetcher);
  expect(await me.uploadAvatar({ type: "image/png", body: png })).toEqual({
    ok: true,
    avatar: 7,
  });
  await expect(
    me.uploadAvatar({ type: "image/svg+xml", body: png }),
  ).rejects.toThrow("Use uma imagem PNG, JPEG ou WebP.");
});

test("connected Claudes (OAuth grants): list, revoke a list, revoke one; bad bodies and other origins refused", async () => {
  const { app, json, saved } = fixture();
  const list = await app.request("/api/agents");
  expect(await list.json()).toEqual({
    agents: [
      { id: "g1", client: "vibebook CLI", connected_at: 1, used_at: 2 },
      { id: "g0", client: "Claude", connected_at: 0 },
    ],
    last_used: 2,
  });
  const r = await json("/api/agents/revoke", { ids: ["g0", "g1"] });
  expect(await r.json()).toEqual({ ok: true, removed: 2 });
  expect((await json("/api/agents/revoke", { ids: "g0" })).status).toBe(400);
  expect(
    (await app.request("/api/agents/g1", { method: "DELETE" })).status,
  ).toBe(200);
  expect(saved.filter((x) => x.table === "revoke").map((x) => x.value)).toEqual(
    ["g0,g1", "g1"],
  );
  const cross = fixture({ sameOrigin: false });
  expect((await cross.json("/api/agents/revoke", { ids: ["g0"] })).status).toBe(
    403,
  );
  expect(
    (await cross.app.request("/api/agents/g0", { method: "DELETE" })).status,
  ).toBe(403);
  expect(cross.saved).toHaveLength(0);
});

test("consent context: the page's facts and handle, the binding cookie passed on, refusals with the client's redirect", async () => {
  const { app } = fixture();
  const r = await app.request("/api/authorize/context?client_id=c");
  expect(r.status).toBe(200);
  expect(r.headers.get("set-cookie")).toContain("__Host-oauth-consent-x=y");
  expect(r.headers.get("cache-control")).toBe("no-store");
  expect((await r.json()).handle).toBe("h1");
  const refused = fixture({
    consentContext: async () => ({
      error: "unsupported_response_type",
      redirect_to: "http://127.0.0.1:9123/cb?error=x",
      status: 400,
    }),
  });
  const e = await refused.app.request("/api/authorize/context?client_id=c");
  expect(e.status).toBe(400);
  expect(await e.json()).toEqual({
    error: "unsupported_response_type",
    redirect_to: "http://127.0.0.1:9123/cb?error=x",
  });
  expect(e.headers.get("set-cookie")).toBeNull();
});

test("router A/B stats: the person's numbers, one room only for its members", async () => {
  const { app } = fixture();
  const all = await app.request("/api/router/stats");
  expect(all.status).toBe(200);
  const body = await all.json();
  expect(body.arms.jev.p50).toBe(300);
  expect(body.recent).toHaveLength(1);
  expect(
    (await (await app.request("/api/router/stats?room=r1")).json()).recent,
  ).toEqual([]);
  const outsider = fixture({ isMember: async () => false });
  expect((await outsider.app.request("/api/router/stats?room=r1")).status).toBe(
    403,
  );
});

test("model spend: only in the report rooms, for their members", async () => {
  const { app } = fixture();
  const r = await app.request("/api/metrics/ai-spend?room=report");
  expect(r.status).toBe(200);
  expect((await r.json()).openrouter_key.usage).toBe(12.34);
  expect((await app.request("/api/metrics/ai-spend?room=other")).status).toBe(
    403,
  );
  expect((await app.request("/api/metrics/ai-spend")).status).toBe(403);
  const outsider = fixture({ isMember: async () => false });
  expect(
    (await outsider.app.request("/api/metrics/ai-spend?room=report")).status,
  ).toBe(403);
});

test("infra monitor: only in the report rooms, for their members, 7/14/30 days", async () => {
  const { app } = fixture();
  const r = await app.request("/api/metrics/infra?room=report&days=30");
  expect(r.status).toBe(200);
  expect((await r.json()).window).toBe(30);
  expect(
    (await (await app.request("/api/metrics/infra?room=report")).json()).window,
  ).toBe(7);
  expect(
    (await app.request("/api/metrics/infra?room=report&days=90")).status,
  ).toBe(400);
  expect((await app.request("/api/metrics/infra?room=other")).status).toBe(403);
  const outsider = fixture({ isMember: async () => false });
  expect(
    (await outsider.app.request("/api/metrics/infra?room=report")).status,
  ).toBe(403);
});

test("room sandbox presence normalizes nullable and malformed SQLite metadata without changing membership or row order", async () => {
  const { Database } = await import("bun:sqlite");
  const db = new Database(":memory:");
  try {
    db.run(
      "CREATE TABLE sandboxes (id TEXT PRIMARY KEY, email TEXT, book_id TEXT, name TEXT, state TEXT, run_s INTEGER, rate REAL, disk_rate REAL, checked_at INTEGER, created_at INTEGER)",
    );
    db.run(
      "INSERT INTO sandboxes VALUES ('bad','owner@test','room',X'0102',NULL,'broken',0,0,0,NULL), ('null','owner@test','room',NULL,NULL,NULL,NULL,NULL,NULL,NULL), ('valid','owner@test','room','valid','paused',0,0,0,0,0), (NULL,'owner@test','room','missing','paused',0,0,0,0,0), ('private','other@test','other','private','running',0,0,0,0,0)",
    );
    const rows = db
      .query(
        "SELECT id,email,name,state,run_s,rate,disk_rate,checked_at,created_at FROM sandboxes WHERE book_id='room' ORDER BY created_at",
      )
      .all();
    const queries: { sql: string; values: (string | number | null)[] }[] = [];
    const f = fixture({
      sqlAll: async (sql, ...values) => {
        queries.push({ sql, values });
        return sql.includes("FROM sandboxes")
          ? rows
          : sql.includes("SELECT claude_on")
            ? [{ claude_on: 0 }]
            : [];
      },
    });
    const response = await f.app.request("/api/books/room/agents");
    expect(response.status).toBe(200);
    const { AgentsResult } = await import("../shared/schemas");
    const value = AgentsResult.parse(await response.json());
    expect(value.sandboxes.map((row: { id: string }) => row.id)).toEqual([
      "bad",
      "null",
      "valid",
    ]);
    expect(value.sandboxes[0]).toMatchObject({
      name: null,
      run_s: null,
      created_at: null,
      cost_unknown: true,
    });
    expect(value.sandboxes[1]).toMatchObject({
      name: null,
      run_s: null,
      created_at: null,
      cost_unknown: true,
    });
    expect(value.sandboxes[2]).toMatchObject({
      name: "valid",
      run_s: 0,
      rate: 0,
      disk_rate: 0,
      checked_at: 0,
      created_at: 0,
      cost_unknown: false,
    });
    expect(
      queries.find((query) => query.sql.includes("FROM sandboxes"))?.values,
    ).toEqual(["room"]);
    expect(
      queries.find((query) => query.sql.includes("SELECT claude_on"))?.values,
    ).toEqual(["room", "test@example.com"]);
    const outsider = fixture({
      sqlAll: async (sql) => (sql.includes("SELECT claude_on") ? [] : rows),
    });
    expect((await outsider.app.request("/api/books/room/agents")).status).toBe(
      403,
    );
  } finally {
    db.close();
  }
});

test("personal focus notices retain their validated room and reject malformed wire data", () => {
  expect(parsePersonEvent(encodeCall({ t: "focus", book: "room" }))).toEqual({
    t: "focus",
    book: "room",
  });
  for (const value of [
    encodeCall({ t: "focus", book: 1 }),
    encodeCall({ t: "focus" }),
    new Uint8Array([1]),
  ])
    expect(parsePersonEvent(value)).toBeNull();
});

test("new card presentation props survive normalization and bounded runtime DTO validation", async () => {
  const { cardOf, CardSchema } = await import("../shared/card");
  const value = cardOf(
    {
      root: "c",
      elements: {
        c: { type: "Card", children: ["chart", "fields", "link"] },
        chart: {
          type: "Chart",
          props: {
            labels: ["one", "two"],
            series: [
              { name: "first", values: [0, "2"] },
              { name: "second", values: [3, 4] },
            ],
          },
        },
        fields: { type: "Fields", children: ["field"] },
        field: {
          type: "Field",
          props: {
            label: "Errors",
            value: "0",
            delta: "-100%",
            good: "down",
            trend: "3 · 2 · 0",
          },
        },
        link: {
          type: "LinkButton",
          props: { label: "Open", url: "#m1", style: "primary" },
        },
      },
    },
    "room",
  );
  expect(CardSchema.parse(value)).toEqual(value);
  expect(value.elements.chart.props).toMatchObject({
    labels: ["one", "two"],
    series: [
      { name: "first", values: [0, 2] },
      { name: "second", values: [3, 4] },
    ],
  });
  expect(value.elements.field.props).toMatchObject({
    delta: "-100%",
    good: "down",
    trend: "3 · 2 · 0",
  });
  expect(value.elements.link.props).toMatchObject({ style: "primary" });
  const chart = value.elements.chart;
  if (chart.type !== "Chart" || !("series" in chart.props))
    throw Error("series projection lost");
  expect(
    CardSchema.safeParse({
      ...value,
      elements: {
        ...value.elements,
        chart: {
          ...chart,
          props: {
            ...chart.props,
            series: [
              ...chart.props.series,
              ...chart.props.series,
              ...chart.props.series,
            ],
          },
        },
      },
    }).success,
  ).toBe(false);
  expect(
    CardSchema.safeParse({
      ...value,
      elements: {
        ...value.elements,
        chart: { ...chart, props: { ...chart.props, labels: ["one"] } },
      },
    }).success,
  ).toBe(false);
  const old = cardOf(
    {
      root: "c",
      elements: {
        c: { type: "Card", children: ["chart"] },
        chart: {
          type: "Chart",
          props: { data: [{ label: "zero", value: 0 }] },
        },
      },
    },
    "room",
  );
  expect(old.elements.chart.props).toMatchObject({
    data: [{ label: "zero", value: 0 }],
  });
});

test("focus relay authorizes the requested room before emitting a person-channel notice", async () => {
  const pokes: string[] = [],
    checked: string[] = [];
  const f = fixture({
    isMember: async (id) => {
      checked.push(id);
      return id === "owned-room";
    },
    pokeFocus: (id) => {
      pokes.push(id);
    },
  });
  const allowed = await f.app.request("/api/books/owned-room/focus", {
    method: "POST",
  });
  expect(allowed.status).toBe(200);
  expect(await allowed.json()).toEqual({ ok: true });
  const refused = await f.app.request("/api/books/private-room/focus", {
    method: "POST",
  });
  expect(refused.status).toBe(403);
  expect(await refused.json()).toEqual({ error: "forbidden" });
  expect(checked).toEqual(["owned-room", "private-room"]);
  expect(pokes).toEqual(["owned-room"]);
});

test("retired Fire endpoint cannot toggle membership or hand off runner cursors", async () => {
  let transcriptions = 0;
  let membershipReads = 0;
  const f = fixture({
    isMember: async () => {
      membershipReads++;
      return true;
    },
    transcribe: async () => {
      transcriptions++;
      return { ok: true, text: "unexpected" };
    },
  });
  for (const body of [{ on: true }, { on: false }, { text: "old live mode" }])
    expect((await f.json("/api/books/room/fire", body)).status).toBe(404);
  expect(f.writes).toEqual([]);
  expect(membershipReads).toBe(0);
  expect(transcriptions).toBe(0);
});

test("STT real handlers bound raw audio, gate membership/rate, and validate responses", async () => {
  const calls: unknown[] = [],
    f = fixture({
      transcribe: async (audio, query) => {
        calls.push({ audio: [...audio], query });
        return { ok: true, text: "words" };
      },
    });
  const answer = await f.app.request(
    "/api/books/room/stt?lang=pt&lang=en&prompt=names",
    { method: "POST", body: new Uint8Array([1, 2]) },
  );
  expect(answer.status).toBe(200);
  expect(await answer.json()).toEqual({ ok: true, text: "words" });
  expect(calls).toEqual([
    { audio: [1, 2], query: { lang: "pt", prompt: "names" } },
  ]);
  for (const audio of [new Uint8Array(), new Uint8Array(4_000_001)])
    expect(
      (
        await f.app.request("/api/books/room/stt", {
          method: "POST",
          body: audio,
        })
      ).status,
    ).toBe(400);
  expect(calls).toHaveLength(1);
  for (const [overrides, status] of [
    [{ isMember: async () => false }, 403],
    [{ allowStt: async () => false }, 429],
  ] as const) {
    const denied = fixture({
      ...overrides,
      transcribe: async () => {
        throw Error("unexpected AI");
      },
    });
    expect(
      (
        await denied.app.request("/api/books/room/stt", {
          method: "POST",
          body: new Uint8Array([1]),
        })
      ).status,
    ).toBe(status);
  }
  for (const result of [
    null,
    { ok: true, text: 7 },
    { ok: false, error: "provider" },
  ]) {
    const invalid = fixture({ transcribe: async () => result });
    expect(
      (
        await invalid.app.request("/api/books/room/stt", {
          method: "POST",
          body: new Uint8Array([1]),
        })
      ).status,
    ).toBe(502);
  }
});

test("STT never publishes a late result after membership loss, while provider errors remain502 for members", async () => {
  for (const removed of [false, true])
    for (const throws of [false, true]) {
      let member = true;
      const f = fixture({
        isMember: async () => member,
        transcribe: async () => {
          member = !removed;
          if (throws) throw Error("provider failed");
          return { ok: true, text: "secret speech" };
        },
      });
      const response = await f.app.request("/api/books/room/stt", {
        method: "POST",
        body: new Uint8Array([1]),
      });
      expect(response.status).toBe(removed ? 403 : throws ? 502 : 200);
      if (removed)
        expect(await response.json()).toEqual({
          ok: false,
          error: "forbidden",
        });
    }
});

test("personal channel ignores retired live Fire events and retains focus/agent notices", () => {
  for (const value of [
    { t: "fire", book: "room", on: true },
    { t: "fire", book: "room", on: false },
    ...["switching", "ready", "off", "failed"].map((state) => ({
      t: "fireState",
      book: "room",
      state,
    })),
  ])
    expect(parsePersonEvent(encodeCall(value))).toBe(null);
  for (const t of ["focus", "agents"] as const)
    expect(parsePersonEvent(encodeCall({ t, book: "room" }))).toEqual({
      t,
      book: "room",
    });
});

test("binary handlers stop chunked and falsely small-length uploads at their actual byte limits", async () => {
  for (const length of [undefined, "1"])
    for (const item of [
      {
        path: "/api/books/room/files",
        type: "text/plain",
        maximum: 4,
        status: 413,
      },
      {
        path: "/api/me/avatar",
        type: "image/png",
        maximum: 1_000_000,
        status: 413,
      },
      {
        path: "/api/books/room/icon",
        type: "image/png",
        maximum: 256_000,
        status: 400,
      },
    ]) {
      let pulls = 0,
        canceled = 0;
      const stream = new ReadableStream<Uint8Array>(
        {
          pull(controller) {
            pulls++;
            if (pulls === 1) controller.enqueue(new Uint8Array(item.maximum));
            else if (pulls === 2) controller.enqueue(new Uint8Array([1]));
            else throw Error("Oversized body must not be drained");
          },
          cancel() {
            canceled++;
          },
        },
        { highWaterMark: 0 },
      );
      const f = fixture();
      const response = await f.app.request(item.path, {
        method: "POST",
        headers: {
          "content-type": item.type,
          ...(length ? { "content-length": length } : {}),
        },
        body: stream,
      });
      expect(response.status).toBe(item.status);
      expect(await response.json()).toHaveProperty("error");
      expect(pulls).toBe(2);
      expect(canceled).toBe(1);
      expect(f.uploaded).toHaveLength(0);
      expect(f.saved).toHaveLength(0);
    }
});

test("declared oversized upload is canceled before reading and icon removal does not buffer JSON", async () => {
  for (const item of [
    {
      path: "/api/books/room/files",
      type: "text/plain",
      length: "5",
      status: 413,
    },
    {
      path: "/api/me/avatar",
      type: "image/png",
      length: "1000001",
      status: 413,
    },
    {
      path: "/api/books/room/icon",
      type: "image/png",
      length: "256001",
      status: 400,
    },
    {
      path: "/api/books/room/icon",
      type: "application/json",
      length: "999999999",
      status: 200,
    },
  ]) {
    let pulls = 0,
      canceled = 0;
    const stream = new ReadableStream<Uint8Array>(
      {
        pull() {
          pulls++;
          throw Error("Body must not be read");
        },
        cancel() {
          canceled++;
        },
      },
      { highWaterMark: 0 },
    );
    const f = fixture();
    const response = await f.app.request(item.path, {
      method: "POST",
      headers: { "content-type": item.type, "content-length": item.length },
      body: stream,
    });
    expect(response.status).toBe(item.status);
    expect(pulls).toBe(0);
    expect(canceled).toBe(1);
    if (item.type === "application/json")
      expect(await response.json()).toEqual({ ok: true, icon: null });
    else {
      expect(f.uploaded).toHaveLength(0);
      expect(f.saved).toHaveLength(0);
    }
  }
});

test("agents reads actual SQLite nullable/invalid Claude flags without truthy-string coercion", async () => {
  const { Database } = await import("bun:sqlite"),
    db = new Database(":memory:");
  db.exec("CREATE TABLE membership(claude_on INTEGER)");
  try {
    for (const [stored, expected] of [
      [0, false],
      [1, true],
      [null, false],
      ["0", false],
      ["false", false],
    ] as const) {
      db.exec("DELETE FROM membership");
      // INTEGER affinity converts TEXT '0' to numeric zero; a CAST expression
      // models a genuine text scalar returned by legacy/coerced SQL producers.
      db.query("INSERT INTO membership VALUES(?)").run(stored);
      const rows =
        stored === "0"
          ? db
              .query(
                "SELECT CAST(claude_on AS TEXT) AS claude_on FROM membership",
              )
              .all()
          : db.query("SELECT claude_on FROM membership").all();
      const f = fixture({
        sqlAll: async (sql) => (sql.includes("SELECT claude_on") ? rows : []),
      });
      const response = await f.app.request("/api/books/room/agents");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        claude_on: expected,
        agents: [],
        sandboxes: [],
      });
    }
    const denied = fixture({ sqlAll: async () => [] });
    expect((await denied.app.request("/api/books/room/agents")).status).toBe(
      403,
    );
  } finally {
    db.close();
  }
});

test("upload revocation during the real body read cannot reach storage", async () => {
  let member = true;
  const f = fixture({ isMember: async () => member });
  const stream = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        controller.enqueue(new Uint8Array([1]));
        member = false;
        controller.close();
      },
    },
    { highWaterMark: 0 },
  );
  const response = await f.app.request("/api/books/room/files", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: stream,
  });
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: "forbidden" });
  expect(f.uploaded).toHaveLength(0);
});

test("upload errors recheck actual membership rather than interpreting a provider's forbidden text", async () => {
  for (const removed of [false, true]) {
    let member = true;
    const f = fixture({
      isMember: async () => member,
      storeFile: async () => {
        member = !removed;
        throw Error("forbidden");
      },
    });
    const response = await f.app.request("/api/books/room/files", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "a",
    });
    expect(response.status).toBe(removed ? 403 : 400);
    expect(await response.json()).toEqual({ error: "forbidden" });
  }
});

function identityFixture() {
  let row: StoredConnection | null = {
    id: "cid",
    book_id: "room",
    owner: "owner@example.test",
    scope: "room",
    url: "https://remote.example/mcp",
    title: "Remote",
    enc: null,
    iv: null,
    tools: "[]",
    ctx: null,
    created_at: 1,
  };
  let member = true,
    signedIn = false,
    allowed = true;
  const signed: { room: string; url: string }[] = [],
    tracked: string[] = [];
  const ports: ConnectionIdentityPorts = {
    email: "reader@example.test",
    member: async () => member,
    connection: async () => row,
    allowed: async () => allowed,
    signedIn: async () => signedIn,
    sign: async (room, url) => {
      signed.push({ room, url });
      return "signed-public-identity";
    },
    track: (_room, url) => {
      tracked.push(url);
    },
  };
  return {
    ports,
    signed,
    tracked,
    setRow: (value: StoredConnection | null) => {
      row = value;
    },
    row: () => row,
    setMember: (value: boolean) => {
      member = value;
    },
    setSignedIn: (value: boolean) => {
      signedIn = value;
    },
    setAllowed: (value: boolean) => {
      allowed = value;
    },
  };
}

test("identity uses only authorized stored destination and never exports token or OAuth credentials", async () => {
  const direct = identityFixture();
  expect(await connectionIdentity("room", "cid", direct.ports)).toEqual({
    direct: true,
    url: "https://remote.example/mcp",
    identity: "signed-public-identity",
    expires_in: 300,
  });
  expect(direct.signed).toEqual([
    { room: "room", url: "https://remote.example/mcp" },
  ]);
  const oauth = identityFixture();
  oauth.setSignedIn(true);
  expect(await connectionIdentity("room", "cid", oauth.ports)).toEqual({
    direct: false,
    why: "signed_in",
  });
  expect(oauth.signed).toEqual([]);
  expect(oauth.tracked).toEqual([]);
});

test("identity refuses private, missing, nonmember and rate-limited connections before signing", async () => {
  for (const kind of ["private", "missing", "nonmember", "rate"] as const) {
    const f = identityFixture(),
      row = f.row();
    if (!row) throw Error("missing fixture");
    if (kind === "private") f.setRow({ ...row, scope: "me" });
    if (kind === "missing") f.setRow(null);
    if (kind === "nonmember") f.setMember(false);
    if (kind === "rate") f.setAllowed(false);
    const result = await connectionIdentity("room", "cid", f.ports);
    expect("error" in result ? result.status : null).toBe(
      kind === "rate" ? 429 : kind === "nonmember" ? 403 : 404,
    );
    expect(f.signed).toEqual([]);
    expect(f.tracked).toEqual([]);
  }
});

test("identity rechecks membership after final connection lookup and after grant lookup", async () => {
  for (const phase of ["connection", "grant"] as const) {
    const f = identityFixture();
    let reads = 0;
    const read = f.ports.connection;
    if (phase === "connection")
      f.ports.connection = async (...args) => {
        const row = await read(...args);
        if (++reads === 5) f.setMember(false);
        return row;
      };
    else
      f.ports.signedIn = async () => {
        f.setMember(false);
        return false;
      };
    expect(await connectionIdentity("room", "cid", f.ports)).toEqual({
      error: "forbidden",
      status: 403,
    });
    expect(f.tracked).toEqual([]);
  }
});

test("late signing cannot export a JWT after removal, retargeting, or new credential authority", async () => {
  for (const kind of [
    "member",
    "removed",
    "url",
    "owner",
    "signed_in",
  ] as const) {
    const f = identityFixture(),
      row = f.row();
    if (!row) throw Error("missing fixture");
    f.ports.sign = async () => {
      if (kind === "member") f.setMember(false);
      else if (kind === "removed") f.setRow(null);
      else if (kind === "url")
        f.setRow({ ...row, url: "https://other.example/mcp" });
      else if (kind === "owner")
        f.setRow({ ...row, owner: "new@example.test" });
      else f.setSignedIn(true);
      return "must-not-be-exported";
    };
    const result = await connectionIdentity("room", "cid", f.ports);
    expect("identity" in result).toBe(false);
    expect(f.tracked).toEqual([]);
    if (kind === "signed_in")
      expect(result).toEqual({ direct: false, why: "signed_in" });
  }
});

test("inferred identity handler enforces room gate and emits only checked no-store replies", async () => {
  for (const result of [
    {
      direct: true,
      url: "https://mcp.example/mcp",
      identity: "signed-identity",
      expires_in: 300,
    },
    { direct: false, why: "signed_in" },
  ] as const) {
    const f = fixture();
    f.svc.connections.identity = async () => result;
    const response = await f.app.request(
      "/api/books/room/connections/c1/identity",
      { method: "POST" },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(result);
  }
  const denied = fixture({ isMember: async () => false });
  denied.svc.connections.identity = async () => {
    throw Error("identity service must not run without membership");
  };
  const response = await denied.app.request(
    "/api/books/room/connections/c1/identity",
    { method: "POST" },
  );
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("no-store");
});

test("historical encrypted columns are inert while per-person OAuth is checked for every identity decision", async () => {
  for (const signedIn of [false, true]) {
    const f = identityFixture(),
      row = f.row();
    if (!row) throw Error("missing fixture row");
    f.setRow({
      ...row,
      enc: "historical-ciphertext-never-read",
      iv: "historical-iv-never-read",
    });
    let lookups = 0;
    f.ports.signedIn = async (url) => {
      expect(url).toBe(row.url);
      lookups++;
      return signedIn;
    };
    const result = await connectionIdentity("room", "cid", f.ports);
    expect(lookups).toBeGreaterThan(0);
    expect(result).toEqual(
      signedIn
        ? { direct: false, why: "signed_in" }
        : {
            direct: true,
            url: row.url,
            identity: "signed-public-identity",
            expires_in: 300,
          },
    );
    expect("enc" in result || "iv" in result || "token" in result).toBe(false);
    expect(f.signed.length).toBe(signedIn ? 0 : 1);
  }
});

test("historical encrypted-column cleanup during signing does not change viewer authority", async () => {
  const f = identityFixture(),
    row = f.row();
  if (!row) throw Error("missing fixture row");
  f.setRow({ ...row, enc: "old-encrypted-data", iv: "old-iv" });
  f.ports.sign = async () => {
    f.setRow({ ...row, enc: null, iv: null });
    return "current-viewer-proof";
  };
  expect(await connectionIdentity("room", "cid", f.ports)).toEqual({
    direct: true,
    url: row.url,
    identity: "current-viewer-proof",
    expires_in: 300,
  });
});

test("API-local metadata and database validators retain optional/null and uncoerced input contracts", () => {
  expect(
    UploadHeaders.parse({
      "content-type": "text/plain",
      "x-filename": "report%20one.txt",
      ignored: true,
    }),
  ).toEqual({ "content-type": "text/plain", "x-filename": "report%20one.txt" });
  expect(UploadHeaders.parse({ "content-type": "text/plain" })).toEqual({
    "content-type": "text/plain",
  });
  for (const invalid of [
    {},
    { "content-type": 7 },
    { "content-type": "text/plain", "x-filename": null },
  ])
    expect(UploadHeaders.safeParse(invalid).success).toBe(false);
  const row = {
    email: "exact DB text",
    who: null,
    repo: null,
    seen_at: null,
    listening_at: null,
    listen_room: null,
    ctx_tokens: null,
    ctx_window: null,
    ctx_at: null,
    ctx_limits: null,
    id: "s_x",
    client: null,
    machine_id: null,
    delivers: null,
  };
  expect(AgentDbRow.parse({ ...row, ignored: true })).toEqual(row);
  expect(AgentDbRow.safeParse({ ...row, seen_at: "1" }).success).toBe(false);
  expect(AgentDbRow.safeParse({ ...row, email: null }).success).toBe(false);
  const incomplete: Record<string, unknown> = { ...row };
  delete incomplete.ctx_tokens;
  expect(AgentDbRow.safeParse(incomplete).success).toBe(false);
  expect(AgentDbRow.shape.who).toBe(AgentDbRow.shape.repo);
  expect(AgentDbRow.shape.seen_at).toBe(AgentDbRow.shape.ctx_tokens);
});

test("writing to someone opens the DM, sends a request, or is rate-limited; invites take a yes", async () => {
  const f = fixture();
  const open = await f.json("/api/friends", {
    email: "Member@test.com",
    text: "oi",
  });
  expect(open.status).toBe(200);
  expect(await open.json()).toEqual({ ok: true, id: "dm00000000000000000001" });
  const request = await f.json("/api/friends", { email: "stranger@test.com" });
  expect(request.status).toBe(200);
  expect(await request.json()).toEqual({ ok: true });
  expect(
    (await f.json("/api/friends", { email: "limited@test.com" })).status,
  ).toBe(429);
  expect((await f.json("/api/friends", { email: "nope" })).status).toBe(400);
  const gone = await f.app.request("/api/friends/x%40test.com", {
    method: "DELETE",
  });
  expect(gone.status).toBe(200);
  expect((await f.json("/api/books/aaaaaa/invite", { yes: true })).status).toBe(
    200,
  );
  expect(
    (await f.json("/api/books/bbbbbb/invite", { yes: false })).status,
  ).toBe(404);
  expect((await f.json("/api/books/aaaaaa/invite", { yes: "y" })).status).toBe(
    400,
  );
});

test("the call routes are members-only, off without an SFU app, and say when the screen budget is spent", async () => {
  const json = (body: unknown) => ({
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const on = fixture();
  const joined = await on.app.request("/api/books/room/call/join", {
    method: "POST",
  });
  expect([joined.status, await joined.json()]).toEqual([
    200,
    { session: "s1" },
  ]);
  const off = await fixture({ callsOn: false }).app.request(
    "/api/books/room/call/join",
    { method: "POST" },
  );
  expect(off.status).toBe(404);
  const outsider = fixture({ isMember: async () => false });
  for (const path of ["join", "tracks", "answer", "close"]) {
    const refused = await outsider.app.request(
      `/api/books/room/call/${path}`,
      json({ session: "s1", mids: [], answer: { type: "answer", sdp: "v=0" } }),
    );
    expect([path, refused.status]).toEqual([path, 403]);
  }
  const spent = fixture({ callTracks: async () => "limit" });
  const screen = await spent.app.request(
    "/api/books/room/call/tracks",
    json({
      session: "s1",
      offer: { type: "offer", sdp: "v=0" },
      push: [{ mid: "1", name: "screen" }],
    }),
  );
  expect([screen.status, await screen.json()]).toEqual([
    409,
    { error: "call screen limit" },
  ]);
  // A session of someone else: the room refuses it (Book.callCheck).
  const stolen = await fixture({ callAnswer: async () => false }).app.request(
    "/api/books/room/call/answer",
    json({ session: "s2", answer: { type: "answer", sdp: "v=0" } }),
  );
  expect(stolen.status).toBe(403);
  const malformed = await on.app.request(
    "/api/books/room/call/tracks",
    json({ session: "bad session!" }),
  );
  expect(malformed.status).toBe(400);
});

test("leave: a member takes themself out; the owner and a DM can't; tracked as book_left", async () => {
  const removed: { room: string; who: string }[] = [];
  const tracked: { name: string; dims?: Record<string, unknown> }[] = [];
  const f = fixture({
    // The real removeMember refuses the owner with a 400 (src/services.ts).
    removeMember: async (room, who) => {
      if (room === "owned")
        return { error: "O dono não pode ser removido.", status: 400 };
      removed.push({ room, who });
      return null;
    },
    track: (name, dims) => void tracked.push({ name, dims }),
  });
  const left = await f.json("/api/books/room/leave", {});
  expect(left.status).toBe(200);
  expect(await left.json()).toEqual({ ok: true });
  expect(removed).toEqual([{ room: "room", who: "test@example.com" }]);
  expect(tracked).toEqual([{ name: "book_left", dims: { book: "room" } }]);
  const owner = await f.json("/api/books/owned/leave", {});
  expect(owner.status).toBe(400);
  expect(await owner.json()).toEqual({
    error: "O dono não pode ser removido.",
  });
  const dm = await f.json("/api/books/dm000000000000000000aa/leave", {});
  expect(dm.status).toBe(400);
  expect(removed).toHaveLength(1);
  expect(tracked).toHaveLength(1);
  const outsider = fixture({
    isMember: async () => false,
    removeMember: async (room, who) => {
      removed.push({ room, who });
      return null;
    },
  });
  expect((await outsider.json("/api/books/room/leave", {})).status).toBe(403);
  expect(removed).toHaveLength(1);
});
