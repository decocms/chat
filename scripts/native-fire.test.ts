import { expect, test } from "bun:test";
import { get } from "svelte/store";
import {
  createFireController,
  fireSpeechPieces,
} from "../svelte/features/composer/fire";
import { createMicrophoneGesture } from "../svelte/features/composer/microphone";
import {
  createSpeechController,
  type SpeechRecognizer,
} from "../svelte/features/composer/speech";
import { FireFailure } from "../svelte/features/composer/fireApi";
import { fireReviewText } from "../svelte/features/composer/fireCopy";
import type {
  ComposerFirePort,
  FireFile,
} from "../svelte/features/composer/fireTypes";
import type { Room } from "../shared/room";
import type { FireBody, FireResult } from "../shared/schemas";
import type { RoomCommand, CommandOutcome } from "../shared/commands";
import type { RequestRoomCommand } from "../svelte/roomConnection";
import { manualClock, deferred, settle } from "./native-home-fixtures";
function recognition() {
  let results: { 0: { transcript: string }; isFinal: boolean }[] = [];
  const rec: SpeechRecognizer = {
    lang: "",
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {},
    stop() {},
    abort() {},
  };
  return {
    rec,
    say(text: string, final = true) {
      if (!results.length || results.at(-1)!.isFinal)
        results.push({ 0: { transcript: text }, isFinal: final });
      else
        results[results.length - 1] = {
          0: { transcript: text },
          isFinal: final,
        };
      rec.onresult?.({ resultIndex: results.length - 1, results });
    },
  };
}
function fixture(
  apply: ComposerFirePort["apply"] = async () => ({
    ok: true,
    mode: "card",
    card_msg: 5,
    ms: 1,
  }),
  request: RequestRoomCommand = async () => ({ ok: true }),
) {
  const timer = manualClock(),
    engines: ReturnType<typeof recognition>[] = [],
    bodies: FireBody[] = [],
    commands: RoomCommand[] = [],
    opened: FireFile[] = [];
  let room: Room = {
      id: "abc123",
      me: "me@test",
      book: { title: "Room", owner: "me@test" },
      members: ["me@test"],
      epics: [],
      messages: [],
      online: [],
      typing: {},
      suggestions: [],
    },
    allowed = true,
    sessionLost = 0,
    denied = 0,
    side: ReturnType<ComposerFirePort["currentFile"]> = null;
  const owner = createFireController({
    roomId: room.id,
    thread: "main",
    room: () => room,
    locale: "en-US",
    factory: () => {
      const engine = recognition();
      engines.push(engine);
      return engine.rec;
    },
    clock: timer.clock,
    request: async (command) => {
      commands.push(command);
      return request(command);
    },
    reviewText: (chunks, file, card) =>
      fireReviewText("en", chunks, file?.name, !!card),
    port: {
      current: () => allowed,
      apply: (body, signal) => {
        bodies.push(body);
        return apply(body, signal);
      },
      currentFile: () => side,
      openFile: (file) => {
        opened.push(file);
        side = { roomId: room.id, id: file.id, name: file.name };
      },
      sessionLost: () => {
        sessionLost++;
        allowed = false;
      },
      denyMembership: () => {
        denied++;
        allowed = false;
      },
    },
  });
  return {
    owner,
    timer,
    engines,
    bodies,
    commands,
    opened,
    room: () => room,
    replace(value: Room) {
      room = value;
      owner.sync();
    },
    allow(value: boolean) {
      allowed = value;
    },
    lost: () => sessionLost,
    denied: () => denied,
    setSide(value: typeof side) {
      side = value;
    },
    dispose: () => owner.dispose(),
  };
}
test("mic taps toggle, cancelled holds do nothing and exactly3s arms Fire once", () => {
  const timer = manualClock();
  let starts = 0,
    stops = 0,
    arms = 0,
    recording = false,
    live = false,
    step: number | null = null;
  const mic = createMicrophoneGesture({
    clock: timer.clock,
    current: () => true,
    recording: () => recording,
    start() {
      recording = true;
      starts++;
    },
    stop() {
      recording = false;
      stops++;
    },
    fireLive: () => live,
    stopFire() {
      live = false;
      stops++;
    },
    armFire() {
      arms++;
      live = true;
    },
    charge: (value) => (step = value),
  });
  mic.begin(1);
  timer.advance(100);
  mic.end(1);
  expect(starts).toBe(1);
  mic.begin(2);
  mic.end(2);
  expect(recording).toBe(false);
  mic.begin(3);
  timer.advance(400);
  expect(String(step)).toBe("0");
  mic.cancel();
  timer.advance(3000);
  expect(arms).toBe(0);
  mic.begin(4);
  timer.advance(2999);
  expect(arms).toBe(0);
  timer.advance(1);
  expect(arms).toBe(1);
  mic.end(4);
  expect(starts).toBe(1);
  mic.begin(5);
  mic.end(5);
  expect(live).toBe(false);
  expect(arms).toBe(1);
  mic.dispose();
  expect(timer.jobs.size).toBe(0);
});
test("coarse-pointer Space stays native and cancelled speech cannot rewrite a sent draft", () => {
  const timer = manualClock(),
    engine = recognition();
  let text = "draft",
    revision = 0,
    prevented = 0;
  const speech = createSpeechController({
    factory: () => engine.rec,
    coarse: () => true,
    locale: "en",
    clock: timer.clock,
    read: () => ({ text, start: text.length, end: text.length, revision }),
    write: (value) => {
      text = value;
      revision++;
    },
    canStart: () => true,
    recording() {},
    error() {},
    ended() {},
  });
  expect(
    speech.keydown({
      key: " ",
      preventDefault() {
        prevented++;
      },
    }),
  ).toBe(false);
  speech.keyup({ key: " " });
  timer.advance(1000);
  expect(prevented).toBe(0);
  expect(text).toBe("draft");
  speech.start();
  const late = engine.rec.onresult;
  speech.cancel();
  text = "";
  revision++;
  late?.({ results: [[{ transcript: "late sent text" }]] });
  expect(text).toBe("");
  speech.dispose();
});
test("stable interim is applied once, subsequent pieces queue serially and stop waits for canonical review", async () => {
  const pending = deferred<FireResult>(),
    acknowledgement = deferred<CommandOutcome>(),
    h = fixture(
      () => pending.promise,
      () => acknowledgement.promise,
    );
  h.owner.start();
  h.engines[0].say("first", false);
  h.timer.advance(699);
  await settle();
  expect(h.bodies).toHaveLength(0);
  h.timer.advance(1);
  await settle();
  expect(h.bodies.map((body) => body.text)).toEqual(["first"]);
  h.engines[0].say("first", true);
  h.engines[0].say("second", true);
  await settle();
  expect(h.bodies).toHaveLength(1);
  h.owner.stop();
  expect(h.commands).toHaveLength(0);
  pending.resolve({ ok: true, mode: "card", card_msg: 5, ms: 1 });
  await settle();
  expect(h.bodies.map((body) => body.text)).toEqual(["first", "second"]);
  expect(h.bodies[1]).toMatchObject({ card_msg: 5, history: ["first"] });
  expect(h.commands).toHaveLength(1);
  expect(get(h.owner.state).phase).toBe("review-pending");
  const command = h.commands[0];
  if (command.t !== "msg") throw Error("review command");
  expect(command.reply_to).toBe(5);
  expect(command.text).toContain("- first\n- second");
  h.replace({
    ...h.room(),
    messages: [
      {
        id: 6,
        thread: "main",
        author: "me@test",
        text: command.text!,
        reply_to: 5,
        ts: 1,
      },
    ],
  });
  expect(get(h.owner.state).phase).toBe("review-pending");
  acknowledgement.resolve({ ok: true });
  await settle();
  expect(get(h.owner.state).phase).toBe("complete");
  h.dispose();
  expect(h.timer.jobs.size).toBe(0);
});
test("live card can switch to a beside-chat file and back without inventing attachment metadata", async () => {
  let count = 0;
  const file: FireFile = {
      id: "f1",
      name: "page.html",
      type: "text/html",
      size: 42,
      ts: 1,
    },
    h = fixture(async () =>
      ++count === 1
        ? { ok: true, mode: "card", card_msg: 5, ms: 1 }
        : count === 2
          ? { ok: true, mode: "file", file, opened: false, ms: 1 }
          : { ok: true, mode: "card", card_msg: 7, ms: 1 },
    );
  h.owner.start();
  for (const text of ["make a card", "make an html", "make a card again"]) {
    h.engines[0].say(text);
    await settle();
  }
  expect(h.bodies[1].card_msg).toBe(5);
  expect(h.bodies[2].file_id).toBe("f1");
  expect(h.bodies[2].card_msg).toBeUndefined();
  expect(h.opened).toEqual([file]);
  expect(get(h.owner.state).cardId).toBe(7);
  h.owner.stop();
  await settle();
  expect(h.commands[0]).toMatchObject({
    t: "msg",
    reply_to: 7,
    thread: "main",
  });
  h.dispose();
});
test("ignored-abort HTTP timeout is unconfirmed and never replays or accepts a late output", async () => {
  const late = deferred<FireResult>(),
    h = fixture(() => late.promise);
  h.owner.start();
  h.engines[0].say("unknown write");
  await settle();
  h.timer.advance(90000);
  await settle();
  expect(get(h.owner.state).phase).toBe("unconfirmed");
  const old = h.engines[0].rec.onresult;
  old?.({});
  h.owner.start();
  h.owner.stop();
  await settle();
  expect(h.bodies).toHaveLength(1);
  expect(h.commands).toHaveLength(0);
  late.resolve({ ok: true, mode: "card", card_msg: 9, ms: 1 });
  await settle();
  expect(get(h.owner.state).cardId).toBe(null);
  h.dispose();
});
test("exact membership403 and global401 revoke only the appropriate owned authority", async () => {
  for (const kind of ["session", "membership", "generic"] as const) {
    const h = fixture(async () => {
      throw new FireFailure(403, kind === "session", kind === "membership");
    });
    h.owner.start();
    h.engines[0].say("text");
    await settle();
    expect(h.lost()).toBe(kind === "session" ? 1 : 0);
    expect(h.denied()).toBe(kind === "membership" ? 1 : 0);
    expect(h.commands).toHaveLength(0);
    h.dispose();
  }
});
test("reentrant cancellation and scope departure fence queued apply and late speech callbacks", async () => {
  const h = fixture();
  h.owner.start();
  const late = h.engines[0].rec.onresult;
  const stop = h.owner.state.subscribe((value) => {
    if (value.busy) h.owner.cancel();
  });
  h.engines[0].say("cancel at publication");
  await settle();
  expect(h.bodies).toHaveLength(0);
  stop();
  h.owner.start();
  h.allow(false);
  h.engines.at(-1)!.say("new scope blocked");
  late?.({});
  await settle();
  expect(h.bodies).toHaveLength(0);
  h.dispose();
  expect(h.timer.jobs.size).toBe(0);
});
test("postACK canonical deadline never reports review delivery and malformed speech is refused", async () => {
  expect(
    fireSpeechPieces({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, 0: { transcript: 7 } } },
    }),
  ).toBe(null);
  const h = fixture();
  h.owner.start();
  h.engines[0].say("valid");
  await settle();
  h.owner.stop();
  await settle();
  h.timer.advance(20000);
  await settle();
  expect(get(h.owner.state).phase).toBe("review-unconfirmed");
  expect(h.commands).toHaveLength(1);
  h.owner.stop();
  await settle();
  expect(h.commands).toHaveLength(1);
  h.dispose();
});

