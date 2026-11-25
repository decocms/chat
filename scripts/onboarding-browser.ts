// SOURCE-ONLY harness: fresh disposable loopback identity; real profile HTTP and canonical reads.
// Claude grants are a controlled capability fixture; this does not prove OAuth/provider delivery.
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { MeResult } from "../shared/schemas";
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base),
  "Use a disposable loopback DEV_EMAIL Worker",
);
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: "en-US",
});
await context.addCookies([
  { name: "vb_lang", value: "en", url: base },
  // A fresh dev identity (dev_as) when the Worker's DEV_EMAIL already has rooms.
  ...(process.env.TEST_DEV_AS
    ? [{ name: "dev_as", value: process.env.TEST_DEV_AS, url: base }]
    : []),
]);
const page = await context.newPage();
const initial = MeResult.parse(
  await (await context.request.get(`${base}/api/me`)).json(),
);
assert.equal(
  initial.books.length,
  0,
  "Do not alter an existing or invited user's account for this fresh-user fixture",
);
let grantConnected = false;
await page.route("**/api/agents", (route) =>
  route.fulfill({
    json: {
      agents: grantConnected
        ? [
            {
              id: "controlled-onboarding-grant",
              client: "Controlled Claude",
              connected_at: Date.now(),
              used_at: null,
            },
          ]
        : [],
      last_used: null,
    },
  }),
);
try {
  // The Worker rejects an empty name, so a named identity cannot be reset: use a fresh one.
  assert(!initial.name, "Use a fresh, nameless identity (TEST_DEV_AS)");
  await page.goto(`${base}/`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  // The first run is a dialog over the actual Home, which renders behind it.
  const wizard = page.locator('[role="dialog"][data-onboarding]');
  await expect(wizard).toHaveAttribute("data-onboarding-step", "1");
  await expect(page.locator('[data-view="home"]')).toHaveCount(1);
  await expect(wizard.getByText("Step 1 of 3", { exact: true })).toBeVisible();
  await page
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Onboarding Fixture");
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(wizard).toHaveAttribute("data-onboarding-step", "2", {
    timeout: 30_000,
  });
  assert.equal(
    MeResult.parse(await (await context.request.get(`${base}/api/me`)).json())
      .name,
    "Onboarding Fixture",
  );
  await page.reload(); // Canonical name recovers directly to the connect step.
  await expect(wizard).toHaveAttribute("data-onboarding-step", "2");
  grantConnected = true;
  await expect(wizard).toHaveAttribute("data-onboarding-step", "3", {
    timeout: 30_000,
  });
  const draft = wizard.getByRole("textbox", {
    name: "Your first room",
    exact: true,
  });
  await draft.fill("First-room draft retained across Back");
  await wizard.getByRole("button", { name: "Back", exact: true }).click();
  await expect(wizard).toHaveAttribute("data-onboarding-step", "1");
  await wizard.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(wizard).toHaveAttribute("data-onboarding-step", "3");
  await expect(draft).toHaveValue("First-room draft retained across Back");
  // The ✕ closes the whole thing: every step left is skipped for good.
  await wizard
    .getByRole("button", { name: "Close and see the home", exact: true })
    .click();
  await expect(wizard).toHaveCount(0);
  await page.reload();
  await expect(wizard).toHaveCount(0);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("vb.obDone")),
    "1",
  );
  // This harness intentionally does not call model-backed start-room or fabricate a room result.
  // The actual creator/authoritative-ID path is separately covered by owner fixtures.
} finally {
  await browser.close();
}
