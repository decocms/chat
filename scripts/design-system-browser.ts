// Local-only, real browser verification of the production UI assets and shared primitives.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium, expect as baseExpect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { verifyStudioPalette } from "./studio-browser";
import { nativeBrowserFixtures } from "./native-browser-fixtures";
import { auditDesignSystemInbox } from "./design-system-inbox-browser";

const expect = baseExpect.configure({ timeout: 60_000 });
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:8797";
assert(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
  "Use a local test Worker",
);
const results: Record<string, unknown> = {};
const args = process.argv.slice(2);
assert(args.length === 0 || (args.length === 1 && (args[0] === "--gallery-only" || args[0] === "--inbox-only")), "Use --gallery-only or --inbox-only, or no arguments for both");
const onlyInbox = args[0] === "--inbox-only";
const onlyGallery = args[0] === "--gallery-only";
results.scope = onlyInbox ? "Current RoomInbox" : onlyGallery ? "Atomic gallery and Studio" : "Gallery and RoomInbox";
results.sourceRevision = process.env.TEST_APP_REVISION ?? null;
const output = process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-design-system";
let ownedBrowser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
const errors: string[] = [];
const expectedNetworkFailures: string[] = [];
const requestFailures: { url: string; error: string | undefined }[] = [];
try {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
  ownedBrowser = browser;
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addCookies([{ name: "vb_lang", value: "en", url: base }]);
  context.setDefaultTimeout(60_000);
  context.setDefaultNavigationTimeout(120_000);
  results.fixtures = [
    ...(await nativeBrowserFixtures(context, base)),
    "deterministic profile waits",
    "held resolve responses and explicit HTTP 500",
    "native outer boxes frozen only during CSS containment comparison; fixture itself must preserve surrounding layout",
  ];
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (
      (message.location().url.endsWith("/api/waits/resolve") || message.location().url.endsWith("/api/inbox")) &&
      /500/.test(message.text())
    )
      expectedNetworkFailures.push(message.text());
    else errors.push(`${message.location().url}: ${message.text()}`);
  });
  page.on("requestfailed", (request) =>
    requestFailures.push({
      url: request.url(),
      error: request.failure()?.errorText,
    }),
  );
  if (!onlyInbox) {
    await page.goto(`${base}/app?ui=svelte&gallery=1`, {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Component gallery" }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    console.log("Gallery loaded; checking fonts and controls");
    const fontState = await page.evaluate(() => ({
      faces: [...document.fonts].map((face) => ({
        family: face.family,
        status: face.status,
      })),
      body: getComputedStyle(document.querySelector("[data-gallery]")!)
        .fontFamily,
      code: getComputedStyle(document.querySelector("pre")!).fontFamily,
      weight: getComputedStyle(document.querySelector("[data-gallery] button")!)
        .fontWeight,
    }));
    assert(
      fontState.faces.some(
        (face) => face.family === "Inter var" && face.status === "loaded",
      ),
    );
    assert(
      fontState.faces.some(
        (face) => face.family === "CommitMono" && face.status === "loaded",
      ),
    );
    assert(
      fontState.body.includes("Inter var") &&
        fontState.code.includes("CommitMono"),
    );
    results.fonts = fontState;
    const title = page.getByLabel("Room name", { exact: true });
    await title.fill("Typed room");
    await expect(title).toHaveValue("Typed room");
    const checkbox = page.getByRole("checkbox", {
      name: "Include archived rooms",
    });
    await checkbox.focus();
    await page.keyboard.press("Space");
    await expect(checkbox).toBeChecked();
    const toggle = page.getByRole("switch", { name: "Notifications" });
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toBeChecked();
    const members = page.getByRole("radio", {
      name: "Room members",
      exact: true,
    });
    const personal = page.getByRole("radio", { name: "Only me", exact: true });
    await members.focus();
    await page.keyboard.press("ArrowDown");
    await expect(personal).toBeChecked();
    await expect(
      page.getByRole("radio", { name: "Unavailable", exact: true }),
    ).toBeDisabled();
    const filter = page.getByRole("combobox", { name: "Show", exact: true });
    await filter.selectOption("active");
    await expect(page.locator("[data-selection-state]")).toHaveText(
      "personal · active",
    );
    await filter.selectOption("all");
    await members.check();
    await expect(page.locator("[data-selection-state]")).toHaveText(
      "room · all",
    );
    await writeFile(`${output}/gallery-before-tabs.html`, await page.content());
    await page.screenshot({
      path: `${output}/gallery-before-tabs.png`,
      fullPage: true,
    });
    results.tabStructure = await page
      .getByRole("tab", { name: "General", exact: true })
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          section: node.closest("section")?.textContent,
          parent: node.parentElement?.outerHTML,
        })),
      );
    const general = page.getByRole("tab", { name: "General", exact: true });
    await general.focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "Members", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    const trigger = page.getByRole("button", {
      name: "Open dialog",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Edit room" });
    await expect(dialog).toBeVisible();
    assert(
      await page.evaluate(
        () => getComputedStyle(document.body).overflow === "hidden",
      ),
      "Tailwind body scroll lock",
    );
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("Tab");
      assert(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
        "Focus escaped modal",
      );
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    assert(
      await page.evaluate(
        () => getComputedStyle(document.body).overflow !== "hidden",
      ),
      "Scroll lock was not released",
    );
    results.lightStudioPalette = await verifyStudioPalette(page, "light");
    const light = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.lightAccessibility = light.violations;
    await page.screenshot({
      path: `${output}/gallery-light-1440.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Use dark theme" }).click();
    results.darkStudioPalette = await verifyStudioPalette(page, "dark");
    const dark = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.darkAccessibility = dark.violations;
    await page.screenshot({
      path: `${output}/gallery-dark-1440.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Open sheet" }).click();
    const sheet = page.getByRole("dialog", { name: "Room details" });
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    assert(box && box.width <= 390 && box.x >= 0);
    await page.screenshot({ path: `${output}/sheet-dark-390.png` });
    await page.keyboard.press("Escape");
    await page.screenshot({
      path: `${output}/gallery-dark-390.png`,
      fullPage: true,
    });
    const mobile = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    results.mobileAccessibility = mobile.violations;
    assert.deepEqual(light.violations, [], "Light accessibility violations");
    assert.deepEqual(dark.violations, [], "Dark accessibility violations");
    assert.deepEqual(mobile.violations, [], "Mobile accessibility violations");
    // Exercise Studio's high-density media override in the same real DOM.
    const metrics = await context.newCDPSession(page);
    try {
      await metrics.send("Emulation.setDeviceMetricsOverride", {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: false,
      });
      assert.equal(await page.evaluate(() => devicePixelRatio), 2);
      results.darkRetinaStudioPalette = await verifyStudioPalette(page, "dark");
      await page.getByRole("button", { name: "Use light theme" }).click();
      results.lightRetinaStudioPalette = await verifyStudioPalette(
        page,
        "light",
      );
    } finally {
      await metrics.send("Emulation.clearDeviceMetricsOverride");
      await metrics.detach();
    }
    console.log(
      "PASS native gallery: fonts, controls, keyboard tabs, focus trap/restoration, scroll lock, sheet, light/dark/mobile axe",
    );
  }
  if (!onlyGallery) {
    await page.setViewportSize({ width: 390, height: 844 });
    results.inbox = await auditDesignSystemInbox(page, context, base, output);
  }
  assert.deepEqual(errors, [], "Browser page errors");

  results.errors = errors;
  results.status = "pass";
  console.log(
    "PASS selected design-system browser scope",
  );
} catch (error) {
  results.status = "failed";
  results.failure = { name: error instanceof Error ? error.name : "UnknownError" };
  throw error;
} finally {
  try {
    await ownedBrowser?.close();
  } catch (error) {
    results.status = "failed";
    results.cleanupFailure = "browser-close";
    throw error;
  } finally {
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      { ...results, errors, expectedNetworkFailures, requestFailures },
      null,
      2,
    ) + "\n",
  );
  }
}
