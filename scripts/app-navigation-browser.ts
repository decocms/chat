// Standalone entry for the same actual Worker probe used by integrated CI.
import assert from "node:assert/strict";
import { chromium, expect as baseExpect } from "@playwright/test";
import { MeResult } from "../shared/schemas";
import { browserFixtures, pickDesktopPane } from "./browser-fixtures";
import {
  auditAppNavigation,
  type AppNavigationFixture,
} from "./app-navigation-probe";
import { mkdir, writeFile } from "node:fs/promises";

const expect = baseExpect.configure({ timeout: 30_000 });
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base));
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-app-navigation";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
try {
  const discovery = await browser.newContext();
  let ownerEmail: string;
  try {
    const response = await discovery.request.get(`${base}/api/me`);
    assert(response.ok(), "Requires a disposable signed-in DEV Worker");
    ownerEmail = MeResult.parse(await response.json()).email;
    assert(
      ownerEmail.endsWith("@example.test"),
      "Synthetic test identity only",
    );
  } finally {
    await discovery.close();
  }
  const fixture: AppNavigationFixture = {
    base,
    ownerEmail,
    output,
    async createProfile(profile) {
      const context = await browser.newContext({
        locale: "en-US",
        viewport: { width: profile.width, height: 1000 },
        reducedMotion: "reduce",
      });
      await browserFixtures(context, base);
      await context.addCookies([
        { name: "dev_as", value: ownerEmail, url: base },
        { name: "vb_lang", value: profile.lang, url: base },
      ]);
      await context.addInitScript(
        (theme) => localStorage.setItem("vb.theme", theme),
        profile.theme,
      );
      return { context, page: await context.newPage() };
    },
    async openPane(page, pane) {
      assert.equal(
        pane,
        "apps",
        "Standalone probe uses only the real Apps pane",
      );
      const layout = page.locator("[data-room-layout]");
      await expect(layout).toBeVisible();
      if ((await layout.getAttribute("data-pane")) !== "apps")
        await pickDesktopPane(page, "apps");
      await expect(layout).toHaveAttribute("data-pane", "apps");
    },
    async step(name, run) {
      console.info(`[app-navigation] ${name}`);
      await run();
    },
  };
  let result: { status: string; verdict: string };
  try {
    const evidence = await auditAppNavigation(fixture);
    result = { status: evidence.status, verdict: evidence.verdict };
  } catch {
    // A cleanup/startup failure is reported as inconclusive, not as a pass.
    result = { status: "inconclusive", verdict: "inconclusive" };
  }
  const passed = result.verdict === "explicit-denial";
  const summary = { status: passed ? "passed" : "failed", result };
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/app-navigation-summary.json`,
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.info(JSON.stringify({ ...summary, output }));
  if (!passed) process.exitCode = result.verdict === "read-inherited" ? 2 : 1;
} finally {
  await browser.close();
}
