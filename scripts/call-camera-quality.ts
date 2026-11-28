// What a camera looks like at the other end, for several encoder settings (docs/workflow.md, "Test the camera's
// quality"). Two people against the local Worker with the real SFU: Ana's camera is TEST_CAMERA (a .y4m), Bia
// receives it. For each setting the test swaps the camera's encoding (a hook on setParameters: the app's code is
// not changed), waits for the encoder to settle, and prints what Ana sends (kbps, size, frames a second, what
// limits the quality) and the SSIM of Bia's frame against TEST_STILL (the clean picture), at a grid tile's size
// (640×360) and at a big tile's (1280×720). 1 = the same picture.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { $ } from "bun";
import { chromium, type Page } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
  "Use a loopback test Worker with DEV_EMAIL enabled",
);
const camera = process.env.TEST_CAMERA,
  still = process.env.TEST_STILL;
assert(
  camera && still,
  "Set TEST_CAMERA (.y4m, 1280×720) and TEST_STILL (the same picture without noise, .png)",
);
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-call-camera";
await mkdir(output, { recursive: true });

type Setting = {
  /** "maintain-framerate": the encoder lowers the size, never the frames a second. Not given: the app's "balanced". */
  keepFps?: boolean;
  /** A codec that the camera prefers ("video/VP9"), set on its transceiver. Not given: the browser's default. */
  codec?: string;
  /** The app's layers (simulcast) with other ceilings, by rid. */
  layers?: Record<string, number>;
  name: string;
  maxBitrate: number;
  scaleResolutionDownBy: number;
  maxFramerate: number;
};
const settings: Setting[] = [
  // Today's (CAM_SEND in session.ts).
  {
    name: "360p-500k",
    maxBitrate: 500_000,
    scaleResolutionDownBy: 2,
    maxFramerate: 24,
  },
  {
    name: "540p-500k",
    maxBitrate: 500_000,
    scaleResolutionDownBy: 4 / 3,
    maxFramerate: 24,
  },
  {
    name: "720p-500k",
    maxBitrate: 500_000,
    scaleResolutionDownBy: 1,
    maxFramerate: 24,
  },
  {
    name: "360p-350k",
    maxBitrate: 350_000,
    scaleResolutionDownBy: 2,
    maxFramerate: 24,
  },
  {
    name: "540p-350k",
    maxBitrate: 350_000,
    scaleResolutionDownBy: 4 / 3,
    maxFramerate: 24,
  },
  {
    name: "720p-350k",
    maxBitrate: 350_000,
    scaleResolutionDownBy: 1,
    maxFramerate: 24,
  },
  // At least 24 frames a second (Jonas): the encoder keeps the frames and gives up size.
  {
    name: "360p-300k-24",
    maxBitrate: 300_000,
    scaleResolutionDownBy: 2,
    maxFramerate: 24,
    keepFps: true,
  },
  {
    name: "360p-400k-24",
    maxBitrate: 400_000,
    scaleResolutionDownBy: 2,
    maxFramerate: 24,
    keepFps: true,
  },
  {
    name: "540p-800k-24",
    maxBitrate: 800_000,
    scaleResolutionDownBy: 4 / 3,
    maxFramerate: 24,
    keepFps: true,
  },
  {
    name: "720p-1000k-24",
    maxBitrate: 1_000_000,
    scaleResolutionDownBy: 1,
    maxFramerate: 24,
    keepFps: true,
  },
  {
    name: "720p-1200k-24",
    maxBitrate: 1_200_000,
    scaleResolutionDownBy: 1,
    maxFramerate: 24,
    keepFps: true,
  },
  // Near the webcam's own picture: 720p with room to send it.
  {
    name: "720p-1000k",
    maxBitrate: 1_000_000,
    scaleResolutionDownBy: 1,
    maxFramerate: 30,
  },
  {
    name: "720p-1500k",
    maxBitrate: 1_500_000,
    scaleResolutionDownBy: 1,
    maxFramerate: 30,
  },
  {
    name: "720p-2500k",
    maxBitrate: 2_500_000,
    scaleResolutionDownBy: 1,
    maxFramerate: 30,
  },
  {
    name: "540p-500k-15fps",
    maxBitrate: 500_000,
    scaleResolutionDownBy: 4 / 3,
    maxFramerate: 15,
  },
  // The app's own setting (simulcast, CAM_LAYERS): no hook. TEST_SCALE=2 gives Bia a 2x screen (a big tile).
  { name: "app", maxBitrate: 0, scaleResolutionDownBy: 1, maxFramerate: 0 },
  // The same layers in VP9, then VP9 with lower ceilings (the same sharpness for less?).
  {
    name: "app-vp9",
    codec: "video/VP9",
    maxBitrate: 0,
    scaleResolutionDownBy: 1,
    maxFramerate: 0,
  },
  {
    name: "app-vp9-800-200",
    codec: "video/VP9",
    layers: { h: 800_000, q: 200_000 },
    maxBitrate: 0,
    scaleResolutionDownBy: 1,
    maxFramerate: 0,
  },
  {
    name: "app-vp9-600-150",
    codec: "video/VP9",
    layers: { h: 600_000, q: 150_000 },
    maxBitrate: 0,
    scaleResolutionDownBy: 1,
    maxFramerate: 0,
  },
].filter(
  (s) =>
    !process.env.TEST_ONLY || process.env.TEST_ONLY.split(",").includes(s.name),
);

