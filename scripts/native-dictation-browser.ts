/** Real Chromium/Worker gesture and media lifecycle proof. Fake input is an
 * explicit continuous tone; no API, canonical state, STT or runner is mocked. */
import { sentFrame } from "./room-frames";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import type { NativeApplicationAuditFixture } from "./native-application-browser-types";

type MediaSnapshot = {
  streams: number;
  recorderStarts: number;
  recorderStops: number;
  activeTracks: number;
  contexts: number;
  totalContexts: number;
  openContexts: number;
  runningContexts: number;
  samples: number;
  voicedSamples: number;
  pointer: number | null;
};
declare global {
  interface Window {
    __vbDictationMedia?: MediaSnapshot;
  }
}
/** Call before launching the real cohort. Generated PCM is synthetic fixture
 * input, not a recording, and never included in a server request by this audit. */
export async function writeDictationTone(output: string) {
  await mkdir(output, { recursive: true });
  const rate = 48000,
    frames = rate * 12,
    data = Buffer.alloc(44 + frames * 2);
  data.write("RIFF");
  data.writeUInt32LE(data.length - 8, 4);
  data.write("WAVEfmt ", 8);
  data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20);
  data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24);
  data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32);
  data.writeUInt16LE(16, 34);
  data.write("data", 36);
  data.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++)
    data.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 440) / rate) * 32767 * 0.1),
      44 + i * 2,
    );
  const file = join(output, "dictation-tone.wav");
  await writeFile(file, data);
  return file;
}
export const dictationBrowserArgs = (toneFile: string) => [
  "--disable-speech-api",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  `--use-file-for-fake-audio-capture=${toneFile}`,
];

