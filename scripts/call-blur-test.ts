// The camera's background blur on a picture of a person, with screenshots of the preview at each level
// (docs/workflow.md, "Test the camera's blur"). TEST_CAMERA is a .y4m or .mjpeg file that Chrome plays as the
// camera: make one from any photo of a person with ffmpeg (the command is in the doc).
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base), "Use a loopback test Worker with DEV_EMAIL enabled");
const camera = process.env.TEST_CAMERA;
assert(camera, "Set TEST_CAMERA to a .y4m file with a person in it");
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-call-blur";
const label = process.env.TEST_LABEL ?? "blur";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({
  // TEST_GPU=1: with the computer's GPU, as a person's browser has it (headless Chrome draws on the CPU).
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-video-capture=${camera}`, ...(process.env.TEST_GPU === "1" ? ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] : [])],
});
try {
  const context = await browser.newContext({ locale: "pt-BR", viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2, permissions: ["microphone", "camera"] });
  const page = await context.newPage();
  await page.goto(`${base}/api/dev/as?email=ana%40example.com`);
  const room = JSON.parse(
    await page.evaluate(async () => (await fetch("/api/books", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "Teste do desfoque" }) })).text()),
  ).id as string;
  await page.goto(`${base}/b/${room}`);
  await page.waitForTimeout(1500);
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Iniciar call/ }).first().click();
  await page.locator("[data-call-more]").first().click();
  await page.locator("[data-call-camera-settings]").click();
  const preview = page.getByLabel("Prévia da sua câmera");
  await preview.waitFor();
  for (const level of ["Sem desfoque", "Leve", "Forte"]) {
    await page.locator("[data-camera-dialog]").getByRole("button", { name: level, exact: true }).click();
    // The model loads on the first level with blur, then the mask settles over a few frames.
    await page.waitForTimeout(level === "Leve" ? 6000 : 2500);
    await preview.screenshot({ path: `${output}/${label}-${level.toLowerCase().replace(/ /g, "-")}.png` });
  }
  // Frames a second of the preview with the strong blur: the model and the drawing must keep up with the camera.
  const fps = await preview.evaluate(
    (video) =>
      new Promise<number>((done) => {
        let frames = 0;
        const start = performance.now(),
          count = () => {
            frames++;
            if (performance.now() - start < 3000) (video as HTMLVideoElement).requestVideoFrameCallback(count);
            else done(Math.round((frames / (performance.now() - start)) * 1000));
          };
        (video as HTMLVideoElement).requestVideoFrameCallback(count);
      }),
  );
  console.log(JSON.stringify({ room, output, strong_fps: fps }, null, 2));
} finally {
  await browser.close();
}
