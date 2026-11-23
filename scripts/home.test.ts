// Pure owners/protocol fixtures. These assertions do not represent Worker or browser acceptance.
import { expect, test } from "bun:test";
import { get } from "svelte/store";
import { waitCount } from "../web/features/waits/model";
import { tabTitle } from "../web/features/notifications/title";
import { avatarKey, avatarUrl } from "../shared/avatar";
import { dmPeer, roomAvatarVersion } from "../web/features/room-scope/model";
import type { Room } from "../shared/room";
type PersonalSocketFixture = {
  readyState: WebSocket["readyState"];
  onopen: WebSocket["onopen"];
  onmessage: WebSocket["onmessage"];
  onclose: WebSocket["onclose"];
  close(): void;
};
import { createHomeApi } from "../web/features/home/api";
import {
  byImportance,
  fanClasses,
  fanSize,
  fanSlot,
  inFan,
} from "../web/features/home/deskHand";
import { createPersonalSession } from "../web/features/home/personal";
import {
  createHomeSession,
  createNewRoomSession,
  createArchivedSession,
} from "../web/features/home/session";
import { createRoomsSession } from "../web/features/rooms/session";
import { createSearchSession } from "../web/features/app-navigation/search";
import {
  createApplicationRouter,
  applicationRoute,
} from "../web/features/app-navigation/router";
import {
  plainWaitText,
  waitKind,
  orderedRooms,
  recentRooms,
  unread,
  waitTarget,
  targetHref,
  roomMatches,
  waitGroups,
  dmEntries,
  titleOwnDm,
  personVersion,
  roomLabel,
  roomStatus,
} from "../web/features/home/model";
import {
  contacts,
  matchContacts,
} from "../web/features/app-navigation/contacts";
import {
  deferred,
  homeApi,
  manualClock,
  me,
  room,
  settle,
  suggestion,
} from "./home-fixtures";

