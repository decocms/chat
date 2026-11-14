import { expect, test } from "bun:test";
import { get } from "svelte/store";
import { createFireController } from "../svelte/features/composer/fire";
import type {
  ComposerFirePort,
  FireReport,
} from "../svelte/features/composer/fireTypes";
import { createFireCaptureFactory } from "../svelte/features/composer/fireAudio";
import type {
  FireCapture,
  FireCaptureFactory,
} from "../svelte/features/composer/fireAudio";
import { FireFailure } from "../svelte/features/composer/fireApi";
import { createMicrophoneGesture } from "../svelte/features/composer/microphone";
import {
  createSpeechController,
  type SpeechRecognizer,
} from "../svelte/features/composer/speech";
import type { Room } from "../shared/room";
import type { RoomCommand, CommandOutcome } from "../shared/commands";
import { manualClock, deferred, settle } from "./native-home-fixtures";
async function until(ready: () => boolean) {
  for (let i = 0; i < 100; i++) {
    if (ready()) return;
    await Promise.resolve();
  }
  expect(ready()).toBe(true);
}
function microphone() {
  let ended = () => {},
    chunk = (_value: Blob) => {},
    level = (_value: number) => {};
  const counts = { starts: 0, stops: 0, disposed: 0 };
  const capture: FireCapture = {
    type: "audio/webm",
    start(data, stop) {
      counts.starts++;
      chunk = data;
      ended = stop;
    },
    observeLevel(sample) {
      level = sample;
      return () => {
        level = () => {};
      };
    },
    stop() {
      counts.stops++;
      ended();
    },
    dispose() {
      counts.disposed++;
    },
  };
  return {
    capture,
    counts,
    chunk: (size = 3000) => chunk(new Blob([new Uint8Array(size)])),
    ended: () => ended(),
    level: (value: number) => level(value),
  };
}
function fixture(
  options: {
    capture?: FireCaptureFactory;
    now?: () => number;
    transcribe?: ComposerFirePort["transcribe"];
    request?: (command: RoomCommand) => Promise<CommandOutcome>;
  } = {},
) {
  const timer = manualClock(),
    mics: ReturnType<typeof microphone>[] = [],
    commands: RoomCommand[] = [],
    toggles: boolean[] = [],
    leaving = new Set<() => void>();
  const engines: SpeechRecognizer[] = [];
  let room: Room = {
    id: "abc123",
    me: "me@test",
    book: { title: "Owned room", owner: "me@test" },
    members: ["me@test"],
    epics: [],
    messages: [],
    online: [],
    typing: {},
    suggestions: [],
  };
  let allowed = true,
    report: ((value: FireReport) => void) | null = null,
    denied = 0,
    lost = 0;
  const owner = createFireController({
    roomId: room.id,
    thread: "main",
    room: () => room,
    locale: "en-US",
    clock: { ...timer.clock, now: options.now },
    capture:
      options.capture ??
      (async () => {
        const mic = microphone();
        mics.push(mic);
        return mic.capture;
      }),
    factory: () => {
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
      engines.push(rec);
      return rec;
    },
    request: async (command) => {
      commands.push(command);
      return options.request?.(command) ?? { ok: true };
    },
    port: {
      current: () => allowed,
      set: async (on) => {
        toggles.push(on);
      },
      restore: async () => {
        toggles.push(false);
      },
      transcribe: options.transcribe ?? (async () => "Whisper owned utterance"),
      watch: (callback) => {
        report = callback;
        return () => {
          report = null;
        };
      },
      beforeLeave: (callback) => {
        leaving.add(callback);
        return () => {
          leaving.delete(callback);
        };
      },
      sessionLost() {
        lost++;
        allowed = false;
      },
      denyMembership() {
        denied++;
        allowed = false;
      },
    },
  });
  const canonical = (text = "Whisper owned utterance") => {
    room = {
      ...room,
      messages: [
        ...room.messages,
        {
          id: room.messages.length + 1,
          thread: "main",
          author: room.me,
          text,
          ts: 1,
        },
      ],
    };
    owner.sync();
  };
  return {
    owner,
    timer,
    mics,
    commands,
    toggles,
    engines,
    canonical,
    get room() {
      return room;
    },
    set room(value: Room) {
      room = value;
    },
    get lost() {
      return lost;
    },
    get denied() {
      return denied;
    },
    report(state: FireReport["state"]) {
      report?.({
        t: "fireState",
        book: room.id,
        state,
        model: "haiku",
        note: "",
      });
    },
    deny() {
      allowed = false;
      owner.sync();
    },
    leave() {
      for (const callback of [...leaving]) callback();
    },
  };
}
test("record/release uses Whisper and normal message; ACK alone is not delivered", async () => {
  const f = fixture();
  await f.owner.hold();
  await settle();
  expect(f.toggles).toEqual([true]);
  expect(f.mics[0].counts.starts).toBe(1);
  f.report("ready");
  expect(get(f.owner.state).phase).toBe("ready");
  f.mics[0].chunk();
  f.owner.release();
  await settle();
  expect(f.commands).toEqual([
    { t: "msg", text: "Whisper owned utterance", thread: "main" },
  ]);
  expect(get(f.owner.state).sending).toBe("message");
  f.canonical();
  await until(() => get(f.owner.state).sending === "none");
  expect(get(f.owner.state).sending).toBe("none");
  expect(get(f.owner.state).sent).toBe("Whisper owned utterance");
  expect(f.mics[0].counts.disposed).toBe(1);
  f.owner.dispose();
});
test("small taps do not transcribe and browser preview never sends before release", async () => {
  let reads = 0;
  const f = fixture({
    transcribe: async () => {
      reads++;
      return "server";
    },
  });
  await f.owner.hold();
  f.engines[0].onresult?.({ results: [{ 0: { transcript: "preview" } }] });
  await settle();
  expect(get(f.owner.state).text).toBe("preview");
  expect(f.commands).toHaveLength(0);
  f.mics[0].chunk(1999);
  f.owner.release();
  await settle();
  expect(reads).toBe(0);
  expect(f.commands).toHaveLength(0);
  f.owner.dispose();
});
test("Whisper failure falls back to this utterance preview, with room language hints", async () => {
  const seen: { lang: string; prompt: string }[] = [];
  const f = fixture({
    transcribe: async (_audio, query) => {
      seen.push(query);
      throw Error("offline");
    },
  });
  await f.owner.hold();
  f.engines[0].onresult?.({
    results: [{ 0: { transcript: "owned preview" } }],
  });
  f.mics[0].chunk();
  f.owner.release();
  await settle();
  expect(seen[0].lang).toBe("en");
  expect(seen[0].prompt).toContain("Owned room");
  expect(f.commands).toEqual([
    { t: "msg", text: "owned preview", thread: "main" },
  ]);
  f.owner.dispose();
});
test("release before microphone permission arrives disposes late capture without recording", async () => {
  const permission = deferred<FireCapture>(),
    mic = microphone();
  const f = fixture({ capture: () => permission.promise });
  const hold = f.owner.hold();
  await settle();
  f.owner.release();
  permission.resolve(mic.capture);
  await hold;
  await settle();
  expect(mic.counts.disposed).toBe(1);
  expect(mic.counts.starts).toBe(0);
  expect(f.commands).toHaveLength(0);
  f.owner.dispose();
});
test("permission deadline fences ignored-abort late microphone results", async () => {
  const permission = deferred<FireCapture>(),
    mic = microphone();
  const f = fixture({ capture: () => permission.promise });
  const hold = f.owner.hold();
  await settle();
  f.timer.advance(20000);
  await hold;
  permission.resolve(mic.capture);
  await settle();
  expect(mic.counts.disposed).toBe(1);
  expect(mic.counts.starts).toBe(0);
  f.owner.dispose();
});
test("Escape/leave stops media and discards late transcription; off confirmation is separate", async () => {
  const response = deferred<string>();
  const f = fixture({ transcribe: () => response.promise });
  await f.owner.hold();
  f.mics[0].chunk();
  f.owner.release();
  await settle();
  f.owner.stop();
  expect(get(f.owner.state).phase).toBe("leaving");
  expect(f.toggles).toEqual([true, false]);
  response.resolve("late");
  await settle();
  expect(f.commands).toHaveLength(0);
  f.report("ready");
  expect(get(f.owner.state).phase).toBe("leaving");
  f.timer.advance(30000);
  expect(get(f.owner.state).error).toBe("restore");
  f.report("off");
  expect(get(f.owner.state).phase).toBe("idle");
  f.owner.dispose();
});
test("membership loss and synchronous scope departure revoke every capture callback", async () => {
  const f = fixture();
  await f.owner.hold();
  const late = f.engines[0].onresult;
  f.deny();
  late?.({ results: [{ 0: { transcript: "private late" } }] });
  f.mics[0].chunk();
  f.mics[0].ended();
  await settle();
  expect(f.mics[0].counts.disposed).toBe(1);
  expect(f.commands).toHaveLength(0);
  expect(get(f.owner.state).text).toBe("");
  f.owner.dispose();
  const next = fixture();
  await next.owner.hold();
  next.leave();
  expect(next.toggles).toEqual([true, false]);
  expect(next.mics[0].counts.disposed).toBe(1);
  next.owner.dispose();
});
test("oversized or spontaneously stopped recordings never upload or send", async () => {
  let uploads = 0;
  const f = fixture({
    transcribe: async () => {
      uploads++;
      return "wrong";
    },
  });
  await f.owner.hold();
  f.mics[0].chunk(4_000_001);
  await settle();
  expect(get(f.owner.state).error).toBe("recording");
  expect(uploads).toBe(0);
  await f.owner.hold();
  f.mics[1].chunk();
  f.mics[1].ended();
  await settle();
  expect(uploads).toBe(0);
  expect(f.commands).toHaveLength(0);
  f.owner.dispose();
});
test("uncertain message writes retain the transcript and never replay automatically", async () => {
  const f = fixture({ request: async () => ({ ok: false, error: "timeout" }) });
  await f.owner.hold();
  f.mics[0].chunk();
  f.owner.release();
  await until(() => get(f.owner.state).sending === "unconfirmed");
  expect(get(f.owner.state).sending).toBe("unconfirmed");
  await f.owner.hold();
  f.owner.sync();
  f.timer.advance(60000);
  await settle();
  expect(f.commands).toHaveLength(1);
  f.canonical();
  expect(get(f.owner.state).sending).toBe("unconfirmed");
  f.owner.discard(get(f.owner.state).intent);
  expect(get(f.owner.state).sending).toBe("none");
  f.owner.dispose();
});
test("definite prequeue refusal permits explicit retry only for the captured intent", async () => {
  let calls = 0;
  const f = fixture({
    request: async () =>
      ++calls === 1 ? { ok: false, error: "offline" } : { ok: true },
  });
  await f.owner.hold();
  f.mics[0].chunk();
  f.owner.release();
  await until(() => get(f.owner.state).error === "send-refused");
  const old = get(f.owner.state).intent;
  expect(get(f.owner.state).error).toBe("send-refused");
  await f.owner.hold();
  expect(f.commands).toHaveLength(1);
  f.owner.retry(old);
  await settle();
  expect(f.commands).toHaveLength(2);
  f.owner.retry(old);
  expect(f.commands).toHaveLength(2);
  f.canonical();
  await until(() => get(f.owner.state).sending === "none");
  expect(get(f.owner.state).sending).toBe("none");
  f.owner.dispose();
});
test("known global401 and room403 do not fall back to preview or send", async () => {
  for (const error of [
    new FireFailure(401, true),
    new FireFailure(403, false, true),
  ]) {
    const f = fixture({
      transcribe: async () => {
        throw error;
      },
    });
    await f.owner.hold();
    f.engines[0].onresult?.({
      results: [{ 0: { transcript: "do not send" } }],
    });
    f.mics[0].chunk();
    f.owner.release();
    await settle();
    expect(f.commands).toHaveLength(0);
    expect(f.lost + f.denied).toBe(1);
    f.owner.sync();
    expect(get(f.owner.state).text).toBe("");
    f.owner.dispose();
  }
});
test("empty-composer Space uses alternate hold/release while tap and nonempty hold keep dictation", () => {
  const timer = manualClock();
  let text = "",
    revision = 0,
    held = 0,
    released = 0,
    started = 0;
  const rec: SpeechRecognizer = {
    lang: "",
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {
      started++;
    },
    stop() {},
    abort() {},
  };
  const speech = createSpeechController({
    factory: () => rec,
    clock: timer.clock,
    locale: "en",
    read: () => ({ text, revision, start: text.length, end: text.length }),
    write: (value) => {
      text = value;
      revision++;
    },
    canStart: () => true,
    canHold: () => !text.trim(),
    heldStart: () => {
      if (text.trim()) return false;
      held++;
      return true;
    },
    heldRelease: () => {
      released++;
    },
    recording() {},
    error() {},
    ended() {},
  });
  const key = { key: " ", preventDefault() {} };
  speech.keydown(key);
  timer.advance(349);
  speech.keyup(key);
  expect(text).toBe(" ");
  expect(held).toBe(0);
  speech.keydown(key);
  timer.advance(350);
  speech.keyup(key);
  expect(held).toBe(1);
  expect(released).toBe(1);
  expect(started).toBe(0);
  text = "existing";
  speech.keydown(key);
  timer.advance(350);
  speech.keyup(key);
  expect(started).toBe(1);
  speech.dispose();
});
test("microphone hold remains finite and active-Fire tap delegates recording toggle", () => {
  const timer = manualClock();
  let armed = 0,
    toggles = 0,
    dictates = 0,
    live = false;
  const charge: (number | null)[] = [];
  const mic = createMicrophoneGesture({
    clock: timer.clock,
    current: () => true,
    recording: () => false,
    start: () => {
      dictates++;
    },
    stop() {},
    fireLive: () => live,
    stopFire: () => {
      toggles++;
    },
    armFire: () => {
      armed++;
      live = true;
    },
    charge: (value) => charge.push(value),
  });
  mic.begin(1);
  timer.advance(399);
  expect(charge.at(-1)).toBeNull();
  timer.advance(1);
  expect(charge.at(-1)).toBe(0);
  timer.advance(2600);
  expect(armed).toBe(1);
  mic.end(1);
  expect(dictates).toBe(0);
  mic.begin(2);
  mic.end(2);
  expect(toggles).toBe(1);
  mic.dispose();
  expect(timer.jobs.size).toBe(0);
});

