import { expect, test } from "bun:test";
import type { Room, RoomEvent } from "../shared/room";
import type { CommandOutcome } from "../shared/commands";
import {
  createRootRoomSession,
  type RootConnection,
  type RootRoomTransition,
  type RootRoomSnapshot,
} from "../web/features/root-room/session";
import type { RoomConnectionOptions } from "../web/app/roomConnection";

const room = (id = "aaaaaa", me = "a@test"): Room => ({
  id,
  me,
  book: { title: id, owner: me },
  members: [me],
  messages: [],
  epics: [],
  typing: {},
  online: [],
  suggestions: [],
});
function snapshot(value: Room): RoomEvent {
  const { id: _id, typing: _typing, ...data } = value;
  return { t: "state", ...data };
}
function harness(
  acceptIdentity: (account: string) => boolean = () => false,
  cacheAllowed: (room: Room) => boolean = () => true,
  older?: Parameters<typeof createRootRoomSession>[0]["older"],
  roomRead?: Parameters<typeof createRootRoomSession>[0]["room"],
) {
  const sockets: {
    callbacks: RoomConnectionOptions;
    connection: RootConnection;
    disposed: number;
    started: number;
    resyncs: number;
    commands: unknown[];
  }[] = [];
  const transitions: RootRoomTransition[] = [],
    opens: RootRoomSnapshot[] = [],
    terminals: RootRoomSnapshot[] = [];
  let outcome: Promise<CommandOutcome> = Promise.resolve({ ok: true });
  const owner = createRootRoomSession({
    url: (id, thread, code, resume, lite) =>
      `${id}/${thread}/${code}${resume ? `/since=${resume.since}` : ""}${lite ? "/lite" : ""}`,
    acceptIdentity,
    cacheAllowed,
    ...(older ? { older } : {}),
    ...(roomRead ? { room: roomRead } : {}),
    onOpen: (value) => opens.push(value),
    onTransition: (value) => transitions.push(value),
    onTerminal: (value) => terminals.push(value),
    connection: (callbacks) => {
      const record: {
        disposed: number;
        started: number;
        resyncs: number;
        commands: unknown[];
      } = { disposed: 0, started: 0, resyncs: 0, commands: [] };
      const connection: RootConnection = {
        start() {
          record.started++;
        },
        dispose() {
          record.disposed++;
        },
        resync() {
          record.resyncs++;
        },
        send(command) {
          record.commands.push(command);
          return true;
        },
        request(command) {
          record.commands.push(command);
          return outcome;
        },
      };
      sockets.push({
        callbacks,
        connection,
        commands: record.commands,
        get disposed() {
          return record.disposed;
        },
        get started() {
          return record.started;
        },
        get resyncs() {
          return record.resyncs;
        },
      });
      return connection;
    },
  });
  return {
    owner,
    sockets,
    transitions,
    opens,
    terminals,
    outcome(value: Promise<CommandOutcome>) {
      outcome = value;
    },
  };
}
test("scroll-back goes over HTTP and lands as the socket's events; a failed read falls back to the socket (cache plan, PR 1)", async () => {
  const asked: unknown[] = [];
  let answer: Awaited<ReturnType<NonNullable<Parameters<typeof harness>[2]>>> =
    {
      thread: "main",
      messages: [
        { id: 3, author: "b@test", text: "old one", ts: 1, thread: "main" },
      ],
      acks: [
        { msg_id: 3, email: "a@test", who: "a@test", status: "done", ts: 2 },
      ],
      more: true,
    };
  const h = harness(
    () => false,
    () => true,
    async (roomId, thread, before) => {
      asked.push({ roomId, thread, before });
      return answer;
    },
  );
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  socket.callbacks.onEvent(snapshot(room()));
  expect(h.owner.send({ t: "older", thread: "main", before: 9 })).toBe(true);
  await Promise.resolve();
  await Promise.resolve();
  expect(asked).toEqual([{ roomId: "aaaaaa", thread: "main", before: 9 }]);
  expect(socket.commands).toEqual([]);
  expect(h.transitions.map((t) => t.event.t).slice(-2)).toEqual([
    "ackRows",
    "older",
  ]);
  expect(h.owner.read().room?.messages.map((m) => m.id)).toEqual([3]);
  // Other commands still use the socket.
  h.owner.send({ t: "call.leave" });
  expect(socket.commands).toEqual([{ t: "call.leave" }]);
  answer = null;
  h.owner.send({ t: "older", thread: "main", before: 3 });
  await Promise.resolve();
  await Promise.resolve();
  expect(socket.commands.at(-1)).toEqual({
    t: "older",
    thread: "main",
    before: 3,
  });
  h.owner.dispose();
});
type StateEvent = Extract<RoomEvent, { t: "state" }>;
const flush = async () => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
test("a light socket reads the room over HTTP on hello; events that come before it are applied after it", async () => {
  const asked: unknown[] = [];
  const answers: ((state: StateEvent | null) => void)[] = [];
  const h = harness(
    () => false,
    () => true,
    undefined,
    (roomId, thread, resume) => {
      asked.push({ roomId, thread, resume });
      return new Promise((resolve) => answers.push(resolve));
    },
  );
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  expect(socket.callbacks.url("")).toBe("aaaaaa/main//lite");
  socket.callbacks.onEvent({ t: "hello", at: 1 });
  expect(asked).toEqual([
    { roomId: "aaaaaa", thread: "main", resume: undefined },
  ]);
  const message = (id: number, text: string) => ({
    id,
    author: "b@test",
    text,
    ts: id,
    thread: "main",
  });
  // Live events while the read is on its way: they wait, nothing is drawn yet.
  socket.callbacks.onEvent({ t: "msg", m: message(5, "in the state too") });
  socket.callbacks.onEvent({ t: "msg", m: message(7, "after the state") });
  socket.callbacks.onEvent({ t: "msgEdit", id: 5, text: "edited", edited: 9 });
  socket.callbacks.onEvent({ t: "online", online: ["a@test", "b@test"] });
  expect(h.owner.read().room).toBeNull();
  expect(h.owner.read().phase).toBe("loading");
  expect(h.transitions).toHaveLength(0);
  answers[0]!({
    ...(snapshot({
      ...room(),
      messages: [message(5, "in the state too")],
    }) as StateEvent),
    at: 100,
    eh: "h1",
  });
  await flush();
  const live = h.owner.read();
  expect(live.phase).toBe("live");
  expect(h.transitions.map((t) => t.event.t)).toEqual([
    "state",
    "msg",
    "msg",
    "msgEdit",
    "online",
  ]);
  expect(live.room?.messages.map((m) => [m.id, m.text])).toEqual([
    [5, "edited"],
    [7, "after the state"],
  ]);
  expect(live.room?.online).toEqual(["a@test", "b@test"]);
  // After the state, events apply at once.
  socket.callbacks.onEvent({ t: "msg", m: message(8, "live") });
  expect(h.owner.read().room?.messages.at(-1)?.id).toBe(8);
  // A reconnect resumes over HTTP with the params this socket was opened with; an answer of an older hello is dropped.
  expect(socket.callbacks.url("1006")).toBe("aaaaaa/main/1006/since=8/lite");
  socket.callbacks.onEvent({ t: "hello", at: 2 });
  socket.callbacks.onEvent({ t: "hello", at: 3 });
  expect(asked.at(-1)).toEqual({
    roomId: "aaaaaa",
    thread: "main",
    resume: { since: 8, at: 100, eh: "h1" },
  });
  answers[1]!(snapshot(room()) as StateEvent);
  await flush();
  expect(h.transitions).toHaveLength(6);
  h.owner.dispose();
});
test("a failed HTTP read of the room reconnects without lite, and that socket's state applies as before", async () => {
  let reads = 0;
  const h = harness(
    () => false,
    () => true,
    undefined,
    async () => {
      reads++;
      return null;
    },
  );
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  socket.callbacks.onEvent({ t: "hello", at: 1 });
  socket.callbacks.onEvent({ t: "online", online: ["a@test"] });
  await flush();
  expect(reads).toBe(1);
  expect(socket.resyncs).toBe(1);
  expect(socket.callbacks.url("1000")).toBe("aaaaaa/main/1000");
  // A stray hello does not read again; the socket's state is the room.
  socket.callbacks.onEvent({ t: "hello", at: 2 });
  await flush();
  expect(reads).toBe(1);
  socket.callbacks.onEvent(snapshot(room()));
  expect(h.owner.read().phase).toBe("live");
  expect(h.transitions.map((t) => t.event.t)).toEqual(["state"]);
  h.owner.dispose();
});
test("cache first paint is distinct from authoritative reconnect state and cannot mark reads", () => {
  const h = harness();
  h.owner.open("aaaaaa");
  const first = h.sockets[0]!;
  first.callbacks.onEvent(snapshot({ ...room(), filesAll: true, filesN: 18 }));
  expect(h.owner.read().phase).toBe("live");
  expect(h.owner.read().snapshotGeneration).toBe(1);
  h.owner.leave();
  h.owner.open("aaaaaa");
  expect(h.owner.read().phase).toBe("cached");
  expect(h.owner.read().snapshotGeneration).toBe(0);
  h.sockets[1]!.callbacks.onEvent(
    snapshot({ ...room(), filesAll: false, filesN: 18, files: [] }),
  );
  const transition = h.transitions.at(-1)!;
  expect(transition.previous?.filesAll).toBe(true);
  expect(transition.snapshot.room?.filesAll).toBe(false);
  expect(transition.snapshot.snapshotGeneration).toBe(1);
  h.owner.dispose();
});
test("departed room callbacks, terminal failures and pending command outcomes cannot own a replacement", async () => {
  const h = harness();
  let resolve!: (result: CommandOutcome) => void;
  h.outcome(
    new Promise((done) => {
      resolve = done;
    }),
  );
  h.owner.open("aaaaaa");
  const old = h.sockets[0]!;
  old.callbacks.onEvent(snapshot(room()));
  const request = h.owner.request({ t: "title", title: "old" });
  h.owner.open("bbbbbb");
  old.callbacks.onEvent(snapshot(room()));
  old.callbacks.onRemoved();
  old.callbacks.onUnavailable();
  resolve({ ok: true });
  expect(await request).toEqual({ ok: false, error: "disconnected" });
  expect(h.owner.read().roomId).toBe("bbbbbb");
  expect(h.terminals).toHaveLength(0);
  expect(h.transitions).toHaveLength(1);
  h.owner.dispose();
});
test("access loss clears preview authority and cache before notification and is idempotent", () => {
  const h = harness();
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  socket.callbacks.onEvent(snapshot(room()));
  socket.callbacks.onRemoved();
  socket.callbacks.onRemoved();
  expect(h.owner.read().room).toBeNull();
  expect(h.owner.read().connection).toBeNull();
  expect(h.terminals).toHaveLength(1);
  expect(h.terminals[0]!.phase).toBe("removed");
  h.owner.open("aaaaaa");
  expect(h.owner.read().phase).toBe("loading");
  h.owner.dispose();
});
test("unknown epic patch requests resync without applying or publishing fabricated state", () => {
  const h = harness();
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  socket.callbacks.onEvent(snapshot(room()));
  const before = h.owner.read();
  socket.callbacks.onEvent({
    t: "epicsPatch",
    order: ["missing"],
    changed: [],
  });
  expect(socket.resyncs).toBe(1);
  expect(h.owner.read()).toBe(before);
  expect(h.transitions).toHaveLength(1);
  h.owner.dispose();
});
test("typing notes are transient and a fresh state owns a new partial snapshot generation", () => {
  const h = harness();
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  socket.callbacks.onEvent(snapshot(room()));
  socket.callbacks.onEvent({
    t: "typing",
    id: 2,
    mode: "fast",
    note: "working",
  });
  expect(h.owner.read().typingNotes.get(2)).toBe("working");
  socket.callbacks.onEvent(snapshot(room()));
  expect(h.owner.read().typingNotes.size).toBe(0);
  expect(h.owner.read().snapshotGeneration).toBe(2);
  h.owner.dispose();
});
test("synchronous identity replacement prevents a foreign state from entering caches or transitions", () => {
  let reset = () => {};
  const h = harness((email) => {
    if (email === "b@test") {
      reset();
      return true;
    }
    return false;
  });
  reset = () => h.owner.resetAccount();
  h.owner.open("aaaaaa");
  h.sockets[0]!.callbacks.onEvent(snapshot(room()));
  h.sockets[0]!.callbacks.onEvent(snapshot(room("aaaaaa", "b@test")));
  expect(h.owner.read().room).toBeNull();
  expect(h.transitions).toHaveLength(1);
  h.owner.open("aaaaaa");
  expect(h.owner.read().phase).toBe("loading");
  h.owner.dispose();
});
test("cache retains newest twelve room snapshots, evicts nonmember metadata, and respects selected thread URLs", () => {
  const h = harness();
  for (let index = 0; index < 13; index++) {
    const id = `room${index}`;
    h.owner.open(id);
    h.sockets[index]!.callbacks.onEvent(snapshot(room(id)));
  }
  h.owner.open("room0");
  expect(h.owner.read().phase).toBe("loading");
  h.owner.open("room12");
  expect(h.owner.read().phase).toBe("cached");
  h.owner.selectThread("pre:0");
  expect(h.sockets.at(-1)!.callbacks.url("1006")).toBe("room12/main/1006");
  h.sockets
    .at(-1)!
    .callbacks.onEvent(snapshot({ ...room("room12"), members: [] }));
  h.owner.leave();
  h.owner.open("room12");
  expect(h.owner.read().phase).toBe("loading");
  h.owner.dispose();
});
test("reentrant navigation during leave publication wins without starting an abandoned connection", () => {
  const h = harness();
  let armed = false;
  const stop = h.owner.state.subscribe((value) => {
    if (armed && value.phase === "idle") {
      armed = false;
      h.owner.open("bbbbbb");
    }
  });
  armed = true;
  h.owner.open("aaaaaa");
  expect(h.owner.read().roomId).toBe("bbbbbb");
  expect(h.sockets).toHaveLength(1);
  expect(h.sockets[0]!.started).toBe(1);
  stop();
  h.owner.dispose();
});
test("canonical nonmember state and members frames revoke active authority before any private publication", async () => {
  for (const firstState of [false, true]) {
    const h = harness();
    h.owner.open("aaaaaa");
    const socket = h.sockets[0]!;
    if (!firstState) socket.callbacks.onEvent(snapshot(room()));
    const published: RootRoomSnapshot[] = [];
    const stop = h.owner.state.subscribe((value) => published.push(value));
    const before = h.transitions.length;
    socket.callbacks.onEvent(
      firstState
        ? snapshot({
            ...room(),
            book: { title: "must not publish", owner: "a@test" },
            members: [],
          })
        : { t: "members", members: [], pending: [] },
    );
    expect(h.owner.read().phase).toBe("removed");
    expect(h.owner.read().room).toBeNull();
    expect(h.owner.read().connection).toBeNull();
    expect(
      published.some(
        (value) => value.room && !value.room.members.includes(value.room.me),
      ),
    ).toBe(false);
    expect(h.transitions).toHaveLength(before);
    expect(h.terminals).toHaveLength(1);
    expect(socket.disposed).toBe(1);
    expect(h.owner.send({ t: "title", title: "forbidden" })).toBe(false);
    expect(await h.owner.request({ t: "title", title: "forbidden" })).toEqual({
      ok: false,
      error: "offline",
    });
    socket.callbacks.onEvent(snapshot(room()));
    socket.callbacks.onRemoved();
    expect(h.owner.read().room).toBeNull();
    expect(h.terminals).toHaveLength(1);
    stop();
    h.owner.open("aaaaaa");
    expect(h.owner.read().phase).toBe("loading");
    h.owner.dispose();
  }
});
test("terminal observer navigation cannot let the departed terminal adapter clear its replacement", () => {
  const h = harness();
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  socket.callbacks.onEvent(snapshot(room()));
  let replace = true;
  const stop = h.owner.state.subscribe((value) => {
    if (replace && value.phase === "removed") {
      replace = false;
      h.owner.open("bbbbbb");
    }
  });
  socket.callbacks.onEvent({ t: "members", members: [], pending: [] });
  expect(h.owner.read().roomId).toBe("bbbbbb");
  expect(h.owner.read().phase).toBe("loading");
  expect(h.terminals).toHaveLength(0);
  expect(h.sockets[1]!.started).toBe(1);
  socket.callbacks.onRemoved();
  expect(h.owner.read().roomId).toBe("bbbbbb");
  stop();
  h.owner.dispose();
});
test("denied feature authority prevents private cache reinsertion before public room publication", () => {
  let allowed = true;
  const h = harness(
    () => false,
    () => allowed,
  );
  h.owner.open("aaaaaa");
  const socket = h.sockets[0]!;
  socket.callbacks.onEvent(snapshot(room()));
  allowed = false;
  const stop = h.owner.state.subscribe((value) => {
    if (value.phase === "live" && value.room?.book.title === "changed") {
      h.owner.open("aaaaaa");
    }
  });
  socket.callbacks.onEvent({ t: "meta", title: "changed" });
  expect(h.owner.read().phase).toBe("loading");
  expect(h.owner.read().room).toBeNull();
  stop();
  h.owner.dispose();
});