export async function auditNativeDictation(
  fixture: NativeApplicationAuditFixture,
) {
  const report: {
    fixture: string;
    status: string;
    phase: string;
    liveModeRequests: number;
    sttRequests: number;
    messageWrites: number;
    sameButton: boolean;
    afterStart: MediaSnapshot | null;
    afterCancel: MediaSnapshot | null;
    error: string;
    pageErrors: string[];
    cleanupErrors: string[];
  } = {
    fixture:
      "synthetic 440Hz PCM; actual browser microphone capture canceled before transcription",
    status: "running",
    phase: "context",
    liveModeRequests: 0,
    sttRequests: 0,
    messageWrites: 0,
    sameButton: false,
    afterStart: null,
    afterCancel: null,
    error: "",
    pageErrors: [],
    cleanupErrors: [],
  };
  let context:
    | Awaited<
        ReturnType<NativeApplicationAuditFixture["createProfile"]>
      >["context"]
    | undefined;
  let original: Awaited<
    ReturnType<import("@playwright/test").Locator["elementHandle"]>
  > | null = null;
  const operation = async (name: string, run: () => Promise<void>) => {
    report.phase = name;
    await fixture.step(`Dictation: ${name}`, run);
  };
  try {
    const profile = await fixture.createProfile({
      lang: "en",
      theme: "light",
      width: 390,
    });
    context = profile.context;
    const page = profile.page;
    // This independent fresh context reloads once to install metadata-only
    // native observers before the application acquires any media resources.
    await page.addInitScript(() => {
      if (window !== window.top) return;
      const tracks: MediaStreamTrack[] = [],
        contexts: AudioContext[] = [];
      const state: MediaSnapshot = {
        streams: 0,
        recorderStarts: 0,
        recorderStops: 0,
        activeTracks: 0,
        contexts: 0,
        totalContexts: 0,
        openContexts: 0,
        runningContexts: 0,
        samples: 0,
        voicedSamples: 0,
        pointer: null,
      };
      Object.defineProperties(state, {
        activeTracks: {
          get: () => tracks.filter((t) => t.readyState === "live").length,
        },
        openContexts: {
          get: () => contexts.filter((c) => c.state !== "closed").length,
        },
        runningContexts: {
          get: () => contexts.filter((c) => c.state === "running").length,
        },
      });
      window.__vbDictationMedia = state;
      const acquire = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await acquire(constraints);
        state.streams++;
        tracks.push(...stream.getAudioTracks());
        return stream;
      };
      const NativeMediaRecorder = window.MediaRecorder;
      window.MediaRecorder = class extends NativeMediaRecorder {
        override start(timeslice?: number) {
          super.start(timeslice);
          state.recorderStarts++;
        }
        override stop() {
          super.stop();
          state.recorderStops++;
        }
      };
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        constructor(options?: AudioContextOptions) {
          super(options);
          state.totalContexts++;
        }
        override createMediaStreamSource(stream: MediaStream) {
          const source = super.createMediaStreamSource(stream);
          // The application's notification chime owns a separate output-only
          // context. Count every context, but assert cleanup of microphone input.
          if (!contexts.includes(this)) {
            contexts.push(this);
            state.contexts++;
          }
          return source;
        }
        override createAnalyser() {
          const analyser = super.createAnalyser(),
            read = analyser.getFloatTimeDomainData.bind(analyser);
          analyser.getFloatTimeDomainData = (data) => {
            read(data);
            state.samples++;
            let sum = 0;
            for (const value of data) sum += value * value;
            if (Math.sqrt(sum / data.length) > 0.02) state.voicedSamples++;
          };
          return analyser;
        }
      };
      document.addEventListener(
        "pointerdown",
        (event) => {
          if (
            event.target instanceof Element &&
            event.target.closest('button[aria-label="Dictate message"]')
          )
            state.pointer = event.pointerId;
        },
        true,
      );
    });
    const pathname = `/api/books/${encodeURIComponent(fixture.roomId)}`;
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        url.origin !== new URL(fixture.base).origin ||
        request.method() !== "POST"
      )
        return;
      if (url.pathname === `${pathname}/fire`) report.liveModeRequests++;
      if (url.pathname === `${pathname}/stt`) report.sttRequests++;
      if (url.pathname === `${pathname}/post`) report.messageWrites++;
    });
    page.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname !== `/ws/${fixture.roomId}`) return;
      socket.on("framesent", (frame) => {
        if (typeof frame.payload !== "string") return;
        if (sentFrame(frame.payload)?.t === "msg") report.messageWrites++;
      });
    });
    page.on("pageerror", (error) => report.pageErrors.push(error.name));
    await page.goto(`${fixture.base}/b/${fixture.roomId}?ui=svelte`, {
      waitUntil: "domcontentloaded",
    });
    const media = () =>
      page.evaluate(() => {
        const state = window.__vbDictationMedia;
        if (!state) throw Error("Media observer missing");
        return {
          streams: state.streams,
          recorderStarts: state.recorderStarts,
          recorderStops: state.recorderStops,
          activeTracks: state.activeTracks,
          contexts: state.contexts,
          totalContexts: state.totalContexts,
          openContexts: state.openContexts,
          runningContexts: state.runningContexts,
          samples: state.samples,
          voicedSamples: state.voicedSamples,
          pointer: state.pointer,
        };
      });
    await operation("real composer readiness", async () => {
      assert.equal(new URL(page.url()).pathname, `/b/${fixture.roomId}`);
      await expect(
        page.locator("[data-native-composer] textarea"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Dictate message", exact: true }),
      ).toBeEnabled();
      assert.deepEqual(await media(), {
        streams: 0,
        recorderStarts: 0,
        recorderStops: 0,
        activeTracks: 0,
        contexts: 0,
        totalContexts: 0,
        openContexts: 0,
        runningContexts: 0,
        samples: 0,
        voicedSamples: 0,
        pointer: null,
      });
    });
    const mic = page.getByRole("button", {
      name: "Dictate message",
      exact: true,
    });
    const heldButton = await mic.elementHandle();
    assert(heldButton);
    original = heldButton;
    const box = await mic.boundingBox();
    assert(box);
    await operation("mic tap starts actual browser capture", async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.up();
      await expect.poll(async () => (await media()).activeTracks).toBe(1);
      await expect(mic).toHaveAttribute("aria-pressed", "true");
      await expect.poll(async () => (await media()).recorderStarts).toBe(1);
      report.sameButton = await heldButton.evaluate((node) => node.isConnected);
      assert(report.sameButton);
      report.afterStart = await media();
      assert.equal(report.afterStart.streams, 1);
      assert.equal(report.liveModeRequests, 0);
      assert.equal(report.sttRequests, 0);
      assert.equal(report.messageWrites, 0);
    });
    await operation(
      "Escape cancels actual media without sending or transcription",
      async () => {
        await page.locator("[data-native-composer] textarea").focus();
        await page.keyboard.press("Escape");
        await expect.poll(async () => (await media()).activeTracks).toBe(0);
        await expect.poll(async () => (await media()).openContexts).toBe(0);
        report.afterCancel = await media();
        assert.equal(report.afterCancel.recorderStarts, 1);
        assert.equal(report.afterCancel.recorderStops, 1);
        assert.equal(report.liveModeRequests, 0);
        assert.equal(report.sttRequests, 0);
        assert.equal(report.messageWrites, 0);
        assert.deepEqual(report.pageErrors, []);
      },
    );
    report.status = "passed";
    report.phase = "complete";
    return report;
  } catch (error) {
    report.status = "failed";
    report.error = error instanceof Error ? error.name : "UnknownError";
    throw error;
  } finally {
    await original?.dispose().catch(() => {});
    let cleanupError: unknown;
    if (context) {
      try {
        await context.close();
      } catch (error) {
        report.status = "failed";
        report.error = "ContextCleanupError";
        report.cleanupErrors.push("ContextCleanupError");
        cleanupError = error;
      }
    }
    await mkdir(fixture.output, { recursive: true });
    await writeFile(
      join(fixture.output, "native-dictation.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (cleanupError) throw cleanupError;
  }
}
