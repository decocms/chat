import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import { planTracks, withDtx } from "../web/features/call/session";
import { meetLink, meetMessage } from "../web/features/call/meet";
import { egressFrom, monthDays, overScreenLimit, recordsRoom, usageMonth } from "../src/callBudget";
import { CALL_THREAD, isRecorder, isRecorderOf, isRoomMember, recorderEmail } from "../shared/call";
import { encodeCall } from "../shared/jsonRpc";
import type { RoomCommand } from "../shared/commands";
import { addMark, attribute, speakerOf, type Turn } from "../recorder/container/attribute";
import { transcriptMarkdown, transcriptName } from "../src/callText";
import { callColors, callGrid } from "../web/features/call/layout";

const peers = [
  { email: "me@x.test", session: "s-me", tracks: ["mic", "screen"] },
  { email: "ana@x.test", session: "s-ana", tracks: ["mic", "screen"] },
  { email: "bia@x.test", session: "s-bia", tracks: [] },
];

test("planTracks pulls what others publish, never my own, and drops what is gone", () => {
  expect(planTracks(peers, "s-me", [])).toEqual({
    pull: [
      { session: "s-ana", name: "mic" },
      { session: "s-ana", name: "screen" },
    ],
    drop: [],
  });
  // Ana stopped her screen and Caio left: both tracks stop; her mic is already here.
  expect(
    planTracks([peers[0]!, { ...peers[1]!, tracks: ["mic"] }], "s-me", [
      "s-ana/mic",
      "s-ana/screen",
      "s-caio/mic",
    ]),
  ).toEqual({ pull: [], drop: ["s-ana/screen", "s-caio/mic"] });
});

test("planTracks receives one screen at a time when told which, and every voice", () => {
  const two = [peers[0]!, peers[1]!, { email: "bia@x.test", session: "s-bia", tracks: ["mic", "screen"] }];
  expect(planTracks(two, "s-me", [], "s-bia").pull).toEqual([
    { session: "s-ana", name: "mic" },
    { session: "s-bia", name: "mic" },
    { session: "s-bia", name: "screen" },
  ]);
  // Choosing the other screen drops the first one; no screen at all (a hidden tab) keeps the voices.
  expect(planTracks(two, "s-me", ["s-ana/mic", "s-bia/mic", "s-bia/screen"], "s-ana")).toEqual({
    pull: [{ session: "s-ana", name: "screen" }],
    drop: ["s-bia/screen"],
  });
  expect(planTracks(two, "s-me", ["s-ana/mic", "s-bia/mic", "s-bia/screen"], null)).toEqual({ pull: [], drop: ["s-bia/screen"] });
});

test("planTracks leaves cameras out while they are not on show", () => {
  const cams = [peers[0]!, { email: "ana@x.test", session: "s-ana", tracks: ["mic", "cam"] }];
  expect(planTracks(cams, "s-me", [], null, true).pull).toEqual([
    { session: "s-ana", name: "mic" },
    { session: "s-ana", name: "cam" },
  ]);
  expect(planTracks(cams, "s-me", ["s-ana/mic", "s-ana/cam"], null, false)).toEqual({ pull: [], drop: ["s-ana/cam"] });
});

test("the screen budget turns over at the limit, per month", () => {
  const gb = 1024 ** 3;
  expect(overScreenLimit(899 * gb, 900)).toBe(false);
  expect(overScreenLimit(900 * gb, 900)).toBe(true);
  expect(usageMonth(Date.UTC(2026, 10, 30, 23, 59))).toBe("2026-11");
  expect(usageMonth(Date.UTC(2026, 11, 1))).toBe("2026-12");
});