const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${camera}`,
  ],
});
async function person(email: string, setting: Setting) {
  const context = await browser.newContext({
    deviceScaleFactor: email.startsWith("bia")
      ? Number(process.env.TEST_SCALE ?? 1)
      : 1,
    locale: "pt-BR",
    viewport: { width: 1280, height: 800 },
    permissions: ["microphone", "camera"],
  });
  await context.addInitScript((wanted) => {
    type W = { pcs: RTCPeerConnection[] };
    const w = window as unknown as W;
    w.pcs = [];
    const setLocal = RTCPeerConnection.prototype.setLocalDescription;
    RTCPeerConnection.prototype.setLocalDescription = function (
      this: RTCPeerConnection,
      ...args: unknown[]
    ) {
      if (!w.pcs.includes(this)) w.pcs.push(this);
      return (setLocal as (...a: unknown[]) => Promise<void>).apply(this, args);
    } as typeof setLocal;
    // The camera's codec: the one wanted first, the others after (the SFU or the other side may not have it).
    const addTransceiver = RTCPeerConnection.prototype.addTransceiver;
    RTCPeerConnection.prototype.addTransceiver = function (
      this: RTCPeerConnection,
      ...args: Parameters<typeof addTransceiver>
    ) {
      const transceiver = addTransceiver.apply(this, args);
      const kind = typeof args[0] === "string" ? args[0] : args[0].kind;
      if (wanted.codec && kind === "video") {
        const codecs = RTCRtpSender.getCapabilities("video")?.codecs ?? [];
        transceiver.setCodecPreferences([
          ...codecs.filter((c) => c.mimeType === wanted.codec),
          ...codecs.filter((c) => c.mimeType !== wanted.codec),
        ]);
      }
      return transceiver;
    };
    // The camera's encoding is the only one with scaleResolutionDownBy (CAM_SEND): it takes the setting of this run.
    const setParameters = RTCRtpSender.prototype.setParameters;
    RTCRtpSender.prototype.setParameters = function (
      this: RTCRtpSender,
      params: RTCRtpSendParameters,
      ...rest: unknown[]
    ) {
      const encoding = params.encodings?.[0];
      for (const one of params.encodings ?? [])
        if (one.rid && wanted.layers?.[one.rid])
          one.maxBitrate = wanted.layers[one.rid];
      if (!wanted.name.startsWith("app") && encoding?.scaleResolutionDownBy) {
        encoding.maxBitrate = wanted.maxBitrate;
        encoding.scaleResolutionDownBy = wanted.scaleResolutionDownBy;
        encoding.maxFramerate = wanted.maxFramerate;
        if (wanted.keepFps) params.degradationPreference = "maintain-framerate";
      }
      return (setParameters as (...a: unknown[]) => Promise<void>).call(
        this,
        params,
        ...rest,
      );
    } as typeof setParameters;
  }, setting);
  const page = await context.newPage();
  await page.goto(`${base}/api/dev/as?email=${encodeURIComponent(email)}`);
  return page;
}
const post = (page: Page, path: string, body: unknown) =>
  page.evaluate(
    async ([to, json]) =>
      (
        await fetch(to as string, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(json),
        })
      ).text(),
    [path, body] as const,
  );
const sent = (page: Page) =>
  page.evaluate(async () => {
    const pc = (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(-1)!;
    let out = {
      bytes: 0,
      width: 0,
      height: 0,
      fps: 0,
      limit: "",
      at: performance.now(),
    };
    (await pc.getStats()).forEach((s: Record<string, number | string>) => {
      if (
        s.type === "outbound-rtp" &&
        s.kind === "video" &&
        Number(s.frameWidth) < 1600
      )
        out = {
          ...out,
          // Simulcast: every layer counts; the size is the biggest layer's.
          bytes: out.bytes + Number(s.bytesSent),
          ...(Number(s.frameWidth) < out.width
            ? {}
            : {
                width: Number(s.frameWidth),
                height: Number(s.frameHeight),
                fps: Number(s.framesPerSecond ?? 0),
                limit: String(s.qualityLimitationReason),
              }),
        };
    });
    return out;
  });
/** What Bia receives of the camera: bytes, size and frames a second. */
const received = (page: Page) =>
  page.evaluate(async () => {
    const pc = (window as unknown as { pcs: RTCPeerConnection[] }).pcs.at(-1)!;
    let out = { bytes: 0, width: 0, fps: 0, codec: "", at: performance.now() };
    const stats = await pc.getStats();
    stats.forEach((s: Record<string, number | string>) => {
      if (s.type === "inbound-rtp" && s.kind === "video")
        out.codec = String(stats.get(String(s.codecId))?.mimeType ?? "");
      if (s.type === "inbound-rtp" && s.kind === "video")
        out = {
          ...out,
          bytes: out.bytes + Number(s.bytesReceived),
          width: Number(s.frameWidth ?? 0),
          fps: Number(s.framesPerSecond ?? 0),
        };
    });
    return out;
  });
const ssim = async (frame: string, w: number, h: number) => {
  const text =
    await $`ffmpeg -v info -i ${frame} -i ${still} -lavfi ${`[0]scale=${w}:${h}:flags=bicubic[a];[1]scale=${w}:${h}:flags=bicubic[b];[a][b]ssim`} -f null - 2>&1`
      .nothrow()
      .text();
  return Number(/All:([\d.]+)/.exec(text)?.[1] ?? NaN);
};

const results: Record<string, unknown>[] = [];
try {
  for (const setting of settings) {
    const ana = await person("ana@example.com", setting),
      bia = await person("bia@example.com", setting);
    const room = JSON.parse(
      await post(ana, "/api/books", { title: `Câmera ${setting.name}` }),
    ).id as string;
    await post(ana, `/api/books/${room}/members`, { email: "bia@example.com" });
    await post(bia, `/api/books/${room}/invite`, { yes: true });
    for (const page of [ana, bia]) {
      await page.goto(`${base}/b/${room}`);
      await page.waitForTimeout(1000);
      if (await page.getByRole("dialog").count())
        await page.keyboard.press("Escape");
    }
    await ana
      .getByRole("button", { name: /Iniciar (call|chamada)/ })
      .first()
      .click();
    const join = bia
      .getByRole("button", { name: "Entrar na call", exact: true })
      .last();
    await join.waitFor({ timeout: 30_000 });
    await join.dispatchEvent("click");
    await bia
      .getByRole("button", { name: /Silenciar o microfone|Ativar o microfone/ })
      .first()
      .waitFor({ timeout: 30_000 });
    await ana.waitForTimeout(2000);
    await ana.locator("[data-call-camera]").first().dispatchEvent("click");
    await ana
      .locator("[data-camera-dialog]")
      .getByRole("button", { name: "Ligar a câmera" })
      .click();
    await bia.waitForFunction(
      () =>
        (document.querySelector<HTMLVideoElement>("video[data-call-cam]")
          ?.videoWidth ?? 0) > 0,
      null,
      { timeout: 30_000 },
    );
    // The encoder starts low and climbs to its limit.
    await ana.waitForTimeout(Number(process.env.TEST_SETTLE_MS ?? 25_000));
    const a = await sent(ana),
      ra = await received(bia);
    await ana.waitForTimeout(6000);
    const cpu = (await $`ps -A -o %cpu=,comm=`.text())
      .split("\n")
      .filter((l) => /chrom|headless/i.test(l))
      .reduce((n, l) => n + (parseFloat(l) || 0), 0);
    const b = await sent(ana),
      rb = await received(bia);
    const png = await bia.evaluate(() => {
      const video = document.querySelector<HTMLVideoElement>(
        "video[data-call-cam]",
      )!;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1]!;
    });
    const frame = `${output}/${setting.name}.png`;
    await writeFile(frame, Buffer.from(png, "base64"));
    results.push({
      setting: setting.name,
      kbps: Math.round(
        ((b.bytes - a.bytes) * 8) / ((b.at - a.at) / 1000) / 1000,
      ),
      sent: `${b.width}×${b.height}`,
      fps: Math.round(b.fps),
      limited_by: b.limit,
      cpu_pct: Math.round(cpu),
      bia_gets: `${rb.codec}, ${rb.width} wide, ${Math.round(rb.fps)} fps, ${Math.round(((rb.bytes - ra.bytes) * 8) / ((rb.at - ra.at) / 1000) / 1000)} kbps`,
      ssim_grid_640: +(await ssim(frame, 640, 360)).toFixed(4),
      ssim_big_1280: +(await ssim(frame, 1280, 720)).toFixed(4),
    });
    console.error(JSON.stringify(results.at(-1)));
    await ana.context().close();
    await bia.context().close();
  }
} finally {
  console.table(results);
  await browser.close();
}