test("Send/cancel intent invalidates late Whisper and media after release", async () => {
  const response = deferred<string>();
  const f = fixture({ transcribe: () => response.promise });
  await f.owner.hold();
  f.mics[0].chunk();
  f.owner.release();
  await settle();
  f.owner.suspend();
  response.resolve("late after explicit Send");
  await settle();
  expect(f.commands).toHaveLength(0);
  expect(get(f.owner.state).sending).toBe("none");
  expect(get(f.owner.state).text).toBe("");
  f.owner.dispose();
});

test("synchronous Leave during switching publication cannot queue a later on request", async () => {
  const f = fixture();
  let stopped = false;
  const unlisten = f.owner.state.subscribe((value) => {
    if (value.phase === "switching" && !stopped) {
      stopped = true;
      f.owner.stop();
    }
  });
  await f.owner.hold();
  await settle();
  expect(f.toggles).toEqual([false]);
  expect(f.mics).toHaveLength(0);
  expect(get(f.owner.state).phase).toBe("leaving");
  unlisten();
  f.owner.dispose();
});

test("Send/blur while recorder.stop is pending revokes its late final chunk and onstop", async () => {
  const mic = microphone();
  let transcriptions = 0;
  const f = fixture({
    capture: async () => ({ ...mic.capture, stop() {} }),
    transcribe: async () => {
      transcriptions++;
      return "late stop";
    },
  });
  await f.owner.hold();
  f.owner.release();
  f.owner.suspend();
  mic.chunk();
  mic.ended();
  await settle();
  expect(transcriptions).toBe(0);
  expect(f.commands).toHaveLength(0);
  expect(mic.counts.disposed).toBe(1);
  f.owner.dispose();
});