test("same-mounted membership loss synchronously aborts recognition and releases owned deadlines", async () => {
  const late = deferred<FireResult>(),
    h = fixture(() => late.promise);
  h.owner.start();
  const rec = h.engines[0].rec;
  let aborts = 0;
  rec.abort = () => {
    aborts++;
  };
  const callback = rec.onresult;
  h.engines[0].say("in flight");
  await settle();
  h.replace({ ...h.room(), members: [] });
  expect(aborts).toBe(1);
  expect(h.timer.jobs.size).toBe(0);
  expect(get(h.owner.state).phase).toBe("idle");
  callback?.({
    resultIndex: 0,
    results: [{ 0: { transcript: "late" }, isFinal: true }],
  });
  late.resolve({ ok: true, mode: "card", card_msg: 8, ms: 1 });
  await settle();
  expect(h.bodies).toHaveLength(1);
  expect(h.commands).toHaveLength(0);
  expect(get(h.owner.state).cardId).toBe(null);
  h.dispose();
});

test("inferred Fire HTTP adapter validates results and distinguishes exact authority errors", async () => {
  const { createFireApi } = await import("../svelte/features/composer/fireApi"),
    { UNAUTHENTICATED } = await import("../shared/schemas");
  let status = 200,
    payload: unknown = { ok: true, mode: "card", card_msg: 4, ms: 2 },
    captured: unknown;
  const apply = createFireApi(async (_input, init) => {
    captured = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  expect(
    await apply(
      "abc123",
      { text: "speech", thread: "main", history: [] },
      new AbortController().signal,
    ),
  ).toEqual({ ok: true, mode: "card", card_msg: 4, ms: 2 });
  expect(captured).toEqual({ text: "speech", thread: "main", history: [] });
  for (const [code, error, global, member] of [
    [401, UNAUTHENTICATED.error, true, false],
    [403, "forbidden", false, true],
    [400, "forbidden", false, false],
    [403, "other", false, false],
  ] as const) {
    status = code;
    payload = { error };
    try {
      await apply("abc123", { text: "speech" }, new AbortController().signal);
      throw Error("Expected refusal");
    } catch (failure) {
      expect(failure instanceof FireFailure).toBe(true);
      if (!(failure instanceof FireFailure)) throw failure;
      expect(failure.unauthenticated).toBe(global);
      expect(failure.membershipDenied).toBe(member);
    }
  }
  status = 200;
  payload = { ok: true, mode: "card", card_msg: Infinity, ms: 1 };
  await expect(
    apply("abc123", { text: "speech" }, new AbortController().signal),
  ).rejects.toBeInstanceOf(FireFailure);
});

test("real RoomScope exposes Fire beside-chat targets and exact room-only membership revocation", async () => {
  const { roomScopeFixture } = await import("./room-scope-fixtures"),
    h = await roomScopeFixture({ roomId: "aaaaaa" });
  const old = {
      id: "aa11",
      name: "page.html",
      type: "text/html",
      size: 10,
      ts: 1,
      author: "me@test.com",
    },
    latest = { ...old, id: "bb22", ts: 2 };
  h.publish({ ...h.room, files: [old, latest], filesAll: true });
  const fire = get(h.owner.state)?.composer?.fire;
  expect(!!fire).toBe(true);
  if (!fire) throw Error("actual Fire port missing");
  expect(h.owner.actions.openSideFile(old)).toBe(true);
  expect(h.owner.actions.currentSideFile()?.id).toBe("aa11");
  expect(fire.currentFile()?.id).toBe("bb22");
  expect(h.owner.actions.currentSideFile()?.follow).toBe(false);
  fire.denyMembership();
  expect(h.app.services.rootRoom.read().phase).toBe("removed");
  expect(h.app.services.active()).toBe(true);
  expect(fire.currentFile()).toBe(null);
  await expect(
    fire.apply({ text: "stale", thread: "main" }, new AbortController().signal),
  ).rejects.toBeInstanceOf(FireFailure);
  expect(h.requests.filter((url) => url.includes("/fire"))).toHaveLength(0);
  fire.sessionLost();
  expect(h.app.services.active()).toBe(true);
  h.dispose();
});
