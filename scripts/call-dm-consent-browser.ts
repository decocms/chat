// A DM's call asks both people before it is recorded (Jonas, 2026-11-25), in two real browsers, with screenshots
// (docs/workflow.md, "Test the call locally"). It needs RECORDER_URL, RECORDER_SECRET and CALL_RECORD_ROOMS in
// .dev.vars, so the DM's calls count as recorded; without a recorder running, the start fails after both yes,
// and the DM says so.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
  "Use a loopback test Worker with DEV_EMAIL enabled",
);
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-call-dm-consent";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
  ],
});
const shots: string[] = [];
const shot = async (page: Page, name: string) => {
  const path = `${output}/${shots.length + 1}-${name}.png`;
  await page.screenshot({ path });
  shots.push(path);
};
async function person(email: string) {
  const context = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 1440, height: 900 },
    permissions: ["microphone", "camera"],
  });
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
const dismiss = async (page: Page) => {
  await page.waitForTimeout(1500);
  if (await page.getByRole("dialog").count())
    await page.keyboard.press("Escape");
};

try {
  const ana = await person("ana@example.com"),
    bia = await person("bia@example.com");
  // A room in common lets them DM each other.
  const room = JSON.parse(
    await post(ana, "/api/books", { title: "Sala em comum" }),
  ).id as string;
  await post(ana, `/api/books/${room}/members`, { email: "bia@example.com" });
  await post(bia, `/api/books/${room}/invite`, { yes: true });
  const dm = JSON.parse(
    await post(ana, "/api/friends", { email: "bia@example.com" }),
  ).id as string;
  assert(dm?.startsWith("dm"), "no DM");
  await Promise.all([ana.goto(`${base}/b/${dm}`), bia.goto(`${base}/b/${dm}`)]);
  await Promise.all([dismiss(ana), dismiss(bia)]);

  await ana
    .getByRole("button", { name: /Iniciar call/ })
    .first()
    .click();
  await bia.getByRole("button", { name: "Atender" }).first().click();
  // Both in the call: each stage asks.
  await ana.locator("[data-call-consent]").waitFor({ timeout: 30_000 });
  await bia.locator("[data-call-consent]").waitFor({ timeout: 30_000 });
  await shot(ana, "asks");
  await ana.locator("[data-call-consent-yes]").click();
  await ana.locator("[data-call-consent-waiting]").waitFor();
  await shot(ana, "waits-for-bia");
  await bia.locator("[data-call-consent-no]").click();
  await ana.locator("[data-call-consent-declined]").waitFor();
  await bia.locator("[data-call-consent-declined]").waitFor();
  await shot(bia, "not-recorded");
  assert.equal(
    await ana.locator("[data-call-recording]").count(),
    0,
    "recorded after a no",
  );

  // A new call asks again; both yes: the recorder is asked to come (here none runs, so the DM says it did not start).
  await bia
    .getByRole("button", { name: /Sair da call/ })
    .first()
    .click();
  await ana
    .getByRole("button", { name: /Sair da call/ })
    .first()
    .click();
  await ana.waitForTimeout(1500);
  await ana
    .getByRole("button", { name: /Iniciar call/ })
    .first()
    .click();
  await bia.getByRole("button", { name: "Atender" }).first().click();
  await ana.locator("[data-call-consent-yes]").click();
  await bia.locator("[data-call-consent-yes]").click();
  await ana
    .getByText("O gravador não iniciou")
    .first()
    .waitFor({ timeout: 120_000 })
    .catch(async (error) => {
      await shot(ana, "failed");
      throw error;
    });
  await shot(ana, "both-yes-recorder-asked");
  await bia
    .getByRole("button", { name: /Sair da call/ })
    .first()
    .click();
  await ana
    .getByRole("button", { name: /Sair da call/ })
    .first()
    .click();
  console.log(JSON.stringify({ ok: true, dm, screenshots: shots }, null, 2));
} finally {
  await browser.close();
}