test("canonical before ACK cannot finish or accept a refused identical operation", async () => {
  for (const accepted of [true, false]) {
    const reply = deferred<CommandOutcome>();
    const f = fixture({ request: () => reply.promise });
    await f.owner.hold();
    f.mics[0].chunk();
    f.owner.release();
    await until(() => f.commands.length === 1);
    f.canonical();
    expect(get(f.owner.state).sending).toBe("message");
    expect(get(f.owner.state).sent).toBe("");
    reply.resolve(accepted ? { ok: true } : { ok: false, error: "offline" });
    await until(() =>
      accepted
        ? get(f.owner.state).sending === "none"
        : get(f.owner.state).error === "send-refused",
    );
    expect(get(f.owner.state).sent).toBe(
      accepted ? "Whisper owned utterance" : "",
    );
    f.owner.dispose();
  }
});

test("swipe-up locks once at forty pixels and pointer release does not toggle dictation", () => {
  const timer = manualClock();
  let locks = 0,
    starts = 0,
    stops = 0,
    live = false;
  const gesture = createMicrophoneGesture({
    clock: timer.clock,
    current: () => true,
    recording: () => false,
    start: () => {
      starts++;
    },
    stop: () => {
      stops++;
    },
    fireLive: () => live,
    stopFire: () => {
      live = false;
    },
    armFire: () => {},
    lockFire: () => {
      locks++;
      live = true;
    },
    charge() {},
  });
  gesture.begin(1, 100);
  gesture.move(2, 0);
  gesture.move(1, 61);
  expect(locks).toBe(0);
  gesture.move(1, 60);
  gesture.move(1, 0);
  gesture.end(1);
  timer.advance(4000);
  expect([locks, starts, stops]).toEqual([1, 0, 1]);
  gesture.begin(2, 100);
  gesture.end(2);
  expect(live).toBe(false);
  gesture.begin(3, 0);
  gesture.cancel();
  gesture.move(3, -100);
  expect(locks).toBe(1);
  gesture.dispose();
  expect(timer.jobs.size).toBe(0);
});

