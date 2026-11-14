/** Real Chromium/Worker gesture and media lifecycle proof. Fake input is an
 * explicit continuous tone; no API, canonical state, STT or runner is mocked. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect } from "@playwright/test";
import type { NativeApplicationAuditFixture } from "./native-application-browser-types";
import { FireBody, FireResult } from "../shared/schemas";

type MediaSnapshot = {
  streams: number;
  activeTracks: number;
  contexts: number;
  openContexts: number;
  runningContexts: number;
  samples: number;
  voicedSamples: number;
  pointer: number | null;
};
declare global {
  interface Window {
    __vbFireGestureMedia?: MediaSnapshot;
  }
}
/** Call before launching the real cohort. Generated PCM is synthetic fixture
 * input, not a recording, and never included in a server request by this audit. */
export async function writeFireGestureTone(output: string) {
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
  const file = join(output, "fire-continuous-tone.wav");
  await writeFile(file, data);
  return file;
}
export const fireGestureBrowserArgs = (toneFile: string) => [
  "--disable-speech-api",
  "--use-fake-device-for-media-stream",
  "--use-fake-ui-for-media-stream",
  `--use-file-for-fake-audio-capture=${toneFile}`,
];

export async function auditNativeFireGesture(
  fixture: NativeApplicationAuditFixture,
) {
  const report: {
    fixture: string;
    status: string;
    phase: string;
    fireOn: number;
    fireOff: number;
    sttRequests: number;
    messageWrites: number;
    sameButton: boolean;
    retainedCapture: boolean;
    afterLock: MediaSnapshot | null;
    afterCancel: MediaSnapshot | null;
    error: string;
    pageErrors: string[];
  } = {
    fixture:
      "continuous synthetic 440Hz PCM; no quiet window; canceled before20s",
    status: "running",
    phase: "context",
    fireOn: 0,
    fireOff: 0,
    sttRequests: 0,
    messageWrites: 0,
    sameButton: false,
    retainedCapture: false,
    afterLock: null,
    afterCancel: null,
    error: "",
    pageErrors: [],
  };
  let context:
    | Awaited<
        ReturnType<NativeApplicationAuditFixture["createProfile"]>
      >["context"]
    | undefined;
  let original: Awaited<
    ReturnType<import("@playwright/test").Locator["elementHandle"]>
  > = null;
  const operation = async (name: string, run: () => Promise<void>) => {
    report.phase = name;
    await fixture.step(`Fire gesture: ${name}`, run);
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
      const tracks: MediaStreamTrack[] = [],
        contexts: AudioContext[] = [];
      const state: MediaSnapshot = {
        streams: 0,
        activeTracks: 0,
        contexts: 0,
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
      window.__vbFireGestureMedia = state;
      const acquire = navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await acquire(constraints);
        state.streams++;
        tracks.push(...stream.getAudioTracks());
        return stream;
      };
      const NativeAudioContext = window.AudioContext;
      window.AudioContext = class extends NativeAudioContext {
        constructor(options?: AudioContextOptions) {
          super(options);
          contexts.push(this);
          state.contexts++;
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
      if (url.pathname === `${pathname}/stt`) report.sttRequests++;
      if (url.pathname === `${pathname}/post`) report.messageWrites++;
    });
    page.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname !== `/ws/${fixture.roomId}`) return;
      socket.on("framesent", (frame) => {
        if (typeof frame.payload !== "string") return;
        try {
          const raw: unknown = JSON.parse(frame.payload);
          if (
            typeof raw === "object" &&
            raw !== null &&
            "t" in raw &&
            raw.t === "msg"
          )
            report.messageWrites++;
        } catch {}
      });
    });
    page.on("pageerror", (error) => report.pageErrors.push(error.name));
    await page.reload({ waitUntil: "domcontentloaded" });
    const media = () =>
      page.evaluate(() => {
        const state = window.__vbFireGestureMedia;
        if (!state) throw Error("Media observer missing");
        return {
          streams: state.streams,
          activeTracks: state.activeTracks,
          contexts: state.contexts,
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
        activeTracks: 0,
        contexts: 0,
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
    const fireResponse = (on: boolean) =>
      page.waitForResponse(
        (response) => {
          const request = response.request();
          if (
            new URL(response.url()).origin !== new URL(fixture.base).origin ||
            new URL(response.url()).pathname !== `${pathname}/fire` ||
            request.method() !== "POST"
          )
            return false;
          try {
            const body = FireBody.safeParse(request.postDataJSON());
            return body.success && body.data.on === on;
          } catch {
            return false;
          }
        },
        { timeout: 10_000 },
      );
    const onResponse = fireResponse(true);
    void onResponse.catch(() => {});
    await operation("real three-second hold and D1 Fire-on", async () => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const response = await onResponse;
      assert.equal(response.status(), 200);
      FireResult.parse(await response.json());
      report.fireOn++;
      await expect(page.locator("[data-native-fire-listening]")).toBeVisible();
      await expect.poll(async () => (await media()).activeTracks).toBe(1);
    });
    await operation(
      "same held button retains real pointer capture",
      async () => {
        report.sameButton = await heldButton.evaluate(
          (node) =>
            node.isConnected &&
            node ===
              document.querySelector('button[aria-label="Dictate message"]'),
        );
        report.retainedCapture = await heldButton.evaluate((node) => {
          const id = window.__vbFireGestureMedia?.pointer;
          return id !== null && id !== undefined && node.hasPointerCapture(id);
        });
        assert(report.sameButton);
        assert(report.retainedCapture);
        await page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2 - 50,
          { steps: 4 },
        );
        await page.mouse.up();
        await expect(page.locator('[data-fire-locked="true"]')).toBeVisible();
        report.afterLock = await media();
        assert.equal(report.afterLock.streams, 1);
        assert.equal(report.afterLock.activeTracks, 1);
        assert.equal(report.afterLock.contexts, 1);
        await expect.poll(async () => (await media()).runningContexts).toBe(1);
        await expect
          .poll(async () => (await media()).voicedSamples)
          .toBeGreaterThan(0);
        report.afterLock = await media();
      },
    );
    await operation("Escape releases actual media without STT", async () => {
      const offResponse = fireResponse(false);
      void offResponse.catch(() => {});
      await page.locator("[data-native-composer] textarea").focus();
      await page.keyboard.press("Escape");
      const response = await offResponse;
      assert.equal(response.status(), 200);
      FireResult.parse(await response.json());
      report.fireOff++;
      await expect(page.locator('[data-fire-locked="true"]')).toHaveCount(0);
      await expect.poll(async () => (await media()).activeTracks).toBe(0);
      await expect.poll(async () => (await media()).openContexts).toBe(0);
      report.afterCancel = await media();
      assert.equal(report.sttRequests, 0);
      assert.equal(report.messageWrites, 0);
      assert.deepEqual(report.pageErrors, []);
      assert.equal(await heldButton.evaluate((node) => node.isConnected), true);
    });
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
        cleanupError = error;
      }
    }
    await mkdir(fixture.output, { recursive: true });
    await writeFile(
      join(fixture.output, "native-fire-gesture.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    if (cleanupError) throw cleanupError;
  }
}
