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
    // The camera's encoding is the only one with scaleResolutionDownBy (CAM_SEND): it takes the setting of this run.
    const setParameters = RTCRtpSender.prototype.setParameters;
    RTCRtpSender.prototype.setParameters = function (
      this: RTCRtpSender,
      params: RTCRtpSendParameters,
      ...rest: unknown[]
    ) {
      const encoding = params.encodings?.[0];
      if (encoding?.scaleResolutionDownBy) {
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
          bytes: Number(s.bytesSent),
          width: Number(s.frameWidth),
          height: Number(s.frameHeight),
          fps: Number(s.framesPerSecond ?? 0),
          limit: String(s.qualityLimitationReason),
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
    const a = await sent(ana);
    await ana.waitForTimeout(6000);
    const b = await sent(ana);
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