test("locked Fire rolls over on actual voiced silence, records during Whisper, and serializes distinct segments through canonical acknowledgement", async () => {
  let now = 0;
  const first = deferred<string>(),
    second = deferred<string>();
  const reads: Blob[] = [];
  const f = fixture({
    now: () => now,
    transcribe: async (blob) => {
      reads.push(blob);
      return reads.length === 1 ? first.promise : second.promise;
    },
  });
  f.owner.lock();
  await until(() => f.mics.length === 1 && f.mics[0].counts.starts === 1);
  expect(get(f.owner.state).locked).toBe(true);
  f.mics[0].level(0);
  now = 1000;
  f.mics[0].level(0);
  expect(f.mics[0].counts.stops).toBe(0);
  f.mics[0].chunk(3000);
  f.mics[0].level(0.03);
  now = 1800;
  f.mics[0].level(0);
  expect(f.mics[0].counts.stops).toBe(0);
  now = 1801;
  f.mics[0].level(0);
  await until(
    () =>
      f.mics.length === 2 &&
      f.mics[1].counts.starts === 1 &&
      reads.length === 1,
  );
  expect(get(f.owner.state).talking).toBe(true);
  f.mics[1].chunk(4000);
  f.mics[1].level(0.04);
  now = 2602;
  f.mics[1].level(0);
  await until(() => f.mics.length === 3);
  expect(reads).toHaveLength(1);
  first.resolve("first segment");
  await until(() => f.commands.length === 1);
  expect(reads).toHaveLength(1);
  f.canonical("first segment");
  await until(() => reads.length === 2);
  expect(reads.map((blob) => blob.size)).toEqual([3000, 4000]);
  second.resolve("second segment");
  await until(() => f.commands.length === 2);
  f.canonical("second segment");
  f.owner.unlock();
  await settle();
  expect(get(f.owner.state).locked).toBe(false);
  expect(get(f.owner.state).talking).toBe(false);
  f.owner.dispose();
  await settle();
  expect(f.timer.jobs.size).toBe(0);
});