test("only a Google Meet link is sent, with everyone else in the call mentioned", () => {
  expect(meetLink(" https://meet.google.com/abc-defg-hij ")).toBe(
    "https://meet.google.com/abc-defg-hij",
  );
  expect(meetLink("https://meet.google.com.evil.test/abc")).toBe("");
  expect(
    meetLink("https://evil.test/?https://meet.google.com/abc-defg-hij"),
  ).toBe("");
  const room = {
    me: "me@x.test",
    call: peers,
    handles: { "ana@x.test": "@ana" },
  };
  expect(
    meetMessage(room, "https://meet.google.com/abc", (text, vars) =>
      text.replace("{link}", String(vars?.link)),
    ),
  ).toBe("Tela no Google Meet: https://meet.google.com/abc @ana @bia");
});

test("withDtx asks for silence suppression on Opus lines only, one time", () => {
  const sdp = "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10;useinbandfec=1\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=fmtp:96 profile-id=0\r\n";
  const out = withDtx(sdp);
  expect(out).toContain("a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1\r\n");
  expect(out).toContain("a=fmtp:96 profile-id=0\r\n");
  expect(withDtx(out)).toBe(out);
});

test("the recorder is one room's, is not a person, and only listed rooms are recorded", () => {
  const bot = recorderEmail("abc123def456");
  expect(isRecorder(bot)).toBe(true);
  expect(isRecorder("ana@x.test")).toBe(false);
  expect(isRecorderOf(bot, "abc123def456")).toBe(true);
  expect(isRecorderOf(bot, "zzz999zzz999")).toBe(false);
  expect(isRoomMember({ me: bot, members: ["ana@x.test"] })).toBe(true);
  expect(isRoomMember({ me: "eve@x.test", members: ["ana@x.test"] })).toBe(false);
  expect(recordsRoom(undefined, "abc123def456")).toBe(false);
  expect(recordsRoom("", "abc123def456")).toBe(false);
  expect(recordsRoom("zzz999zzz999, abc123def456", "abc123def456")).toBe(true);
  expect(recordsRoom("zzz999zzz999", "abc123def456")).toBe(false);
  expect(recordsRoom("*", "abc123def456")).toBe(true);
});

test("the account's real egress is the SFU's plus TURN's, and a strange answer is no number", () => {
  expect(egressFrom({ data: { viewer: { accounts: [{ sfu: [{ sum: { egressBytes: 52_800_000 } }], turn: [] }] } } })).toBe(52_800_000);
  expect(egressFrom({ data: { viewer: { accounts: [{ sfu: [{ sum: { egressBytes: 10 } }], turn: [{ sum: { egressBytes: 5 } }] }] } } })).toBe(15);
  expect(egressFrom({ data: { viewer: { accounts: [{ sfu: [], turn: [] }] } } })).toBe(0);
  expect(egressFrom({ errors: [{ message: "not authorized" }], data: null })).toBe(null);
  expect(monthDays(Date.UTC(2026, 10, 24))).toEqual(["2026-11-01", "2026-11-30"]);
  expect(monthDays(Date.UTC(2028, 1, 10))).toEqual(["2028-02-01", "2028-02-29"]);
});

test("each piece of the transcript goes to the person who spoke the most while it lasted", () => {
  const turns: Turn[] = [];
  // Ana speaks from 0 to 4 s, Bia from 4.4 to 9 s, with marks each 200 ms; Ana coughs at 6 s.
  for (let t = 200; t <= 4000; t += 200) addMark(turns, "ana", t);
  for (let t = 4600; t <= 9000; t += 200) addMark(turns, "bia", t);
  addMark(turns, "ana", 6000);
  expect(turns.map((turn) => turn.name)).toEqual(["ana", "bia", "ana"]);
  expect(turns[0]).toEqual({ name: "ana", start: 0, end: 4000 });
  expect(speakerOf(turns, 500, 3500)).toBe("ana");
  expect(speakerOf(turns, 3800, 8000)).toBe("bia");
  // Nobody was marked then: the nearest turn within 5 seconds, else nobody.
  expect(speakerOf(turns, 9500, 10500)).toBe("bia");
  expect(speakerOf(turns, 60_000, 61_000)).toBe("?");
  expect(attribute(turns, [{ start: 5000, end: 8500, text: " Concordo. " }, { start: 0, end: 3900, text: "Bom dia." }, { start: 9000, end: 9100, text: "  " }])).toEqual([
    { name: "ana", start: 0, end: 3900, text: "Bom dia." },
    { name: "bia", start: 5000, end: 8500, text: "Concordo." },
  ]);
});