test("desktop placement and mobile recency remain distinct and unread respects seen highwater", () => {
  const rooms = [
    room("aaaaaa", { position: 2, opened_at: 90 }),
    room("bbbbbb", { position: 0, opened_at: 10 }),
    room("cccccc", { created_at: 1, opened_at: 100 }),
  ];
  expect(orderedRooms(rooms).map((r) => r.id)).toEqual([
    "bbbbbb",
    "aaaaaa",
    "cccccc",
  ]);
  expect(recentRooms(rooms).map((r) => r.id)).toEqual([
    "cccccc",
    "aaaaaa",
    "bbbbbb",
  ]);
  expect(rooms[0]?.id).toBe("aaaaaa");
  expect(unread(room("aaaaaa", { last_human_id: 5, last_agent_id: 9 }))).toBe(
    "human",
  );
  expect(
    unread(room("aaaaaa", { last_human_id: 5, last_agent_id: 9 }), 5),
  ).toBe("agent");
  expect(
    unread(room("aaaaaa", { last_human_id: 5, last_agent_id: 9 }), 9),
  ).toBe(null);
  expect(roomMatches([room("aaaaaa", { title: "Ação" })], "acao")).toHaveLength(
    1,
  );
});
test("wait links preserve numeric message identity and task thread navigation", () => {
  const wait = {
    book_id: "aaaaaa",
    room: "Room",
    ref: "a42",
    thread: "epic-1",
    topic: null,
    author: "a@test.com",
    author_name: null,
    text: "Please",
    ts: 1,
  };
  expect(targetHref(waitTarget(wait))).toBe("/b/aaaaaa?t=epic-1#m42");
  expect(waitTarget({ ...wait, ref: "t42" })).toEqual({
    roomId: "aaaaaa",
    thread: "epic-1",
    messageId: undefined,
  });
  expect(
    applicationRoute("https://vb.test/b/aaaaaa#m9007199254740993"),
  ).toMatchObject({ kind: "room", target: { messageId: undefined } });
  expect(applicationRoute("https://vb.test/b/aaaaaa?t=epic-1#m42")).toEqual({
    kind: "room",
    target: {
      roomId: "aaaaaa",
      thread: "epic-1",
      messageId: 42,
      fileId: undefined,
      document: false,
    },
  });
});
test("invalidated in-flight Me cannot replace canonical state and coalesces refresh", async () => {
  const timer = manualClock(),
    old = deferred<ReturnType<typeof me>>();
  let reads = 0;
  const personal = createPersonalSession(
    homeApi({
      me: () =>
        ++reads === 1 ? old.promise : Promise.resolve(me({ name: "New" })),
    }),
    { clock: timer.clock },
  );
  const first = personal.refresh();
  personal.invalidate();
  personal.invalidate();
  timer.advance(600);
  expect(reads).toBe(1);
  old.resolve(me({ name: "Old" }));
  await first;
  await settle();
  expect(reads).toBe(2);
  expect(get(personal.state).me?.name).toBe("New");
  personal.dispose();
  expect(timer.jobs.size).toBe(0);
});
test("ensure skips Me only while the person socket pushes and the account data is recent", async () => {
  const timer = manualClock();
  let reads = 0;
  const personal = createPersonalSession(
    homeApi({
      me: () => {
        reads++;
        return Promise.resolve(me({}));
      },
    }),
    { clock: timer.clock },
  );
  personal.setPushed(true);
  personal.ensure();
  await settle();
  expect(reads).toBe(1);
  personal.ensure();
  await settle();
  expect(reads).toBe(1);
  // An open socket that delivers nothing (after sleep) cannot keep old data for more than a minute.
  const now = Date.now;
  Date.now = () => now() + 61_000;
  try {
    personal.ensure();
    await settle();
    expect(reads).toBe(2);
  } finally {
    Date.now = now;
  }
  personal.setPushed(false);
  personal.ensure();
  await settle();
  expect(reads).toBe(3);
  personal.dispose();
});
test("account identity clears drafts and cancels older agents responses", async () => {
  const timer = manualClock(),
    agents =
      deferred<Awaited<ReturnType<ReturnType<typeof homeApi>["agents"]>>>();
  let next = me();
  const personal = createPersonalSession(
    homeApi({ me: async () => next, agents: () => agents.promise }),
    { clock: timer.clock },
  );
  await personal.refresh();
  personal.editAsk("private draft");
  personal.editCreate("private room");
  const request = personal.refreshAgents();
  next = me({ email: "other@test.com" });
  await personal.refresh();
  agents.resolve({ agents: [], last_used: 42 });
  await request;
  expect(get(personal.draft)).toEqual({ ask: "", create: "", unknown: null });
  expect(get(personal.state).agents).toBe(null);
  personal.dispose();
});
test("Me timeout unlocks explicit retry and a late old result cannot steal it", async () => {
  const timer = manualClock(),
    late = deferred<ReturnType<typeof me>>();
  let reads = 0;
  const personal = createPersonalSession(
    homeApi({
      me: () =>
        ++reads === 1 ? late.promise : Promise.resolve(me({ name: "Retry" })),
    }),
    { clock: timer.clock },
  );
  const first = personal.refresh();
  timer.advance(20_000);
  expect(get(personal.state).error).toBe("unconfirmed");
  await personal.refresh();
  late.resolve(me({ name: "Late" }));
  await first;
  expect(get(personal.state).me?.name).toBe("Retry");
  personal.dispose();
});
test("route suggestions are owned by their exact draft and page; edits invalidate late suggestions", async () => {
  const timer = manualClock(),
    late = deferred<typeof suggestion>(),
    personal = createPersonalSession(homeApi({ route: () => late.promise }), {
      clock: timer.clock,
    });
  await personal.refresh();
  const navigated: unknown[] = [];
  const session = createHomeSession(
    personal,
    (t) => navigated.push(t),
    timer.clock,
  );
  session.edit("old request");
  const request = session.suggest();
  session.edit("new request");
  late.resolve(suggestion);
  await request;
  expect(get(session.state).result).toBe(null);
  expect(get(personal.draft).ask).toBe("new request");
  expect(navigated).toEqual([]);
  session.dispose();
  personal.dispose();
});
test("successful routing posts once to selected epic and disposal preserves draft without stale navigation", async () => {
  const timer = manualClock(),
    posted = deferred<{ ok: true; id: number; thread: string }>();
  let writes = 0;
  const personal = createPersonalSession(
    homeApi({
      post: async (id, text, thread) => {
        expect([id, text, thread]).toEqual(["aaaaaa", "hello", "epic-1"]);
        writes++;
        return posted.promise;
      },
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const navigated: unknown[] = [];
  const session = createHomeSession(
    personal,
    (t) => navigated.push(t),
    timer.clock,
  );
  session.edit("hello");
  await session.suggest();
  const pending = session.send();
  session.send();
  session.dispose();
  posted.resolve({ ok: true, id: 12, thread: "epic-1" });
  await pending;
  expect(writes).toBe(1);
  expect(navigated).toEqual([]);
  expect(get(personal.draft).ask).toBe("hello");
  personal.dispose();
});
test("new-room close/remount cannot consume account draft or navigate after old response", async () => {
  const timer = manualClock(),
    created = deferred<{
      id: string;
      unknown: string[];
      invited: string[];
      cost: number;
    }>(),
    personal = createPersonalSession(
      homeApi({ startRoom: () => created.promise }),
      { clock: timer.clock },
    );
  await personal.refresh();
  const navigated: unknown[] = [];
  const creator = createNewRoomSession(
    personal,
    (t) => navigated.push(t),
    timer.clock,
  );
  creator.open();
  creator.edit("room request");
  const pending = creator.submit();
  creator.close();
  creator.open();
  creator.edit("new request");
  created.resolve({ id: "bbbbbb", unknown: ["Someone"], invited: [], cost: 0 });
  await pending;
  expect(navigated).toEqual([]);
  expect(get(personal.draft).create).toBe("new request");
  expect(get(personal.draft).unknown).toBe(null);
  creator.dispose();
  personal.dispose();
});
test("post-ACK stale cache and collaborator reversal remain pending, then unconfirmed, without mutation retries", async () => {
  const timer = manualClock();
  let tint: string | null = null,
    writes = 0;
  const personal = createPersonalSession(
    homeApi({
      me: async () => me({ books: [room("aaaaaa", { tint })] }),
      tint: async () => {
        writes++;
        return { ok: true };
      },
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock);
  await rooms.tint("aaaaaa", "blue");
  await settle();
  expect(get(rooms.state).pending["tint:aaaaaa"]).toBe(true);
  tint = "green";
  personal.invalidate();
  timer.advance(600);
  await settle();
  expect(get(rooms.state).pending["tint:aaaaaa"]).toBe(true);
  timer.advance(10_000);
  await settle();
  expect(get(rooms.state).issues["tint:aaaaaa"]).toBe("unconfirmed");
  expect(writes).toBe(1);
  tint = "blue";
  await rooms.tint("aaaaaa", "blue");
  await settle();
  expect(get(rooms.state).pending["tint:aaaaaa"]).toBeUndefined();
  expect(get(rooms.state).issues["tint:aaaaaa"]).toBeUndefined();
  expect(writes).toBe(2);
  rooms.dispose();
  personal.dispose();
});
test("canonical archive removal before late HTTP rejection does not resurrect or error", async () => {
  const timer = manualClock(),
    ack = deferred<{ ok: true }>();
  let books = [room()];
  const personal = createPersonalSession(
    homeApi({ me: async () => me({ books }), archive: () => ack.promise }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock),
    request = rooms.archive("aaaaaa");
  books = [];
  await personal.refresh();
  ack.reject(Error("late rejection"));
  await request;
  expect(get(rooms.state)).toEqual({ pending: {}, issues: {} });
  expect(get(personal.state).me?.books).toEqual([]);
  rooms.dispose();
  personal.dispose();
});
test("search debounce/close ignores stale remote results while local room targets remain usable", async () => {
  const timer = manualClock(),
    late = deferred<{ rooms: number; epics: []; messages: [] }>(),
    personal = createPersonalSession(homeApi({ search: () => late.promise }), {
      clock: timer.clock,
    });
  await personal.refresh();
  const navigate: unknown[] = [],
    search = createSearchSession(
      personal,
      (t) => navigate.push(t),
      timer.clock,
    );
  search.open();
  search.edit("Room");
  timer.advance(250);
  search.close();
  late.resolve({ rooms: 99, epics: [], messages: [] });
  await settle();
  expect(get(search.state).result).toBe(null);
  search.open();
  search.activate();
  expect(navigate).toEqual([{ roomId: "aaaaaa" }]);
  search.dispose();
  personal.dispose();
});
test("room→Home→Back activates room lifecycle and same-room targets avoid reconnect", () => {
  let href = "https://vb.test/b/aaaaaa";
  const entries = [href],
    activated: string[] = [],
    same: unknown[] = [];
  let cleanup = 0;
  const history = {
    pushState(_state: unknown, _unused: string, value?: string | URL | null) {
      href = new URL(String(value), href).href;
      entries.push(href);
    },
    replaceState(
      _state: unknown,
      _unused: string,
      value?: string | URL | null,
    ) {
      href = new URL(String(value), href).href;
      entries[entries.length - 1] = href;
    },
  };
  const router = createApplicationRouter({
    current: () => href,
    history,
    activate: (r) => activated.push(r.kind),
    beforeChange: () => {
      cleanup++;
    },
    sameRoom: (t) => {
      same.push(t);
      return false;
    },
    consumePop: () => false,
    document: () => {
      throw Error("unexpected document navigation");
    },
  });
  router.go("/");
  expect(activated).toEqual(["home"]);
  entries.pop();
  href = entries[0]!;
  router.pop();
  expect(activated).toEqual(["home", "room"]);
  expect(same).toEqual([
    {
      roomId: "aaaaaa",
      thread: "main",
      messageId: undefined,
      fileId: undefined,
      document: false,
    },
  ]);
  expect(cleanup).toBe(2);
  expect(router.generation()).toBe(2);
  const connected = createApplicationRouter({
    current: () => href,
    history,
    activate: () => {
      throw Error("same-room navigation must retain transport");
    },
    beforeChange: () => {},
    sameRoom: (target) => target.roomId === "aaaaaa",
    consumePop: () => false,
    document: () => {
      throw Error("unexpected document");
    },
  });
  connected.go({ roomId: "aaaaaa", thread: "epic-2", messageId: 44 });
  expect(href).toContain("t=epic-2");
  expect(href).toContain("#m44");
});
test("typed HTTP client rejects malformed successful data and preserves HTTP errors", async () => {
  const invalid = createHomeApi(
    async () => new Response(JSON.stringify({ books: [] })),
  );
  await expect(invalid.me()).rejects.toThrow();
  const refused = createHomeApi(
    async () =>
      new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
  );
  await expect(refused.archived()).rejects.toThrow("forbidden");
});

test("restore waits for canonical Archived absence and exposes bounded explicit recovery", async () => {
  const timer = manualClock();
  let archived = true,
    writes = 0;
  const archivedRoom = {
    id: "aaaaaa",
    title: "Room",
    folder: null,
    summary: null,
    updated_at: 1,
    archived_at: 2,
    members: null,
  };
  const personal = createPersonalSession(
      homeApi({
        archived: async () => ({ books: archived ? [archivedRoom] : [] }),
        archive: async () => {
          writes++;
          return { ok: true };
        },
      }),
      { clock: timer.clock },
    ),
    session = createArchivedSession(personal, timer.clock);
  await session.load();
  await session.restore("aaaaaa");
  await settle();
  expect(get(session.state).books).toHaveLength(1);
  expect(get(session.state).pending).toBe("aaaaaa");
  timer.advance(10_000);
  await settle();
  expect(get(session.state).error).toBe("unconfirmed");
  expect(writes).toBe(1);
  archived = false;
  await session.restore("aaaaaa");
  await settle();
  expect(get(session.state).books).toEqual([]);
  expect(get(session.state).pending).toBe(null);
  expect(writes).toBe(2);
  session.dispose();
  personal.dispose();
});
test("only asks resolve, and obsolete room mutation responses cannot survive account reset", async () => {
  const timer = manualClock(),
    late = deferred<{ ok: true }>();
  let writes = 0;
  const wait = {
    book_id: "aaaaaa",
    room: "Room",
    ref: "t12",
    thread: "epic-1",
    topic: null,
    author: "a@test.com",
    author_name: null,
    text: "Task",
    ts: 1,
  };
  const personal = createPersonalSession(
    homeApi({
      me: async () => me({ waits: [wait] }),
      resolve: async () => {
        writes++;
        return { ok: true };
      },
      tint: () => late.promise,
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock);
  rooms.resolve("aaaaaa", "t12");
  expect(writes).toBe(0);
  const pending = rooms.tint("aaaaaa", "blue");
  rooms.reset();
  late.resolve({ ok: true });
  await pending;
  expect(get(rooms.state)).toEqual({ pending: {}, issues: {} });
  expect(timer.jobs.size).toBeLessThanOrEqual(1);
  rooms.dispose();
  personal.dispose();
});

test("personal socket ignores replaced/disposed callbacks and current-room message-only invalidations", async () => {
  const { createPersonalConnection } =
    await import("../web/features/home/connection");
  const timer = manualClock();
  let account = 0,
    agents = 0,
    visible = 0,
    unlistened = false;
  let visibility = () => {};
  function socket(): PersonalSocketFixture & { message(data: unknown): void } {
    return {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      close() {
        this.readyState = 3;
      },
      message(data: unknown) {
        if (this.onmessage) Reflect.apply(this.onmessage, this, [{ data }]);
      },
    };
  }
  const sockets: ReturnType<typeof socket>[] = [],
    connection = createPersonalConnection({
      url: () => "wss://vb.test/ws-me",
      decode: (raw) =>
        typeof raw === "object" &&
        raw !== null &&
        "kind" in raw &&
        raw.kind === "account"
          ? {
              kind: "account",
              book: "aaaaaa",
              message: "message" in raw && raw.message === true,
            }
          : raw === "agents"
            ? { kind: "agents", book: "*" }
            : null,
      onAccount: () => {
        account++;
      },
      onAgents: () => {
        agents++;
      },
      onVisible: () => {
        visible++;
      },
      currentRoom: () => "aaaaaa",
      visible: () => true,
      listenVisibility: (callback) => {
        visibility = callback;
        return () => {
          unlistened = true;
        };
      },
      createSocket: () => {
        const value = socket();
        sockets.push(value);
        return value;
      },
      clock: timer.clock,
    });
  connection.start();
  connection.start();
  expect(sockets).toHaveLength(1);
  sockets[0]!.message({ kind: "account", message: true });
  expect(account).toBe(0);
  sockets[0]!.message({ kind: "account" });
  expect(account).toBe(1);
  connection.restart();
  sockets[0]!.message({ kind: "account" });
  sockets[1]!.message("agents");
  expect(account).toBe(1);
  expect(agents).toBe(1);
  connection.dispose();
  visibility();
  sockets[1]!.message("agents");
  expect(visible).toBe(0);
  expect(agents).toBe(1);
  expect(unlistened).toBe(true);
  expect(timer.jobs.size).toBe(0);
});

test("routed send uses the canonical posted thread and clears only its unchanged draft", async () => {
  const timer = manualClock(),
    personal = createPersonalSession(
      homeApi({
        post: async () => ({ ok: true, id: 44, thread: "canonical-epic" }),
      }),
      { clock: timer.clock },
    );
  await personal.refresh();
  const navigated: unknown[] = [],
    session = createHomeSession(
      personal,
      (target) => navigated.push(target),
      timer.clock,
    );
  session.edit("hello");
  await session.suggest();
  await session.send();
  expect(navigated).toEqual([{ roomId: "aaaaaa", thread: "canonical-epic" }]);
  expect(get(personal.draft).ask).toBe("");
  session.dispose();
  personal.dispose();
});

test("remote restoration before HTTP rejection is authoritative and obsoletes its pending callback", async () => {
  const timer = manualClock(),
    ack = deferred<{ ok: true }>();
  let archived = true;
  const archivedRoom = {
    id: "aaaaaa",
    title: "Room",
    folder: null,
    summary: null,
    updated_at: 1,
    archived_at: 2,
    members: null,
  };
  const personal = createPersonalSession(
      homeApi({
        archived: async () => ({ books: archived ? [archivedRoom] : [] }),
        archive: () => ack.promise,
      }),
      { clock: timer.clock },
    ),
    session = createArchivedSession(personal, timer.clock);
  await session.load();
  const request = session.restore("aaaaaa");
  archived = false;
  await session.load();
  ack.reject(Error("late rejected mutation"));
  await request;
  expect(get(session.state).books).toEqual([]);
  expect(get(session.state).pending).toBe(null);
  expect(get(session.state).error).toBe("");
  session.dispose();
  personal.dispose();
});

test("room identity fences the first Me race and obsolete identity cannot publish cached private data", async () => {
  const timer = manualClock(),
    late = deferred<ReturnType<typeof me>>();
  let reads = 0,
    changes = 0;
  const personal = createPersonalSession(
    homeApi({
      me: () =>
        ++reads === 1
          ? late.promise
          : Promise.resolve(me({ email: "b@test.com" })),
    }),
    {
      clock: timer.clock,
      onIdentityChange: () => {
        changes++;
      },
    },
  );
  personal.acceptIdentity("a@test.com");
  personal.editAsk("private A draft");
  const pending = personal.refresh();
  expect(personal.acceptIdentity("b@test.com")).toBe(true);
  expect(get(personal.state).me).toBe(null);
  expect(get(personal.draft).ask).toBe("");
  await personal.refresh();
  late.resolve(me({ email: "a@test.com", name: "Private A" }));
  await pending;
  expect(get(personal.state).me?.email).toBe("b@test.com");
  expect(changes).toBe(1);
  personal.dispose();
});

test("first authenticated room state fences an earlier Me response with unknown account ownership", async () => {
  const timer = manualClock(),
    old = deferred<ReturnType<typeof me>>();
  let reads = 0;
  const personal = createPersonalSession(
    homeApi({
      me: () =>
        ++reads === 1
          ? old.promise
          : Promise.resolve(me({ email: "current@test.com" })),
    }),
    { clock: timer.clock },
  );
  const pending = personal.refresh();
  personal.acceptIdentity("current@test.com");
  await settle();
  old.resolve(
    me({ email: "previous@test.com", name: "Previous private data" }),
  );
  await pending;
  expect(get(personal.state).me?.email).toBe("current@test.com");
  expect(reads).toBe(2);
  personal.dispose();
});

test("account revision synchronously fences routed send before page unmount", async () => {
  const timer = manualClock(),
    posted = deferred<{ ok: true; id: number; thread: string }>();
  let current = me();
  const personal = createPersonalSession(
    homeApi({ me: async () => current, post: () => posted.promise }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const navigated: unknown[] = [],
    home = createHomeSession(
      personal,
      (value) => navigated.push(value),
      timer.clock,
    );
  home.edit("private A request");
  await home.suggest();
  const pending = home.send();
  current = me({ email: "b@test.com" });
  personal.acceptIdentity(current.email);
  personal.editAsk("new B draft");
  expect(get(home.state).result).toBe(null);
  home.edit("stale A callback");
  home.suggest();
  posted.resolve({ ok: true, id: 99, thread: "epic-1" });
  await pending;
  await settle();
  expect(get(personal.draft).ask).toBe("new B draft");
  expect(navigated).toEqual([]);
  home.dispose();
  personal.dispose();
});
test("account revision clears Archived cache and fences late restore before page unmount", async () => {
  const timer = manualClock(),
    restored = deferred<{ ok: true }>();
  let current = me(),
    reads = 0;
  const book = {
    id: "aaaaaa",
    title: "Private A",
    folder: null,
    summary: null,
    updated_at: 1,
    archived_at: 2,
    members: null,
  };
  const personal = createPersonalSession(
    homeApi({
      me: async () => current,
      archived: async () => {
        reads++;
        return { books: [book] };
      },
      archive: () => restored.promise,
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const archive = createArchivedSession(personal, timer.clock);
  await archive.load();
  const pending = archive.restore(book.id);
  current = me({ email: "b@test.com" });
  personal.acceptIdentity(current.email);
  expect(get(archive.state).books).toEqual([]);
  restored.resolve({ ok: true });
  await pending;
  await archive.load();
  timer.advance(10_000);
  await settle();
  expect(reads).toBe(1);
  expect(get(archive.state).pending).toBe(null);
  expect(get(archive.state).error).toBe("");
  archive.dispose();
  personal.dispose();
});
test("account revision closes create and search owners without relying on host callback", async () => {
  const timer = manualClock(),
    created = deferred<{
      id: string;
      unknown: string[];
      invited: string[];
      cost: number;
    }>(),
    searched = deferred<{ rooms: number; epics: []; messages: [] }>();
  let current = me();
  const personal = createPersonalSession(
    homeApi({
      me: async () => current,
      startRoom: () => created.promise,
      search: () => searched.promise,
    }),
    { clock: timer.clock },
  );
  await personal.refresh();
  const navigation: unknown[] = [],
    creator = createNewRoomSession(
      personal,
      (target) => navigation.push(target),
      timer.clock,
    ),
    search = createSearchSession(
      personal,
      (target) => navigation.push(target),
      timer.clock,
    );
  creator.open();
  creator.edit("A room");
  const pending = creator.submit();
  search.open();
  search.edit("private A");
  timer.advance(250);
  current = me({ email: "b@test.com" });
  personal.acceptIdentity(current.email);
  personal.editCreate("B room");
  created.resolve({ id: "aaaaaa", unknown: [], invited: [], cost: 0 });
  searched.resolve({ rooms: 1, epics: [], messages: [] });
  await pending;
  await settle();
  expect(get(personal.draft).create).toBe("B room");
  expect(get(creator.state).open).toBe(false);
  expect(get(search.state).query).toBe("");
  expect(get(search.state).result).toBe(null);
  expect(navigation).toEqual([]);
  creator.dispose();
  search.dispose();
  personal.dispose();
});
test("agent invalidations during a read replay once and do not publish stale grants", async () => {
  const timer = manualClock(),
    old = deferred<{ agents: []; last_used: number | null }>();
  let reads = 0;
  const personal = createPersonalSession(
    homeApi({
      agents: () =>
        ++reads === 1
          ? old.promise
          : Promise.resolve({ agents: [], last_used: 9 }),
    }),
    { clock: timer.clock },
  );
  const pending = personal.refreshAgents();
  personal.observe({ kind: "agents", book: "*" });
  personal.observe({ kind: "agents", book: "aaaaaa" });
  timer.advance(600);
  expect(reads).toBe(1);
  old.resolve({ agents: [], last_used: 1 });
  await pending;
  await settle();
  expect(reads).toBe(2);
  expect(get(personal.state).agents?.last_used).toBe(9);
  personal.dispose();
});
test("room path matching rejects suffixes and encoded separators", () => {
  for (const path of [
    "/b/aaaaaa/extra",
    "/b/aaaaaa%2Fother",
    "/b/aaaaaa-evil",
    "/b/a",
  ])
    expect(applicationRoute("https://vb.test" + path).kind).toBe("document");
  expect(applicationRoute("https://vb.test/b/aaaaaa/").kind).toBe("room");
});
test("each successful personal reconnect reconciles once and old socket open cannot refresh", async () => {
  const { createPersonalConnection } =
    await import("../web/features/home/connection");
  const timer = manualClock();
  let reads = 0;
  function socket(): PersonalSocketFixture & { open(): void; lost(): void } {
    return {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      close() {
        this.readyState = 3;
      },
      open() {
        this.readyState = 1;
        if (this.onopen) Reflect.apply(this.onopen, this, [{}]);
      },
      lost() {
        this.readyState = 3;
        if (this.onclose) Reflect.apply(this.onclose, this, [{}]);
      },
    };
  }
  const sockets: ReturnType<typeof socket>[] = [],
    connection = createPersonalConnection({
      url: () => "wss://vb.test/ws-me",
      onAccount: () => {},
      onAgents: () => {},
      onConnected: () => {
        reads++;
      },
      onVisible: () => {},
      currentRoom: () => null,
      visible: () => true,
      listenVisibility: () => () => {},
      createSocket: () => {
        const next = socket();
        sockets.push(next);
        return next;
      },
      clock: timer.clock,
    });
  connection.start();
  sockets[0]!.open();
  sockets[0]!.open();
  expect(reads).toBe(1);
  sockets[0]!.lost();
  timer.advance(1000);
  sockets[0]!.open();
  expect(reads).toBe(1);
  sockets[1]!.open();
  expect(reads).toBe(2);
  connection.dispose();
  sockets[1]!.open();
  expect(reads).toBe(2);
});

test("agents timeout releases ownership even when aborted transport never settles", async () => {
  const timer = manualClock(),
    old = deferred<{ agents: []; last_used: number | null }>();
  let reads = 0;
  const personal = createPersonalSession(
    homeApi({
      agents: () =>
        ++reads === 1
          ? old.promise
          : Promise.resolve({ agents: [], last_used: 7 }),
    }),
    { clock: timer.clock },
  );
  const pending = personal.refreshAgents();
  timer.advance(20_000);
  await personal.refreshAgents();
  expect(reads).toBe(2);
  expect(get(personal.state).agents?.last_used).toBe(7);
  old.resolve({ agents: [], last_used: 1 });
  await pending;
  expect(get(personal.state).agents?.last_used).toBe(7);
  personal.dispose();
});

test("navigation account reset releases private rename draft and return-focus reference", async () => {
  const { createAppNavigationSession } =
    await import("../web/features/app-navigation/controller");
  const timer = manualClock();
  let current = me({ books: [room("aaaaaa", { title: "Private A title" })] });
  const personal = createPersonalSession(homeApi({ me: async () => current }), {
    clock: timer.clock,
  });
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock),
    controller = createAppNavigationSession(personal, rooms, {
      navigate: () => {},
      home: () => {},
      archived: () => {},
      rename: async () => ({ ok: true }),
    });
  const trigger = { isConnected: true } as HTMLElement;
  controller.syncPath("https://vb.test/b/aaaaaa/");
  controller.openSettings("aaaaaa", trigger);
  controller.askRename("aaaaaa");
  expect(get(controller.state).renameDraft).toBe("Private A title");
  expect(controller.returnFocus(null)).toBe(trigger);
  current = me({ email: "b@test.com" });
  personal.acceptIdentity(current.email);
  expect(get(controller.state).renameDraft).toBe("");
  expect(controller.returnFocus(null)).toBe(null);
  controller.dispose();
  rooms.dispose();
  personal.dispose();
});

test("the one number counts every wait: asks, your Claude's questions and your tasks in review", () => {
  expect(waitCount([{ ref: "t1" }, { ref: "t2" }])).toBe(2);
  expect(
    waitCount([{ ref: "m1" }, { ref: "a2" }, { ref: "b3" }, { ref: "t4" }]),
  ).toBe(4);
  // A refreshed server list after a human reply removes the ask, not their task.
  expect(waitCount([{ ref: "t4" }])).toBe(1);
  expect(waitCount([])).toBe(0);
});

test("a room's tooltip lists the three signals in their order, then the cloud sandbox that has no mark", () => {
  const room = {
    id: "r1",
    last_human_id: 9,
    last_agent_id: 12,
    read_id: 4,
    busy_until: 2_000,
    sandboxes_running: 1,
  } as never;
  expect(
    roomStatus(
      room,
      0,
      [{ ref: "m1" }, { ref: "m2" }, { ref: "t3" }],
      1_000,
      "en",
    ),
  ).toEqual([
    "3 waiting for you",
    "new messages from people",
    "an agent is working here",
    "cloud sandbox running",
  ]);
  expect(
    roomStatus(
      { ...(room as object), last_human_id: 3 } as never,
      0,
      [],
      3_000,
      "pt",
    ),
  ).toEqual(["só agents escreveram", "sandbox na nuvem rodando"]);
});

test("phone triage groups waits by room: a blocked Claude first, then the newest ask", () => {
  const wait = (book_id: string, ref: string, ts: number) => ({
    book_id,
    room: book_id.toUpperCase(),
    ref,
    thread: "main",
    topic: null,
    author: "a@x.dev",
    author_name: null,
    text: ref,
    ts,
  });
  const groups = waitGroups([
    wait("news", "m1", 50),
    wait("news", "t2", 90),
    wait("calm", "m3", 10),
    wait("blocked", "m4", 5),
    wait("blocked", "a5", 1),
  ]);
  expect(groups.map((g) => [g.roomId, g.blocked])).toEqual([
    ["blocked", true],
    ["news", false],
    ["calm", false],
  ]);
  expect(groups[0]?.waits.map((w) => w.ref)).toEqual(["a5", "m4"]);
  expect(groups[1]?.waits.map((w) => w.ref)).toEqual(["t2", "m1"]);
  expect(groups[0]?.title).toBe("BLOCKED");
});

test("home rows: wait text is one plain line and every wait has a filter kind", () => {
  expect(
    plainWaitText(
      "@gimenes spike do **app** pronto: PR https://github.com/eitri-tech/eitri-shopping-monte-carlo/pull/689\n\nolha `?t=epic`",
    ),
  ).toBe(
    "spike do app pronto: PR github.com/eitri-tech/eitri-shopp… olha ?t=epic",
  );
  expect(
    plainWaitText("⏸ Seu Claude pede permissão: Bash · npx wrangler deploy"),
  ).toBe("Bash · npx wrangler deploy");
  expect(plainWaitText("veja [o doc](#m12) e https://vibebook.dev/")).toBe(
    "veja o doc e vibebook.dev",
  );
  const base = {
    book_id: "r",
    room: "R",
    thread: "main",
    topic: null,
    author: "a@x",
    author_name: "A",
    text: "t",
    ts: 1,
  };
  expect(
    ["a1", "b2", "m3", "t4"].map((ref) => waitKind({ ...base, ref })),
  ).toEqual(["claude", "claude", "asks", "reviews"]);
});

const deskWait = (ref: string, ts: number) => ({
  book_id: "aaaaaa",
  room: "Room",
  ref,
  thread: "main",
  topic: null,
  author: "ana@test.com",
  author_name: "Ana",
  text: "Ask " + ref,
  ts,
});
test("desk hand: your Claude first, then asks, then reviews, newest first", () => {
  const order = byImportance([
    deskWait("t1", 50),
    deskWait("m2", 10),
    deskWait("a3", 5),
    deskWait("m4", 40),
    deskWait("b5", 30),
  ]).map((wait) => wait.ref);
  expect(order).toEqual(["b5", "a3", "m4", "m2", "t1"]);
});
test("desk hand: the fan is odd and at most seven", () => {
  expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 12].map(fanSize)).toEqual([
    0, 1, 1, 3, 3, 5, 5, 7, 7, 7,
  ]);
});
test("desk hand: the middle card leads, the rest alternate right and left", () => {
  expect([0, 1, 2, 3, 4, 5, 6].map(fanSlot)).toEqual([0, 1, -1, 2, -2, 3, -3]);
  expect(fanClasses(0, 9)).toContain("z-20");
  expect(fanClasses(1, 9)).toContain("translate-x-[46px]");
  expect(fanClasses(2, 9)).toContain("translate-x-[-46px]");
  // Beyond the seventh, a card waits hidden behind the fan (the grid shows it).
  expect(fanClasses(7, 9)).toContain("opacity-0");
  expect(inFan(6, 9, false)).toBe(true);
  expect(inFan(7, 9, false)).toBe(false);
  // Four waits fan three: the fourth stays behind.
  expect(inFan(3, 4, false)).toBe(false);
  // A phone piles five.
  expect(inFan(4, 9, true)).toBe(true);
  expect(inFan(5, 9, true)).toBe(false);
});
test("DMs: every conversation you've had is listed, named from your rooms' people, newest first", () => {
  const value = me({
    books: [
      room("aaaaaa"),
      room("dm00000000000000000001", {
        dm: 1,
        members: "me@test.com,ana@test.com",
        updated_at: 50,
      }),
      room("dm00000000000000000002", {
        dm: 1,
        members: "me@test.com,stranger@test.com",
        updated_at: 90,
      }),
    ],
    people: [
      { email: "ana@test.com", name: "Ana", avatar: 3, rooms: ["Room aaaaaa"] },
    ],
  });
  const dms = dmEntries(value)!;
  expect(dms.self.self).toBe(true);
  expect(dms.talked.map((dm) => [dm.email, dm.name])).toEqual([
    ["stranger@test.com", "stranger@test.com"],
    ["ana@test.com", "Ana"],
  ]);
  expect(dms.talked[1]!.version).toBe(3);
  expect("untalked" in dms).toBe(false);
});
test("a person's picture URL always carries its version; none without one", () => {
  expect(avatarUrl("ana@test.com", 3)).toBe("/api/avatar/ana%40test.com?v=3");
  expect(avatarUrl("ana@test.com", null)).toBeUndefined();
  expect(avatarUrl("ana@test.com", 0)).toBeUndefined();
});
test("an email names one picture and one face whatever its case or spaces", () => {
  expect(avatarKey(" Ana@Test.COM ")).toBe("ana@test.com");
  expect(avatarUrl("Ana@Test.com", 3)).toBe(avatarUrl("ana@test.com", 3));
});
test("a DM peer you share no room with still gets their name and picture from the DM row", () => {
  const value = me({
    books: [
      room("dm00000000000000000003", {
        dm: 1,
        title: "Me · Bia",
        members: "me@test.com,bia@test.com",
        peer_name: "Bia",
        peer_avatar: 5,
      }),
    ],
  });
  const [bia] = dmEntries(value)!.talked;
  expect([bia!.name, bia!.version]).toEqual(["Bia", 5]);
  expect(personVersion(value, "bia@test.com")).toBe(5);
  // Lists across rooms name a DM after the other person, yours after you.
  expect(roomLabel(value, "dm00000000000000000003", "Me · Bia", "en")).toBe(
    "Bia",
  );
  expect(roomLabel(value, value.dm, "Me", "en")).toBe("You");
  expect(roomLabel(value, "aaaaaa", "Room aaaaaa", "en")).toBe("Room aaaaaa");
});
test("one version rule: yours is your own; anyone else's is the newest any source knows", () => {
  const value = me({
    avatar: 2,
    people: [{ email: "ana@test.com", name: "Ana", avatar: 4, rooms: [] }],
    friends: [
      {
        email: "ana@test.com",
        name: "Ana",
        avatar: 9,
        joined: 1,
        shared: 1,
        dm: "dm00000000000000000004",
      },
    ],
  });
  expect(personVersion(value, "ana@test.com")).toBe(9);
  const scene = (avatars: Record<string, number>) =>
    ({ avatars }) as unknown as Room;
  // The room knows an older picture than your home: the newer wins, both ways.
  expect(
    roomAvatarVersion(scene({ "ana@test.com": 6 }), value, "ana@test.com"),
  ).toBe(9);
  expect(
    roomAvatarVersion(scene({ "ana@test.com": 12 }), value, "ana@test.com"),
  ).toBe(12);
  expect(roomAvatarVersion(null, value, "ana@test.com")).toBe(9);
  expect(
    roomAvatarVersion(scene({}), value, "nobody@test.com"),
  ).toBeUndefined();
  // Yours is always me.avatar, whatever the room says.
  expect(
    roomAvatarVersion(scene({ "me@test.com": 99 }), value, "me@test.com"),
  ).toBe(2);
});
test("a DM's peer: you only in your own DM, never your face for someone else's", () => {
  const dm = (members: string[], isDm = true) =>
    ({ me: "me@test.com", members, book: { dm: isDm } }) as unknown as Room;
  expect(dmPeer(dm(["me@test.com"]))).toBe("me@test.com");
  expect(dmPeer(dm(["me@test.com", "ana@test.com"]))).toBe("ana@test.com");
  expect(dmPeer(dm([]))).toBeUndefined();
  expect(dmPeer(dm(["me@test.com", "ana@test.com"], false))).toBeNull();
});
test("your own DM is titled in the app's language, not the room's; other rooms keep the server's title", () => {
  const own = {
    me: "me@test.com",
    members: ["me@test.com"],
    book: { title: "Você", dm: true },
  };
  expect(titleOwnDm(own, "en").book.title).toBe("You");
  expect(titleOwnDm(own, "pt")).toBe(own);
  const pair = { ...own, members: ["me@test.com", "ana@test.com"] };
  expect(
    titleOwnDm({ ...pair, book: { title: "Ana", dm: true } }, "en").book.title,
  ).toBe("Ana");
  const solo = { ...own, book: { title: "Você", dm: false } };
  expect(titleOwnDm(solo, "en")).toBe(solo);
});
test("new message search: people from your rooms, then connections, accents ignored, never yourself", () => {
  const value = me({
    people: [
      {
        email: "joao@test.com",
        name: "João Silva",
        avatar: null,
        rooms: ["X"],
      },
      { email: "me@test.com", name: "Me", avatar: null, rooms: ["X"] },
    ],
    friends: [
      {
        email: "old@test.com",
        name: "Old Friend",
        avatar: null,
        joined: 1,
        shared: 0,
        dm: "dm00000000000000000003",
      },
      {
        email: "joao@test.com",
        name: "João Silva",
        avatar: null,
        joined: 1,
        shared: 1,
        dm: "dm00000000000000000004",
      },
    ],
  });
  const list = contacts(value);
  expect(list.map((person) => person.email)).toEqual([
    "joao@test.com",
    "old@test.com",
  ]);
  expect(matchContacts(list, "joao si").map((p) => p.email)).toEqual([
    "joao@test.com",
  ]);
  expect(matchContacts(list, "nobody")).toEqual([]);
  expect(matchContacts(list, "")).toHaveLength(2);
});

test("the tab's name starts with the Inbox count, and stays plain when the Inbox is empty", () => {
  expect(tabTitle("deco.chat", 0)).toBe("deco.chat");
  expect(tabTitle("Sala · deco.chat", 3)).toBe("(3) Sala · deco.chat");
  expect(tabTitle("deco.chat", 150)).toBe("(99+) deco.chat");
});

test("the phone's chat list: newest first, and who wrote last before the line", async () => {
  const { chatList, lastLine } = await import("../web/features/home/model");
  const a = room("aaaaaa", {
    updated_at: 100,
    last_by: "me@test.com",
    last_text: "**Oi** [site](https://x.com)",
  });
  const b = room("bbbbbb", {
    updated_at: 300,
    last_by: "ana@test.com",
    last_by_name: "Ana Souza",
    last_text: "Pronto",
  });
  const c = room("cccccc", {
    updated_at: 200,
    last_by: "me@test.com",
    last_agent: 1,
    last_text: "Subi o PR",
  });
  const d = room("dddddd", {
    updated_at: 50,
    last_by: "ai",
    last_text: "Lembrete",
  });
  const e = room("eeeeee", { updated_at: 80, summary: "Sobre o site" });
  const account = me({ books: [a, b, c, d, e] });
  expect(chatList(account).map((row) => row.room.id)).toEqual([
    "bbbbbb",
    "cccccc",
    "aaaaaa",
    "eeeeee",
    "dddddd",
  ]);
  expect(lastLine(a, account, "pt")).toBe("Você: Oi site");
  expect(lastLine(b, account, "en")).toBe("Ana: Pronto");
  expect(lastLine(c, account, "pt")).toBe("Claude: Subi o PR");
  expect(lastLine(d, account, "pt")).toBe("@vibe: Lembrete");
  // No stored line yet (a room from before): its summary.
  expect(lastLine(e, account, "pt")).toBe("Sobre o site");
  // A DM leaves out the other person's name: the row is theirs.
  expect(
    lastLine(b, account, "pt", {
      email: "ana@test.com",
      name: "Ana",
      room: b,
      self: false,
    }),
  ).toBe("Pronto");
});