test("locked recorder keeps its own final data while a newer recorder is active and teardown fences late events", async () => {
  const captures: ReturnType<typeof microphone>[] = [];
  const stopped: (() => void)[] = [];
  let now = 0;
  const f = fixture({
    now: () => now,
    capture: async () => {
      const mic = microphone(),
        original = mic.capture.start;
      mic.capture.start = (chunk, ended, failed) =>
        original(
          chunk,
          () => {
            stopped.push(ended);
          },
          failed,
        );
      captures.push(mic);
      return mic.capture;
    },
  });
  f.owner.lock();
  await until(() => captures.length === 1 && captures[0].counts.starts === 1);
  captures[0].chunk(2100);
  captures[0].level(0.1);
  now = 20001;
  captures[0].level(0.1);
  await until(() => captures.length === 2 && captures[1].counts.starts === 1);
  captures[0].chunk(900);
  stopped.shift()!();
  await until(() => f.commands.length === 1);
  expect(get(f.owner.state).talking).toBe(true);
  f.leave();
  captures[1].chunk();
  captures[1].ended();
  await settle();
  expect(f.commands).toHaveLength(1);
  expect(get(f.owner.state).locked).toBe(false);
  f.owner.dispose();
  expect(f.timer.jobs.size).toBe(0);
});