test("noise that the model wrote as words is dropped, and a call of one person has one name", () => {
  const turns: Turn[] = [{ name: "rafa", start: 1000, end: 3000 }];
  const pieces = [
    { start: 1200, end: 2800, text: "Bom dia.", quiet: 0.1 },
    { start: 40_000, end: 41_000, text: "Obrigado.", quiet: 0.9 },
    { start: 80_000, end: 82_000, text: "Vamos ver isso amanhã.", quiet: 0.2 },
  ];
  expect(attribute(turns, pieces, ["rafa"]).map((line) => [line.name, line.text])).toEqual([
    ["rafa", "Bom dia."],
    ["rafa", "Vamos ver isso amanhã."],
  ]);
  expect(attribute(turns, pieces, ["rafa", "bia"]).map((line) => line.name)).toEqual(["rafa", "?"]);
});

test("the room's transcript file keeps one paragraph for each turn, with the time", () => {
  expect(
    transcriptMarkdown("Call · 2026-11-24", [
      { name: "ana", start: 0, text: "Bom dia." },
      { name: "ana", start: 4, text: "Vamos começar." },
      { name: "bia", start: 65, text: "Concordo." },
      { name: "bia", start: 70, text: "  " },
    ]),
  ).toBe("# Call · 2026-11-24\n\n**ana** (00:00): Bom dia. Vamos começar.\n\n**bia** (01:05): Concordo.\n");
  expect(transcriptName(Date.UTC(2026, 10, 24, 23, 5))).toBe("call-2026-11-24-23-05.md");
});

test("the call's grid: one person fills the stage, two side by side or stacked by shape, then 2x2", () => {
  expect(callGrid(1, 1200, 700).columns).toBe(1);
  expect(callGrid(2, 1200, 700).columns).toBe(2);
  expect(callGrid(2, 360, 500).columns).toBe(1);
  expect(callGrid(4, 1200, 700)).toMatchObject({ columns: 2, rows: 2, scroll: false });
  expect(callGrid(20, 1200, 700)).toMatchObject({ columns: 4, scroll: true, height: "h-40" });
});

test("each person in a call has a color of their own while there are colors left", () => {
  const emails = ["a", "b", "c", "d", "e", "f"].map((n) => `${n}@x.test`);
  expect(new Set(Object.values(callColors(emails))).size).toBe(6);
  // The same person, the same color, as long as nobody before them has it.
  expect(callColors(["a@x.test"])["a@x.test"]).toBe(callColors(["a@x.test", "zz@x.test"])["a@x.test"]);
});

// ---- the call's own thread: the real Book over an in-memory SQLite (as scripts/thread-origin.test.ts) ----
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