test("definite HTTP membership refusal revokes its exact room generation and cannot remove a reopened room or another identity", async () => {
  const h = harness();
  h.owner.open("aaaaaa");
  const old = h.sockets[0]!;
  old.callbacks.onEvent(snapshot(room()));
  const captured = h.owner.read().generation;
  h.owner.denyMembership("aaaaaa", "other@test", captured);
  h.owner.denyMembership("bbbbbb", "a@test", captured);
  expect(h.owner.read().phase).toBe("live");
  h.owner.open("aaaaaa");
  const next = h.sockets[1]!;
  next.callbacks.onEvent(snapshot(room()));
  h.owner.denyMembership("aaaaaa", "a@test", captured);
  expect(h.owner.read().phase).toBe("live");
  const generation = h.owner.read().generation;
  let finish!: (value: CommandOutcome) => void;
  h.outcome(
    new Promise((yes) => {
      finish = yes;
    }),
  );
  const request = h.owner.request({ t: "doc.get" });
  h.owner.denyMembership("aaaaaa", "a@test", generation);
  expect(h.owner.read()).toMatchObject({
    phase: "removed",
    room: null,
    connection: null,
  });
  expect(next.disposed).toBe(1);
  finish({ ok: true });
  expect(await request).toEqual({ ok: false, error: "disconnected" });
  next.callbacks.onEvent(snapshot(room()));
  expect(h.owner.read().room).toBeNull();
  h.owner.open("aaaaaa");
  expect(h.owner.read().phase).toBe("loading");
  h.owner.dispose();
});