test("release publication cannot attach an old stopping recorder or its timer to a reentrant new locked session", async () => {
  const f = fixture();
  f.owner.lock();
  await until(() => f.mics.length === 1 && f.mics[0].counts.starts === 1);
  let replace = false;
  const unwatch = f.owner.state.subscribe((value) => {
    if (!replace && value.locked && !value.talking) {
      replace = true;
      f.owner.cancel();
      f.owner.lock();
    }
  });
  f.mics[0].chunk();
  f.owner.release();
  await until(() => f.mics.length === 2 && f.mics[1].counts.starts === 1);
  expect(f.mics[0].counts.disposed).toBe(1);
  expect(f.mics[0].counts.stops).toBe(0);
  f.mics[0].ended();
  f.timer.advance(21000);
  await settle();
  expect(f.commands).toHaveLength(0);
  expect(get(f.owner.state).locked).toBe(true);
  expect(get(f.owner.state).error).toBe("");
  unwatch();
  f.owner.dispose();
  await settle();
  expect(f.timer.jobs.size).toBe(0);
});

/** Native effects ports for the actual factory, not a mirrored capture owner. */
function browserAudioFixture(
  options: {
    resume?: () => Promise<boolean>;
    stream?: () => Promise<{ getTracks(): { stop(): void }[] }>;
  } = {},
) {
  let streams = 0,
    tracksStopped = 0,
    contexts = 0,
    contextsClosed = 0,
    resumes = 0,
    level = 0;
  const intervals = new Map<number, () => void>();
  let timer = 0;
  const records: {
    data: (blob: Blob) => void;
    ended: () => void;
    failed: () => void;
    starts: number;
    disposed: number;
  }[] = [];
  const factory = createFireCaptureFactory({
    stream:
      options.stream ??
      (async () => {
        streams++;
        return {
          getTracks: () => [
            {
              stop() {
                tracksStopped++;
              },
            },
          ],
        };
      }),
    recorder() {
      const rec = {
        data: (_blob: Blob) => {},
        ended: () => {},
        failed: () => {},
        starts: 0,
        disposed: 0,
      };
      records.push(rec);
      return {
        type: "audio/webm",
        start(
          data: (value: Blob) => void,
          ended: () => void,
          failed: () => void,
        ) {
          rec.starts++;
          rec.data = data;
          rec.ended = ended;
          rec.failed = failed;
        },
        stop() {},
        dispose() {
          rec.disposed++;
        },
      };
    },
    levels() {
      contexts++;
      return {
        resume: async () => {
          resumes++;
          return options.resume ? options.resume() : true;
        },
        sample: () => level,
        close: async () => {
          contextsClosed++;
        },
      };
    },
    interval(run: () => void) {
      const id = ++timer;
      intervals.set(id, run);
      return id;
    },
    clearInterval(id: number) {
      intervals.delete(id);
    },
  });
  return {
    factory,
    records,
    intervals,
    get counts() {
      return { streams, tracksStopped, contexts, contextsClosed, resumes };
    },
    sample(value: number) {
      level = value;
      for (const run of [...intervals.values()]) run();
    },
  };
}

