// Ordinary dictation owners; no runner mode or automatic message dispatch.
import { expect, test } from "bun:test";
import { createDictationController } from "../web/features/composer/dictation";
import type {
  FireCapture,
  FireCaptureFactory,
} from "../web/features/composer/fireAudio";
import { createFireCaptureFactory } from "../web/features/composer/fireAudio";
import {
  createVoiceApi,
  VoiceFailure,
} from "../web/features/composer/voiceApi";
import type { SpeechRecognizer } from "../web/features/composer/speech";
import { manualClock, deferred, settle } from "./native-home-fixtures";
function fixture(
  input: {
    preview?: boolean;
    delayed?: boolean;
    text?: string;
    transcribe?: (audio: Blob, signal: AbortSignal) => Promise<string>;
  } = {},
) {
  const clock = manualClock(),
    permission = deferred<FireCapture>();
  let text = input.text ?? "base",
    revision = 0,
    current = true,
    recording = false,
    refining = false,
    starts = 0,
    stops = 0,
    releases = 0,
    disposed = 0,
    reads = 0,
    ended = 0,
    error = "";
  let chunk: (data: Blob) => void = () => {},
    done = () => {},
    failed = () => {};
  const capture: FireCapture = {
    type: "audio/webm",
    start(c, d, f) {
      starts++;
      chunk = c;
      done = d;
      failed = f;
    },
    stop() {
      stops++;
    },
    dispose() {
      disposed++;
    },
  };
  const factory: FireCaptureFactory = () =>
    input.delayed ? permission.promise : Promise.resolve(capture);
  factory.release = () => {
    releases++;
  };
  const sr: SpeechRecognizer = {
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
  const owner = createDictationController({
    factory: input.preview ? () => sr : undefined,
    capture: factory,
    clock: clock.clock,
    locale: "pt-BR",
    read: () => ({ text, revision, start: text.length, end: text.length }),
    write(value) {
      text = value;
      revision++;
    },
    current: () => current,
    canStart: () => current,
    recording(value) {
      recording = value;
    },
    refining(value) {
      refining = value;
    },
    error(value) {
      error = value;
    },
    ended() {
      ended++;
    },
    transcribe: (audio, signal) => {
      reads++;
      return input.transcribe?.(audio, signal) ?? Promise.resolve("corrected");
    },
  });
  return {
    owner,
    clock,
    sr,
    permission,
    capture,
    state: () => ({
      text,
      revision,
      recording,
      refining,
      starts,
      stops,
      releases,
      disposed,
      reads,
      ended,
      error,
    }),
    chunk: (size = 3000) => chunk(new Blob([new Uint8Array(size)])),
    done: () => done(),
    failed: () => failed(),
    edit(value: string) {
      text = value;
      revision++;
      owner.sync();
    },
    lose() {
      current = false;
      owner.sync();
    },
  };
}
test("capture-only dictation refines the draft after release without a message capability", async () => {
  const f = fixture();
  await f.owner.start();
  f.chunk();
  expect(f.state().recording).toBe(true);
  expect(f.state().reads).toBe(0);
  f.owner.stop();
  f.done();
  await settle();
  expect(f.state().text).toBe("base corrected");
  expect(f.state().recording).toBe(false);
  expect(f.state().reads).toBe(1);
  expect(f.state().refining).toBe(false);
  expect(f.state().releases).toBeGreaterThan(0);
  expect(f.clock.jobs.size).toBe(0);
  f.owner.dispose();
});
test("release freezes preview and Whisper replaces only the same owned draft revision", async () => {
  const result = deferred<string>(),
    f = fixture({ preview: true, transcribe: () => result.promise });
  await f.owner.start();
  const late = f.sr.onresult;
  late?.({ results: [[{ transcript: "rough" }]] });
  expect(f.state().text).toBe("base rough");
  f.chunk();
  f.owner.stop();
  f.done();
  await settle();
  late?.({ results: [[{ transcript: "late" }]] });
  expect(f.state().text).toBe("base rough");
  result.resolve("better");
  await settle();
  expect(f.state().text).toBe("base better");
  f.owner.dispose();
});
test("editing, submitting/canceling, or losing scope revokes late refinement", async () => {
  for (const loss of ["edit", "cancel", "scope"] as const) {
    const result = deferred<string>();
    let signal: AbortSignal | undefined;
    const f = fixture({
      transcribe: (_audio, value) => {
        signal = value;
        return result.promise;
      },
    });
    await f.owner.start();
    f.chunk();
    f.owner.stop();
    f.done();
    await settle();
    if (loss === "edit") f.edit("newer draft");
    else if (loss === "scope") f.lose();
    else f.owner.cancel();
    result.resolve("late");
    await settle();
    expect(f.state().text).toBe(loss === "edit" ? "newer draft" : "base");
    expect(signal?.aborted).toBe(true);
    expect(f.clock.jobs.size).toBe(0);
    f.owner.dispose();
  }
});
test("programmatic draft revision changes release an active microphone and stopping callbacks", async () => {
  const f = fixture();
  await f.owner.start();
  f.chunk();
  f.edit("reply changed");
  f.done();
  await settle();
  expect(f.state().recording).toBe(false);
  expect(f.state().reads).toBe(0);
  expect(f.state().disposed).toBeGreaterThan(0);
  expect(f.state().text).toBe("reply changed");
  f.owner.dispose();
});
test("permission cancellation/deadline disposes a late recorder without starting it", async () => {
  for (const deadline of [false, true]) {
    const f = fixture({ delayed: true }),
      start = f.owner.start();
    if (deadline) f.clock.advance(20_000);
    else f.owner.stop();
    f.permission.resolve(f.capture);
    await start;
    expect(f.state().starts).toBe(0);
    expect(f.state().disposed).toBeGreaterThan(0);
    expect(f.clock.jobs.size).toBe(0);
    f.owner.dispose();
  }
});
test("small, oversized and canceled recordings never reach transcription", async () => {
  for (const kind of ["small", "oversized", "cancel"] as const) {
    const f = fixture();
    await f.owner.start();
    f.chunk(kind === "small" ? 100 : kind === "oversized" ? 4_000_001 : 3000);
    if (kind === "cancel") f.owner.cancel();
    else f.owner.stop();
    f.done();
    await settle();
    expect(f.state().reads).toBe(0);
    expect(f.clock.jobs.size).toBe(0);
    f.owner.dispose();
  }
});
test("natural recorder end and missing-onstop watchdog leave no active owner", async () => {
  const natural = fixture();
  await natural.owner.start();
  natural.chunk();
  natural.done();
  await settle();
  expect(natural.state().recording).toBe(false);
  await natural.owner.start();
  expect(natural.state().starts).toBe(2);
  natural.owner.dispose();
  const stopped = fixture();
  await stopped.owner.start();
  stopped.owner.stop();
  stopped.clock.advance(5000);
  expect(stopped.state().disposed).toBeGreaterThan(0);
  expect(stopped.state().recording).toBe(false);
  stopped.owner.dispose();
});
test("Whisper failure keeps live preview and its finite deadline aborts ignored providers", async () => {
  const f = fixture({
    preview: true,
    transcribe: async () => {
      throw Error("offline");
    },
  });
  await f.owner.start();
  f.sr.onresult?.({ results: [[{ transcript: "rough" }]] });
  f.chunk();
  f.owner.stop();
  f.done();
  await settle();
  expect(f.state().text).toBe("base rough");
  expect(f.state().error).toBe("failed");
  f.owner.dispose();
  let signal: AbortSignal | undefined;
  const slow = fixture({
    transcribe: (_audio, value) => {
      signal = value;
      return new Promise(() => {});
    },
  });
  await slow.owner.start();
  slow.chunk();
  slow.owner.stop();
  slow.done();
  await settle();
  slow.clock.advance(20_000);
  expect(signal?.aborted).toBe(true);
  expect(slow.state().refining).toBe(false);
  expect(slow.clock.jobs.size).toBe(0);
  slow.owner.dispose();
});
test("Space tap inserts a space, held Space captures and release only refines", async () => {
  const f = fixture();
  const key = { key: " ", preventDefault() {} };
  f.owner.keydown(key);
  f.owner.keyup(key);
  expect(f.state().text).toBe("base ");
  f.owner.keydown(key);
  f.clock.advance(350);
  await settle();
  expect(f.state().starts).toBe(1);
  f.chunk();
  f.owner.keyup(key);
  f.done();
  await settle();
  expect(f.state().text).toBe("base corrected");
  f.owner.dispose();
});
test("actual capture factory releases shared tracks and fences late permission epochs without level sampling", async () => {
  const permission = deferred<{ getTracks(): { stop(): void }[] }>();
  let stopped = 0,
    dispatched = 0;
  const factory = createFireCaptureFactory({
    stream: () => permission.promise,
    recorder: () => ({
      type: "audio/webm",
      start() {
        dispatched++;
      },
      stop() {},
      dispose() {},
    }),
    levels: () => {
      throw Error("Ordinary dictation must not request RMS sampling");
    },
    interval: () => 1,
    clearInterval() {},
  });
  const pending = factory();
  factory.release?.();
  permission.resolve({
    getTracks: () => [
      {
        stop() {
          stopped++;
        },
      },
    ],
  });
  await expect(pending).rejects.toThrow("Released audio permission");
  expect(stopped).toBe(1);
  expect(dispatched).toBe(0);
});
test("typed Whisper adapter rejects HTML/wrongshape/403 and forwards only bounded validated text", async () => {
  for (const response of [
    new Response("html"),
    Response.json({ ok: false }),
    Response.json({ error: "forbidden" }, { status: 403 }),
  ]) {
    const api = createVoiceApi(async () => response);
    await expect(
      api.transcribe(
        "room",
        new Blob(["audio"]),
        { lang: "en", prompt: "room" },
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(VoiceFailure);
  }
  const api = createVoiceApi(async () =>
    Response.json({ ok: true, text: "words" }),
  );
  expect(
    await api.transcribe(
      "room",
      new Blob(["audio"]),
      { lang: "en", prompt: "room" },
      new AbortController().signal,
    ),
  ).toBe("words");
});

test("capture present without STT retains recognition-only recording and stop feedback", async () => {
  let recording = false,
    stops = 0,
    ended = 0;
  const sr: SpeechRecognizer = {
    lang: "",
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {},
    stop() {
      stops++;
      this.onend?.({});
    },
    abort() {},
  };
  const owner = createDictationController({
    factory: () => sr,
    capture: async () => {
      throw Error("No STT means no native capture");
    },
    clock: manualClock().clock,
    locale: "en",
    read: () => ({ text: "", start: 0, end: 0, revision: 0 }),
    write() {},
    current: () => true,
    canStart: () => true,
    recording(value) {
      recording = value;
    },
    refining() {},
    error() {},
    ended() {
      ended++;
    },
  });
  await owner.start();
  expect(recording).toBe(true);
  owner.stop();
  expect(stops).toBe(1);
  expect(recording).toBe(false);
  expect(ended).toBe(1);
  owner.dispose();
});

test("draft edit while native stop is pending revokes its final audio immediately", async () => {
  const f = fixture();
  await f.owner.start();
  f.chunk();
  f.owner.stop();
  const released = f.state().releases;
  f.edit("attachment/reply revision");
  expect(f.state().releases).toBeGreaterThan(released);
  f.chunk();
  f.done();
  await settle();
  expect(f.state().reads).toBe(0);
  expect(f.state().text).toBe("attachment/reply revision");
  expect(f.clock.jobs.size).toBe(0);
  f.owner.dispose();
});

test("Enter intent stops recording and receives only the owned refined snapshot", async () => {
  const result = deferred<string>(),
    f = fixture({ preview: true, transcribe: () => result.promise });
  await f.owner.start();
  f.sr.onresult?.({ results: [[{ transcript: "rough" }]] });
  f.chunk();
  const submitted = f.owner.finish();
  expect(f.state().stops).toBe(1);
  f.done();
  await settle();
  expect(f.state().refining).toBe(true);
  result.resolve("refined");
  expect(await submitted).toEqual({ text: "base refined", revision: 2 });
  expect(f.clock.jobs.size).toBe(0);
  f.owner.dispose();
});

test("Enter while Whisper is pending waits at most eight seconds and late text is inert", async () => {
  const result = deferred<string>(),
    f = fixture({ preview: true, transcribe: () => result.promise });
  await f.owner.start();
  f.sr.onresult?.({ results: [[{ transcript: "rough" }]] });
  f.chunk();
  f.owner.stop();
  f.done();
  await settle();
  const submitted = f.owner.finish();
  f.clock.advance(7999);
  expect(f.state().refining).toBe(true);
  f.clock.advance(1);
  expect(await submitted).toEqual({ text: "base rough", revision: 1 });
  result.resolve("late refined");
  await settle();
  expect(f.state().text).toBe("base rough");
  expect(f.state().refining).toBe(false);
  expect(f.clock.jobs.size).toBe(0);
  f.owner.dispose();
});

test("Escape, edit, scope change and disposal cancel the waiting submission identity", async () => {
  for (const loss of ["cancel", "edit", "scope", "dispose"] as const) {
    const result = deferred<string>(),
      f = fixture({ transcribe: () => result.promise });
    await f.owner.start();
    f.chunk();
    const submitted = f.owner.finish();
    f.done();
    await settle();
    if (loss === "edit") f.edit("new draft");
    else if (loss === "scope") f.lose();
    else if (loss === "dispose") f.owner.dispose();
    else f.owner.cancel();
    expect(await submitted).toBeNull();
    result.resolve("late");
    await settle();
    expect(f.state().text).toBe(loss === "edit" ? "new draft" : "base");
    expect(f.clock.jobs.size).toBe(0);
    f.owner.dispose();
  }
});

test("ordinary typed draft needs no transcription and failed refinement returns its current preview", async () => {
  const typed = fixture();
  typed.edit("typed");
  expect(await typed.owner.finish()).toEqual({ text: "typed", revision: 1 });
  typed.owner.dispose();
  const f = fixture({
    preview: true,
    transcribe: async () => {
      throw Error("offline");
    },
  });
  await f.owner.start();
  f.sr.onresult?.({ results: [[{ transcript: "rough" }]] });
  f.chunk();
  const submitted = f.owner.finish();
  f.done();
  expect(await submitted).toEqual({ text: "base rough", revision: 1 });
  expect(f.clock.jobs.size).toBe(0);
  f.owner.dispose();
});

test("capture-only empty-draft Enter waits for Whisper before the ordinary empty-text decision", async () => {
  const result = deferred<string>(),
    f = fixture({ text: "", transcribe: () => result.promise });
  await f.owner.start();
  f.chunk();
  const submitted = f.owner.finish();
  f.done();
  await settle();
  expect(f.state().text).toBe("");
  result.resolve("first words");
  expect(await submitted).toEqual({ text: "first words", revision: 1 });
  f.owner.dispose();
});

test("the eight-second Enter budget includes delayed native stop and pending refinement", async () => {
  const result = deferred<string>(),
    f = fixture({ transcribe: () => result.promise });
  await f.owner.start();
  f.chunk();
  const submitted = f.owner.finish();
  f.clock.advance(4000);
  f.done();
  await settle();
  f.clock.advance(3999);
  expect(f.state().refining).toBe(true);
  f.clock.advance(1);
  expect(await submitted).toEqual({ text: "base", revision: 0 });
  result.resolve("too late");
  await settle();
  expect(f.state().text).toBe("base");
  expect(f.clock.jobs.size).toBe(0);
  f.owner.dispose();
});

test("a recorder which never confirms stop cancels the waiting send and preserves the draft", async () => {
  const f = fixture();
  await f.owner.start();
  f.chunk();
  const submitted = f.owner.finish();
  f.clock.advance(5000);
  expect(await submitted).toBeNull();
  expect(f.state().text).toBe("base");
  expect(f.state().reads).toBe(0);
  expect(f.clock.jobs.size).toBe(0);
  f.owner.dispose();
});