function callRoom(bookId = "abcdef") {
  const db = new Database(":memory:");
  const cursor = (rows: Record<string, unknown>[], written: number) => ({
    toArray: () => rows,
    one: () => rows[0],
    rowsWritten: written,
    [Symbol.iterator]: () => rows[Symbol.iterator](),
  });
  const sql = {
    exec(query: string, ...params: (string | number | null)[]) {
      const text = query.trim();
      if (!params.length && /;\s*\S/.test(text)) {
        db.exec(text);
        return cursor([], 0);
      }
      const statement = db.query(text);
      if (statement.columnNames.length) return cursor(statement.all(...params) as Record<string, unknown>[], 0);
      return cursor([], statement.run(...params).changes);
    },
  };
  // Each push is a JSON-RPC notification (shared/jsonRpc.ts): its method is the event's `t`.
  const frames: { t: string; call?: unknown; thread?: string }[] = [];
  const rawFrames: string[] = [];
  const ws = {
    readyState: 1,
    send: (frame: string) => {
      rawFrames.push(frame);
      const { method, params } = JSON.parse(frame) as { method: string; params: object };
      frames.push({ t: method, ...params });
    },
  };
  const statement = () => {
    const bound = () => ({ run: async () => ({ meta: { changes: 0 } }), first: async () => null, all: async () => ({ results: [] }) });
    return { bind: bound, ...bound() };
  };
  const ctx = {
    storage: { sql, getAlarm: async () => null, setAlarm: async () => {} },
    waitUntil: (p: unknown) => void Promise.resolve(p).catch(() => {}),
    getWebSockets: () => [ws],
    getTags: () => ["ana@x.test"],
    blockConcurrencyWhile: (fn: () => unknown) => fn(),
  };
  const book = new Book(
    ctx as unknown as ConstructorParameters<typeof Book>[0],
    { DB: { prepare: statement, batch: async () => [] }, DOC_ROOMS: { idFromName: () => "doc", get: () => ({ setText: async () => {} }) } } as unknown as ConstructorParameters<typeof Book>[1],
  );
  book.set("book_id", bookId);
  book.wakeAt = async () => {};
  book.members = async () => ["ana@x.test"];
  const epics = () => db.query(`SELECT id, title, owner, from_msg FROM epics`).all() as { id: string; title: string; owner: string; from_msg: number }[];
  const main = () => db.query(`SELECT id, author, text FROM messages WHERE thread = 'main' ORDER BY id`).all() as { id: number; author: string; text: string }[];
  const thread = (id: string) => db.query(`SELECT id, author, text FROM messages WHERE thread = ? ORDER BY id`).all(id) as { id: number; author: string; text: string }[];
  let rpc = 0;
  const send = async (command: RoomCommand) => {
    const id = `r-${++rpc}`;
    await book.webSocketMessage(ws as unknown as WebSocket, encodeCall(command, id));
    const reply = rawFrames.map((frame) => JSON.parse(frame) as { id?: string; error?: { message: string } }).find((frame) => frame.id === id);
    if (!reply) throw Error("no reply");
    return reply.error ? { ok: false as const, error: reply.error.message } : { ok: true as const };
  };
  return { book, frames, epics, main, thread, send };
}

test("one call chat per room, the same for every call, and the room says which while a call is on", () => {
  const r = callRoom();
  r.book.callJoin("abcdef", "ana@x.test", "s-ana", "https://x.test");
  expect(r.book.liveCallThread()).toBe(CALL_THREAD);
  expect(r.frames.filter((f) => f.t === "call").at(-1)).toMatchObject({ thread: CALL_THREAD });
  // No thread, no line in main: the call chat is not a thread.
  expect(r.epics()).toHaveLength(0);
  expect(r.main()).toHaveLength(0);
  r.book.callLeave("ana@x.test");
  expect(r.book.liveCallThread()).toBeUndefined();
  expect(r.frames.filter((f) => f.t === "call").at(-1)?.thread).toBeUndefined();
  // The next call: the same chat.
  r.book.callJoin("abcdef", "bia@x.test", "s-bia", "https://x.test");
  expect(r.book.liveCallThread()).toBe(CALL_THREAD);
  expect(r.epics()).toHaveLength(0);
});

test("a message sent to the call chat lands in it, and the room's listings never show it as a thread", async () => {
  const r = callRoom();
  r.book.callJoin("abcdef", "ana@x.test", "s-ana", "https://x.test");
  expect(await r.send({ t: "msg", thread: CALL_THREAD, text: "Alguém compartilha a tela?" })).toEqual({ ok: true });
  expect(r.thread(CALL_THREAD).map((m) => m.text)).toEqual(["Alguém compartilha a tela?"]);
  expect(r.main()).toHaveLength(0);
  // The room's threads (what the app and the sidebar list) and an agent's read: no "call" among the epics; the
  // message is readable, named as the call chat.
  expect(r.book.wireEpics(r.book.epics()).map((e) => e.id)).not.toContain(CALL_THREAD);
  const read = await r.book.agentRead("abcdef");
  expect(read.epics.map((e) => e.id)).not.toContain(CALL_THREAD);
  expect(read.messages.find((m) => m.text.includes("compartilha"))?.thread).toBe("call chat");
  // Search finds nothing there (the call chat is only seen beside the stage).
  expect(r.book.search("abcdef", "compartilha").messages).toHaveLength(0);
  // The next room open carries the call chat's newest messages.
  expect(r.book.roomWindow("main").messages.map((m) => m.thread)).toContain(CALL_THREAD);
});