test("actual capture adapter reuses one microphone and resumed level source across owned locked recorder handoffs", async () => {
  const resume = deferred<boolean>(),
    h = browserAudioFixture({ resume: () => resume.promise });
  const first = await h.factory();
  let samples = 0,
    oldData = 0;
  first.start(
    () => {
      oldData++;
    },
    () => {},
    () => {},
  );
  first.observeLevel?.(() => {
    samples++;
  });
  expect(h.intervals.size).toBe(0);
  expect(h.counts.resumes).toBe(1);
  resume.resolve(true);
  await settle();
  h.sample(0.1);
  expect(samples).toBe(1);
  const second = await h.factory();
  second.start(
    () => {},
    () => {},
    () => {},
  );
  second.observeLevel?.(() => {
    samples++;
  });
  first.dispose();
  await settle();
  h.records[0].data(new Blob(["late"]));
  h.sample(0.1);
  expect(oldData).toBe(0);
  expect(samples).toBe(2);
  expect(h.counts).toEqual({
    streams: 1,
    tracksStopped: 0,
    contexts: 1,
    contextsClosed: 0,
    resumes: 2,
  });
  h.factory.release?.();
  await settle();
  expect(h.counts.tracksStopped).toBe(1);
  expect(h.counts.contextsClosed).toBe(1);
  expect(h.intervals.size).toBe(0);
  h.records[1].ended();
  h.sample(0.1);
  expect(samples).toBe(2);
});

test("actual pool stops tracks on final unlocked onstop before a pending Whisper or message acknowledgement", async () => {
  const h = browserAudioFixture(),
    transcript = deferred<string>();
  const f = fixture({
    capture: h.factory,
    transcribe: () => transcript.promise,
  });
  await f.owner.hold();
  h.records[0].data(new Blob([new Uint8Array(3000)]));
  f.owner.release();
  expect(h.counts.tracksStopped).toBe(0);
  h.records[0].ended();
  await settle();
  expect(h.counts.tracksStopped).toBe(1);
  expect(get(f.owner.state).sending).toBe("transcribing");
  transcript.resolve("finished");
  await until(() => f.commands.length === 1);
  expect(h.counts.tracksStopped).toBe(1);
  expect(get(f.owner.state).sending).toBe("message");
  f.owner.dispose();
  await settle();
  expect(f.timer.jobs.size).toBe(0);
});

