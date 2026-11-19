// Direct native-effect adapter coverage retained when runner Fire was retired.
import { expect, test } from "bun:test";
import { createFireCaptureFactory } from "../web/features/composer/fireAudio";
import { createDictationController } from "../web/features/composer/dictation";
import { deferred, manualClock, settle } from "./home-fixtures";
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

test("actual capture adapter reuses one microphone and resumed level source across owned recorder handoffs", async () => {
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

test("ordinary dictation releases actual tracks before awaiting Whisper and fences every late native callback", async () => {
  const h = browserAudioFixture(),
    result = deferred<string>(),
    timer = manualClock();
  let text = "",
    revision = 0,
    reads = 0,
    refining = false,
    recording = false;
  const owner = createDictationController({
    capture: h.factory,
    clock: timer.clock,
    locale: "en",
    current: () => true,
    canStart: () => true,
    read: () => ({ text, revision, start: text.length, end: text.length }),
    write(value) {
      text = value;
      revision++;
    },
    recording(value) {
      recording = value;
    },
    refining(value) {
      refining = value;
    },
    error() {},
    ended() {},
    transcribe: () => {
      reads++;
      return result.promise;
    },
  });
  await owner.start();
  expect(h.counts.streams).toBe(1);
  expect(h.counts.contexts).toBe(0);
  h.records[0].data(new Blob([new Uint8Array(3000)]));
  owner.stop();
  expect(recording).toBe(false);
  expect(h.counts.tracksStopped).toBe(0);
  h.records[0].ended();
  await settle();
  expect(h.counts.tracksStopped).toBe(1);
  expect(refining).toBe(true);
  expect(reads).toBe(1);
  h.records[0].data(new Blob([new Uint8Array(3000)]));
  h.records[0].ended();
  h.records[0].failed();
  await settle();
  expect(reads).toBe(1);
  expect(refining).toBe(true);
  result.resolve("finished");
  await settle();
  expect(text).toBe("finished");
  expect(refining).toBe(false);
  expect(timer.jobs.size).toBe(0);
  owner.dispose();
  expect(h.counts.tracksStopped).toBe(1);
  expect(h.intervals.size).toBe(0);
});
