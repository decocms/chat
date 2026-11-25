// The call in real browsers (docs/workflow.md, "Test the call locally"; it needs a loopback test Worker with
// DEV_EMAIL and an SFU):
// 1. Atender on the ring's card, from another room, takes the person to the DM, into the call and onto its stage in
//    one click (a friend of Valls's clicked it and nothing happened, 2026-11-25).
// 2. The call follows the person to another room and Home: its panel shows there, the others still see them in it,
//    and the panel goes back to the call.
// 3. The stage's tiles are 16:9 with 2 and 4 people.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
  "Use a loopback test Worker with DEV_EMAIL enabled",
);
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-call-answer";
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

const tiles = async (page: Page) => {
  const boxes = await page
    .locator("[data-call-people] [data-call-tile]")
    .evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { width: r.width, height: r.height };
      }),
    );
  for (const box of boxes)
    assert(
      Math.abs(box.width / box.height - 16 / 9) < 0.02,
      `a tile is not 16:9: ${box.width}x${box.height}`,
    );
  return boxes;
};
const inCall = (page: Page) =>
  page
    .locator("[data-call-panel]")
    .getByText("Na call")
    .first()
    .waitFor({ timeout: 30_000 });

try {
  const stamp = Date.now().toString(36),
    email = (name: string) => `${name}-${stamp}@example.com`;
  const ana = await person(email("ana")),
    bia = await person(email("bia"));
  const room = JSON.parse(
    await post(ana, "/api/books", { title: "Sala em comum" }),
  ).id as string;
  await post(ana, `/api/books/${room}/members`, { email: email("bia") });
  await post(bia, `/api/books/${room}/invite`, { yes: true });
  const dm = JSON.parse(
    await post(ana, "/api/friends", { email: email("bia") }),
  ).id as string;
  assert(dm?.startsWith("dm"), "no DM");
  // Bia is in another room; Ana calls her from the DM.
  await Promise.all([
    ana.goto(`${base}/b/${dm}`),
    bia.goto(`${base}/b/${room}`),
  ]);
  await Promise.all([dismiss(ana), dismiss(bia)]);
  await ana
    .getByRole("button", { name: /Iniciar call/ })
    .first()
    .click();
  const card = bia.locator("[data-incoming-call]");
  await card.waitFor({ timeout: 30_000 });
  await shot(bia, "ringing-in-another-room");
  // 1. Atender: the DM, the call and its stage, in one click.
  await card.locator("[data-ring-answer]").click();
  await bia.waitForURL(new RegExp(`/b/${dm}`), {
    timeout: 15_000,
    waitUntil: "commit",
  });
  await bia.locator("[data-call-stage]").waitFor({ timeout: 30_000 });
  await inCall(bia);
  assert.equal(await card.count(), 0, "the card stays after Atender");
  await ana.locator("[data-call-people] [data-call-tile]").nth(1).waitFor();
  await shot(bia, "answered-stage");
  await shot(ana, "stage-2-people");
  const two = await tiles(ana);
  assert.equal(two.length, 2);

  // 2. Another room: the call goes on, its panel shows, no stage.
  await bia.locator(`a[href="/b/${room}"]`).first().click();
  await bia.waitForURL(new RegExp(`/b/${room}`), { waitUntil: "commit" });
  await bia.locator("[data-call-panel]").first().waitFor();
  await bia.waitForTimeout(3000);
  assert.equal(await bia.locator("[data-call-stage]").count(), 0);
  await inCall(bia);
  assert.equal(
    await ana.locator("[data-call-people] [data-call-tile]").count(),
    2,
    "Bia left the call when she left the DM",
  );
  await shot(bia, "other-room-still-in-call");
  // Home too.
  // The logo: Home on desktop.
  await bia.locator('button:has(img[src="/favicon.svg"])').first().click();
  await bia.waitForURL(/\/(\?.*)?$/, { waitUntil: "commit" });
  await bia.locator("[data-home-dms]").waitFor();
  await inCall(bia);
  await shot(bia, "home-still-in-call");
  // The panel takes her back to the DM, with the stage.
  await bia.locator("[data-call-panel-open]").first().click();
  await bia.waitForURL(new RegExp(`/b/${dm}`), { waitUntil: "commit" });
  await bia.locator("[data-call-stage]").waitFor({ timeout: 15_000 });
  await shot(bia, "back-to-the-call");
  await bia.locator("[data-call-panel-leave]").first().click();
  await bia.locator("[data-call-panel]").first().waitFor({ state: "detached" });

  // 3. Four people in a room's call: 16:9 tiles.
  const caio = await person(email("caio")),
    dani = await person(email("dani"));
  const group = JSON.parse(await post(ana, "/api/books", { title: "Quatro" }))
    .id as string;
  for (const [page, name] of [
    [bia, "bia"],
    [caio, "caio"],
    [dani, "dani"],
  ] as const) {
    await post(ana, `/api/books/${group}/members`, { email: email(name) });
    await post(page, `/api/books/${group}/invite`, { yes: true });
  }
  await ana.goto(`${base}/b/${group}`);
  await dismiss(ana);
  await ana
    .getByRole("button", { name: /Iniciar call/ })
    .first()
    .click();
  await inCall(ana);
  // Opening a room with a call on joins it.
  for (const page of [bia, caio, dani]) {
    await page.goto(`${base}/b/${group}`);
    await dismiss(page);
  }
  await ana
    .locator("[data-call-people] [data-call-tile]")
    .nth(3)
    .waitFor({ timeout: 30_000 });
  await ana.waitForTimeout(1500);
  await shot(ana, "stage-4-people");
  const four = await tiles(ana);
  assert.equal(four.length, 4);
  console.log(
    JSON.stringify({ ok: true, dm, two, four, screenshots: shots }, null, 2),
  );
} finally {
  await browser.close();
}