test("actual pool resumes neither sampling nor old callbacks after release and permits a fresh permission request after rejection", async () => {
  const resume = deferred<boolean>(),
    h = browserAudioFixture({ resume: () => resume.promise });
  const opened = await h.factory();
  let samples = 0;
  opened.start(
    () => {},
    () => {},
    () => {},
  );
  opened.observeLevel?.(() => {
    samples++;
  });
  h.factory.release?.();
  resume.resolve(true);
  await settle();
  expect(h.intervals.size).toBe(0);
  expect(samples).toBe(0);
  expect(h.counts.tracksStopped).toBe(1);
  const permission = deferred<{ getTracks(): { stop(): void }[] }>();
  let calls = 0,
    stopped = 0;
  const late = browserAudioFixture({
    stream: () => {
      calls++;
      return calls === 1 ? Promise.reject(Error("denied")) : permission.promise;
    },
  });
  await expect(late.factory()).rejects.toThrow("denied");
  const result = late.factory().then(
    () => false,
    () => true,
  );
  expect(calls).toBe(2);
  late.factory.release?.();
  permission.resolve({
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
  });
  expect(await result).toBe(true);
  expect(stopped).toBe(1);
  expect(late.records).toHaveLength(0);
});

test("failed suspended AudioContext resume halts the owned locked recorder and releases its actual stream", async () => {
  const h = browserAudioFixture({ resume: async () => false }),
    f = fixture({ capture: h.factory });
  f.owner.lock();
  await until(() => get(f.owner.state).error === "recording");
  expect(get(f.owner.state).locked).toBe(false);
  expect(get(f.owner.state).talking).toBe(false);
  expect(h.counts.tracksStopped).toBe(1);
  expect(h.intervals.size).toBe(0);
  f.owner.dispose();
  await settle();
});

test("an ending recorder watchdog fully stops the next active capture and cannot leave a locked microphone running", async () => {
  const h = browserAudioFixture();
  let now = 0;
  const f = fixture({ capture: h.factory, now: () => now });
  f.owner.lock();
  await until(() => h.records[0]?.starts === 1 && h.intervals.size === 1);
  h.records[0].data(new Blob([new Uint8Array(3000)]));
  h.sample(0.1);
  now = 801;
  h.sample(0);
  await until(() => h.records.length === 2 && h.records[1].starts === 1);
  f.timer.advance(20000);
  await settle();
  expect(get(f.owner.state).locked).toBe(false);
  expect(get(f.owner.state).talking).toBe(false);
  expect(get(f.owner.state).error).toBe("recording");
  expect(h.counts.tracksStopped).toBe(1);
  expect(h.intervals.size).toBe(0);
  h.records[0].ended();
  h.records[1].data(new Blob([new Uint8Array(3000)]));
  h.records[1].ended();
  await settle();
  expect(f.commands).toHaveLength(0);
  f.owner.dispose();
  await settle();
});

test("explicit discard clears the unsent locked backlog so a fresh utterance cannot replay old audio", async () => {
  const first = deferred<string>();
  let now = 0,
    reads = 0;
  const f = fixture({
    now: () => now,
    transcribe: async () => (++reads === 1 ? first.promise : "fresh only"),
    request: async () => ({ ok: false, error: "timeout" }),
  });
  f.owner.lock();
  await until(() => f.mics[0]?.counts.starts === 1);
  f.mics[0].chunk();
  f.mics[0].level(0.1);
  now = 801;
  f.mics[0].level(0);
  await until(() => f.mics[1]?.counts.starts === 1);
  f.mics[1].chunk();
  f.mics[1].level(0.1);
  now = 1602;
  f.mics[1].level(0);
  await until(() => f.mics[2]?.counts.starts === 1);
  first.resolve("uncertain first");
  await until(() => get(f.owner.state).sending === "unconfirmed");
  const intent = get(f.owner.state).intent;
  f.owner.discard(intent);
  await f.owner.hold();
  f.mics.at(-1)!.chunk();
  f.owner.release();
  await until(() => f.commands.length === 2);
  expect(reads).toBe(2);
  expect(
    f.commands.map((command) => (command.t === "msg" ? command.text : "")),
  ).toEqual(["uncertain first", "fresh only"]);
  f.owner.dispose();
  await settle();
});