test("the recorder alone starts no call", () => {
  const r = callRoom();
  r.book.callJoin("abcdef", recorderEmail("abcdef"), "s-rec", "https://x.test");
  expect(r.book.liveCallThread()).toBeUndefined();
});

test("a DM's call keeps the DM's own chat beside the stage; the call chat is refused there", async () => {
  const dm = callRoom("dm0123456789abcdef0123");
  dm.book.callJoin("dm0123456789abcdef0123", "ana@x.test", "s-ana", "https://x.test");
  expect(dm.book.liveCallThread()).toBe("main");
  expect(dm.frames.filter((f) => f.t === "call").at(-1)).toMatchObject({ thread: "main" });
  expect(await dm.send({ t: "msg", thread: CALL_THREAD, text: "oi" })).toMatchObject({ ok: false });
  expect(dm.thread(CALL_THREAD)).toHaveLength(0);
});

test("the call chat comes back on a reconnect that resumes, pages like any thread, and takes a post", async () => {
  const r = callRoom();
  r.book.callJoin("abcdef", "ana@x.test", "s-ana", "https://x.test");
  await r.send({ t: "msg", thread: CALL_THREAD, text: "antes" });
  const at = Date.now() - 1000;
  const since = r.book.roomWindow("main").countsAt;
  for (const text of ["um", "dois", "três"]) await r.send({ t: "msg", thread: CALL_THREAD, text });
  const posted = await r.book.humanPost("abcdef", "ana@x.test", "quatro", CALL_THREAD);
  expect(posted).toMatchObject({ ok: true, thread: CALL_THREAD });
  // A reconnect from before these messages: the resume carries them, and the threads are not sent again.
  const resumed = r.book.resumeOf(new URL(`https://x.test/ws?since=${since}&at=${at}&eh=h1`), "main", r.book.roomWindow("main").messages, "h1");
  expect(resumed?.messages.filter((m) => m.thread === CALL_THREAD).map((m) => m.text)).toEqual(["um", "dois", "três", "quatro"]);
  expect(resumed?.epicsSame).toBe(true);
  // Scroll-back pages the call chat by id, like any thread.
  const newest = r.book.messagesPage({ thread: CALL_THREAD, limit: 2 });
  expect(newest.messages.map((m) => m.text)).toEqual(["três", "quatro"]);
  expect(newest.more).toBe(true);
  const older = r.book.messagesPage({ thread: CALL_THREAD, before: newest.messages[0]!.id, limit: 2 });
  expect(older.messages.map((m) => m.text)).toEqual(["um", "dois"]);
  expect(r.book.messagesPage({ thread: CALL_THREAD, before: older.messages[0]!.id, limit: 2 }).messages.map((m) => m.text)).toEqual(["antes"]);
  expect(r.book.epics()).toHaveLength(0);
});

test("the recording's title is the room's: the call is the room's, not a thread's", async () => {
  const r = callRoom();
  r.book.callJoin("abcdef", "ana@x.test", "s-ana", "https://x.test");
  // The fake D1 has no room row: the fallback name, with no thread after it.
  expect(await r.book.callTitle("abcdef")).toBe("deco.chat");
});

test("a person alone is not recorded; the second person makes it a call to record", () => {
  const r = callRoom();
  expect(r.book.callJoin("abcdef", "ana@x.test", "s-ana", "https://x.test")).toBe(false);
  expect(r.book.callJoin("abcdef", "bia@x.test", "s-bia", "https://x.test")).toBe(true);
  expect(r.book.liveCallThread()).toBe(CALL_THREAD);
});
