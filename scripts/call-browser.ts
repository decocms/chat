// The room's call in two real browsers, against a loopback Worker, with screenshots (docs/workflow.md, "Test the
// call locally"). Two people (fake microphone, camera and screen) join a call, share a screen, and leave. With the
// local recorder running (scripts/call-recorder-local.ts), the recorder joins too: its log shows what it did.
// It needs the real SFU app in .dev.vars (REALTIME_SFU_APP_ID, REALTIME_SFU_APP_SECRET): media goes through it.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base), "Use a loopback test Worker with DEV_EMAIL enabled");
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-call-browser";
const withRecorder = process.env.TEST_RECORDER === "1";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--auto-select-desktop-capture-source=Entire screen",
    // TEST_AUDIO: a speech file as the microphones (the live transcript needs words, not the fake beep).
    ...(process.env.TEST_AUDIO ? [`--use-file-for-fake-audio-capture=${process.env.TEST_AUDIO}`] : []),
  ],
});
const shots: string[] = [];
const shot = async (page: Page, name: string) => {
  const path = `${output}/${shots.length + 1}-${name}.png`;
  await page.screenshot({ path });
  shots.push(path);
};
async function person(email: string) {
  const context = await browser.newContext({ locale: "pt-BR", viewport: { width: 1440, height: 900 }, permissions: ["microphone", "camera"] });
  const page = await context.newPage();
  await page.goto(`${base}/api/dev/as?email=${encodeURIComponent(email)}`);
  return page;
}
const post = (page: Page, path: string, body: unknown) =>
  page.evaluate(async ([to, json]) => (await fetch(to as string, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(json) })).text(), [path, body] as const);
const dismiss = async (page: Page) => {
  await page.waitForTimeout(1500);
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
};

try {
  const ana = await person("ana@example.com"), bia = await person("bia@example.com");
  const room = JSON.parse(await post(ana, "/api/books", { title: "Teste da call" })).id as string;
  await post(ana, `/api/books/${room}/members`, { email: "bia@example.com" });
  await post(bia, `/api/books/${room}/invite`, { yes: true });
  await Promise.all([ana.goto(`${base}/b/${room}`), bia.goto(`${base}/b/${room}`)]);
  await Promise.all([dismiss(ana), dismiss(bia)]);

  await ana.getByRole("button", { name: /Iniciar (call|chamada)/ }).first().click();
  // Bia has the room open: she is not pulled in. She joins with a click.
  await bia.locator("[data-call-start]").first().click();
  await bia.getByRole("button", { name: /Silenciar o microfone|Desativar o microfone|Ativar o microfone/ }).first().waitFor({ timeout: 30_000 });
  // TEST_BIA_MUTED: only Ana speaks (with TEST_AUDIO, each word of the transcript is hers).
  if (process.env.TEST_BIA_MUTED) await bia.getByRole("button", { name: "Silenciar o microfone" }).first().dispatchEvent("click");
  if (withRecorder) {
    
    
    await ana.locator("[data-call-recording]").waitFor({ timeout: 120_000 });
    await shot(ana, "recording");
    // The recorder needs a call that lasts: Grain takes 10 seconds or more.
    await ana.waitForTimeout(25_000);
  } else await shot(ana, "call");

  // The session hears that Bia is in from the call's own socket, a moment after her tile shows: alone, the share
  // is refused ("Só você está na call").
  await ana.waitForTimeout(3000);
  await ana.getByRole("button", { name: /Compartilhar a tela/ }).first().click();
  await bia.waitForFunction(() => (document.querySelector<HTMLVideoElement>("[data-call-stage] video:not([data-call-cam])")?.videoWidth ?? 0) > 0, null, { timeout: 30_000 });
  await shot(bia, "screen-at-bia");
  if (withRecorder) await ana.waitForTimeout(Number(process.env.TEST_TALK_MS ?? 15_000));

  await bia.getByRole("button", { name: /Sair da call/ }).first().click();
  await ana.getByRole("button", { name: /Sair da call/ }).first().click();
  // The recorder's work (transcript, upload, the message in the call's chat) shows in its log: docker logs rec.
  console.log(JSON.stringify({ ok: true, room, recorder: withRecorder, screenshots: shots }, null, 2));
} finally {
  await browser.close();
}
