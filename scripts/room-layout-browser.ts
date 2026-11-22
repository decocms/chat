// Actual production RoomLayout in a public, synthetic gallery fixture. No backend or canonical room is fabricated.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium, expect as baseExpect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { galleryPath, serveBuiltGallery } from "./browser-static-gallery";
const expect = baseExpect.configure({ timeout: 30_000 });
const output =
  process.env.TEST_OUTPUT_DIR ?? "/tmp/vibebook-production-room-layout";
await mkdir(output, { recursive: true });
// The gallery that `bun run build:gallery` writes (dist-gallery/), served on a free loopback port.
const galleryRoot =
  process.env.TEST_GALLERY_ROOT ??
  resolve(import.meta.dirname, "../dist-gallery");
let base = "";
let gallery: Awaited<ReturnType<typeof serveBuiltGallery>> | null = null,
  browser: Awaited<ReturnType<typeof chromium.launch>> | null = null,
  page: Page | null = null,
  interrupted = false,
  closing: Promise<void> | null = null;
const report: Record<string, unknown> = {
  status: "running",
  suppliedRevision: process.env.TEST_APP_REVISION ?? null,
  scope:
    "Production RoomLayout class/playback/history controller in a neutral gallery; no integrated RoomScope/Worker/provider acceptance",
  gaps: [
    "Physical touch, hardware keyboard/AT, safe-area hardware and Safari/WebKit are not represented",
    "Synthetic pointercancel/input events are named explicitly",
    "Actual FileViewer/RootApp navigation ordering needs the separate integrated browser gate",
    "No real room/editor/Board business state is represented by neutral snippet text",
  ],
};
const checkpoint = (phase: string) => {
  report.phase = phase;
  console.info(`[room-layout] ${phase}`);
};
async function closeBrowser() {
  if (browser) {
    const owned = browser;
    browser = null;
    closing = owned.close();
  }
  await closing;
}
const signal = () => {
  interrupted = true;
  process.exitCode = 130;
  void closeBrowser().catch(() => {});
};
process.on("SIGINT", signal);
process.on("SIGTERM", signal);
try {
  gallery = await serveBuiltGallery(galleryRoot);
  base = gallery.base;
  report.assetProof = gallery.proof;
  checkpoint("launch");
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  if (interrupted) throw Error("Interrupted startup");
  report.browserVersion = browser.version();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );
  await context.addInitScript(() => {
    const changes: string[] = [];
    Object.defineProperty(window, "roomLayoutStyleWrites", { value: changes });
    new MutationObserver((records) => {
      for (const record of records)
        if (
          record.target instanceof Element &&
          record.target.closest("[data-room-layout]")
        )
          changes.push(record.target.tagName);
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["style"],
    });
  });
  page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.name));
  report.pageErrors = errors;
  await page.goto(`${base}${galleryPath}?probe=room-layout`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await expect(page.locator("[data-room-layout]")).toBeVisible();
  report.htmlVersionMarker = await page
    .locator('meta[name="vb-v"]')
    .getAttribute("content");
  const root = page.locator("[data-room-layout]"),
    slider = page.getByRole("slider", { name: "Document width" }),
    documentCell = page.locator("[data-room-document]"),
    board = page.locator("[data-layout-fixture-board]"),
    scrim = page.locator("[data-room-scrim]");
  const width = () =>
    documentCell.evaluate((node) => node.getBoundingClientRect().width);
  const alpha = () =>
    scrim.evaluate((node) => Number(getComputedStyle(node).opacity));
  const sheet = () => page!.locator("[data-layout-sheet]").textContent();
  checkpoint("desktop/container-width-native-input");
  await expect.poll(width).toBeCloseTo(380, 1);
  await slider.focus();
  await slider.press("ArrowLeft");
  await expect.poll(width).toBeCloseTo(404, 1);
  await slider.press("ArrowRight");
  await expect.poll(width).toBeCloseTo(380, 1);
  await slider.press("Home");
  await expect.poll(width).toBeCloseTo(260, 1);
  await slider.press("End");
  const containerWidth = await root.evaluate((node) => node.clientWidth);
  await expect.poll(width).toBeCloseTo(containerWidth - 272 - 320, 1);
  await page
    .getByRole("button", { name: "Application rail", exact: true })
    .click();
  const reducedWidth = await root.evaluate((node) => node.clientWidth);
  assert.equal(containerWidth - reducedWidth, 68);
  await expect.poll(width).toBeCloseTo(reducedWidth - 272 - 320, 1);
  await page
    .getByRole("button", { name: "Application rail", exact: true })
    .click();
  await expect.poll(width).toBeCloseTo(containerWidth - 272 - 320, 1);
  await slider.evaluate((node) => {
    if (!(node instanceof HTMLInputElement))
      throw Error("Expected native range");
    node.value = "473";
    node.dispatchEvent(new InputEvent("input", { bubbles: true }));
  });
  await expect.poll(width).toBeCloseTo(473, 1);
  await page.reload();
  await expect.poll(width).toBeCloseTo(473, 1);
  report.resize = {
    containerWidth,
    reducedWidth,
    nativeInput: "Home/End plus declared synthetic input473",
    persisted: await width(),
  };
  checkpoint("desktop/board-identity");
  await page.getByRole("button", { name: "Board pane", exact: true }).click();
  await board
    .getByLabel("Retained Board draft")
    .fill("Retained 🧪 Board draft");
  const before = await board.elementHandle();
  assert(before);
  await board.getByLabel("Retained Board draft").evaluate((node) => {
    if (node instanceof HTMLTextAreaElement) node.setSelectionRange(3, 8);
  });
  await page.getByRole("button", { name: "Full Board", exact: true }).click();
  await expect(page.locator("[data-room-board]")).toHaveAttribute(
    "data-placement",
    "full",
  );
  assert.equal(
    await board.evaluate((node, witness) => node === witness, before),
    true,
  );
  await page.getByRole("button", { name: "Board pane", exact: true }).click();
  await expect(page.locator("[data-room-board]")).toHaveAttribute(
    "data-placement",
    "pane",
  );
  assert.equal(
    await board.evaluate((node, witness) => node === witness, before),
    true,
  );
  await expect(board.getByLabel("Retained Board draft")).toHaveValue(
    "Retained 🧪 Board draft",
  );
  await expect(page.locator("[data-layout-mounts]")).toHaveText("1");
  checkpoint("desktop/inbox-overlay-retains-board-and-owned-document-width");
  // The document cell is hidden while Board occupies its pane. Measure the
  // visible pane that currently owns the shared document width.
  const retainedWidth = await page
    .locator("[data-room-board]")
    .evaluate((node) => node.getBoundingClientRect().width);
  assert(retainedWidth > 0, "The visible Board pane must own a positive width");
  await page.getByRole("button", { name: "Inbox view", exact: true }).click();
  const inboxDocument = page.locator("[data-layout-inbox-document]");
  await expect(inboxDocument).toBeVisible();
  const retainedResize = page.locator("[data-room-width]");
  await expect(retainedResize).toHaveCount(1);
  await expect(retainedResize).toBeHidden();
  await expect(retainedResize).toBeDisabled();
  await expect(page.locator("[data-room-board]")).toHaveAttribute("inert", "");
  await expect
    .poll(() =>
      inboxDocument.evaluate((node) => node.getBoundingClientRect().width),
    )
    .toBeCloseTo(retainedWidth, 1);
  assert.equal(
    await board.evaluate((node, witness) => node === witness, before),
    true,
  );
  await expect(board).toBeHidden();
  await expect(page.locator("[data-layout-mounts]")).toHaveText("1");
  await page.getByRole("button", { name: "Inbox view", exact: true }).click();
  await expect(page.locator("[data-layout-inbox]")).toHaveCount(0);
  await expect(board).toBeVisible();
  assert.equal(
    await board.evaluate((node, witness) => node === witness, before),
    true,
  );
  await expect(board.getByLabel("Retained Board draft")).toHaveValue(
    "Retained 🧪 Board draft",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);
  // Programmatic placement changes must preserve an actively edited Board;
  // trusted pointer clicks intentionally move focus to their clicked control.
  const retainedDraft = board.getByLabel("Retained Board draft");
  await retainedDraft.focus();
  await page
    .getByRole("button", { name: "Full Board", exact: true })
    .evaluate((node) => {
      if (!(node instanceof HTMLButtonElement))
        throw Error("Expected a native button");
      node.click();
    });
  await expect(retainedDraft).toBeFocused();
  await page
    .getByRole("button", { name: "Sidebar rail", exact: true })
    .evaluate((node) => {
      if (!(node instanceof HTMLButtonElement))
        throw Error("Expected a native button");
      node.click();
    });
  await expect(retainedDraft).toBeFocused();
  await page
    .getByRole("button", { name: "Board pane", exact: true })
    .evaluate((node) => {
      if (!(node instanceof HTMLButtonElement))
        throw Error("Expected a native button");
      node.click();
    });
  await expect(retainedDraft).toBeFocused();
  report.boardIdentity = true;
  checkpoint("mobile/one-sheet-entry-back-forward");
  await page
    .getByRole("button", { name: "Document pane", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 1000 });
  const initialHistory = await page.evaluate(() => history.length);
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await expect.poll(sheet).toBe("doc");
  await expect.poll(alpha).toBe(1);
  assert.equal(await page.evaluate(() => history.length), initialHistory + 1);
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await expect.poll(sheet).toBe("side");
  assert.equal(await page.evaluate(() => history.length), initialHistory + 1);
  await page.goBack();
  await expect.poll(sheet).toBe("closed");
  await page.goForward();
  await expect.poll(sheet).toBe("side");
  await page
    .getByRole("button", { name: "Close sidebar", exact: true })
    .click();
  await expect.poll(sheet).toBe("closed");
  await expect.poll(alpha).toBe(0);
  // A tap on the blurred room under the title menu closes it (Gimenes #3781).
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  await expect.poll(sheet).toBe("side");
  await expect.poll(alpha).toBe(1);
  assert.match(
    await scrim.evaluate((node) => getComputedStyle(node).backdropFilter),
    /blur/,
  );
  await page.mouse.click(195, 990);
  await expect.poll(sheet).toBe("closed");
  await expect.poll(alpha).toBe(0);
  // Closing changes presentation before Back completes. Do not let a pending
  // sheet traversal contaminate this independent media-query transition.
  const historyPage = page;
  const hasSheetEntry = () =>
    historyPage.evaluate(() => {
      const state: unknown = history.state;
      return (
        state !== null && typeof state === "object" && "vbRoomSheet" in state
      );
    });
  await expect.poll(hasSheetEntry).toBe(false);
  checkpoint("mobile/full-board-to-desktop-pane");
  await page.getByRole("button", { name: "Full Board", exact: true }).click();
  await expect(page.locator("[data-room-layout]")).toHaveAttribute(
    "data-board-full",
    "true",
  );
  await expect(page.locator("[data-room-board]")).toHaveAttribute(
    "data-placement",
    "full",
  );
  assert.equal(
    await board.evaluate((node, witness) => node === witness, before),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator("[data-room-layout]")).toHaveAttribute(
    "data-board-full",
    "false",
  );
  await expect(page.locator("[data-room-layout]")).toHaveAttribute(
    "data-pane",
    "board",
  );
  await expect(page.locator("[data-room-board]")).toHaveAttribute(
    "data-placement",
    "pane",
  );
  assert.equal(
    await board.evaluate((node, witness) => node === witness, before),
    true,
  );
  await expect(page.locator("[data-layout-mounts]")).toHaveText("1");
  await expect(board.getByLabel("Retained Board draft")).toHaveValue(
    "Retained 🧪 Board draft",
  );
  report.mobileFullBoardToDesktop = true;
  // Restore the document pane while still desktop so no new mobile sheet or
  // pending Back is created before the following drag proof.
  await page
    .getByRole("button", { name: "Document pane", exact: true })
    .click();
  await page.setViewportSize({ width: 390, height: 1000 });
  await expect.poll(sheet).toBe("closed");
  await expect.poll(hasSheetEntry).toBe(false);
  const samples: unknown[] = [];
  report.samples = samples;
  checkpoint("mobile/pane-in-place-of-chat");
  // Phones (#3767): the doc is a pane in the chat's place, not a drawer: no
  // handle to drag, no backdrop, and Escape (like Back) returns to the chat.
  await expect(page.locator("[data-layout-open-drag]")).toBeHidden();
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await expect.poll(alpha).toBe(1);
  await expect(
    page
      .getByRole("button", { name: "Close document", exact: true })
      .filter({ visible: true }),
  ).toHaveCount(0);
  await expect(page.locator("[data-room-scrim]")).toBeHidden();
  const pane = await documentCell.evaluate((node) => {
    const box = node.getBoundingClientRect(),
      root = node.closest("[data-room-layout]")!.getBoundingClientRect();
    return { bottom: box.bottom, rootBottom: root.bottom, height: box.height };
  });
  samples.push(pane);
  assert(pane.height > 0);
  assert(
    Math.abs(pane.bottom - pane.rootBottom) < 1,
    "The phone pane reaches the bottom of the room, where the chat was",
  );
  await page.keyboard.press("Escape");
  await expect.poll(alpha).toBe(0);
  await expect.poll(sheet).toBe("closed");
  checkpoint("mobile/cancel-form-focus-dialog-escape");
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await expect.poll(sheet).toBe("doc");
  await expect.poll(alpha).toBe(1);
  await page.getByRole("button", { name: "Edit form", exact: true }).click();
  await page.getByLabel("Document draft", { exact: true }).focus();
  const editingHeight = await documentCell.evaluate(
    (node) => node.getBoundingClientRect().height,
  );
  await page.getByLabel("Document draft", { exact: true }).press("Tab");
  await expect(
    page.getByRole("button", { name: "Cancel document form", exact: true }),
  ).toBeFocused();
  assert(
    Math.abs(
      (await documentCell.evaluate(
        (node) => node.getBoundingClientRect().height,
      )) - editingHeight,
    ) < 1,
  );
  await page
    .getByRole("button", { name: "Cancel document form", exact: true })
    .click();
  await expect(page.locator("[data-layout-cancels]")).toHaveText("1");
  await page
    .getByRole("button", { name: "Open nested confirmation", exact: true })
    .click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect.poll(sheet).toBe("doc");
  await page.keyboard.press("Escape");
  await expect.poll(sheet).toBe("closed");
  checkpoint("mobile/open-sheet-to-full-board-no-stale-seek");
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await expect.poll(sheet).toBe("doc");
  await page.getByRole("button", { name: "Full Board", exact: true }).click();
  await expect.poll(sheet).toBe("closed");
  await expect(page.locator("[data-room-board]")).toHaveAttribute(
    "data-placement",
    "full",
  );
  await page.waitForTimeout(31_000); // Exceeds the owned CSS-discovery deadline; negative regression, not readiness.
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Board pane", exact: true }).click();
  await expect.poll(sheet).toBe("doc");
  await page.getByRole("button", { name: "Full Board", exact: true }).click();
  await expect.poll(sheet).toBe("closed");
  await page
    .getByRole("button", { name: "Document pane", exact: true })
    .click();
  checkpoint("mobile/deferred-route-and-selection-entry");
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close then navigate", exact: true })
    .click();
  await expect(page.locator("[data-layout-navigations]")).toHaveText("1");
  await expect(page).toHaveURL(/#layout-deferred$/);
  await page.getByRole("button", { name: "Open sidebar", exact: true }).click();
  const pickHistory = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "Pick thread", exact: true }).click();
  await expect(page).toHaveURL(/#layout-picked$/);
  assert.equal(await page.evaluate(() => history.length), pickHistory);
  checkpoint("dispose/no-style-writes");
  await page
    .getByRole("button", { name: "Dispose layout", exact: true })
    .click();
  const oldSheet = await sheet();
  await page
    .getByRole("button", { name: "Open document", exact: true })
    .click();
  assert.equal(await sheet(), oldSheet);
  report.styleWrites = await page.evaluate(() =>
    Reflect.get(window, "roomLayoutStyleWrites"),
  );
  assert.deepEqual(report.styleWrites, []);
  assert.deepEqual(errors, []);
  report.reducedMotion = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  assert.equal(report.reducedMotion, true);
  await page.screenshot({ path: `${output}/room-layout.png` });
  checkpoint("mobile/default-chat-capacity");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}${galleryPath}?probe=room-layout&capacity=1`, {
    waitUntil: "domcontentloaded",
  });
  const capacityRoot = page.locator("[data-room-layout]");
  await expect(capacityRoot).toBeVisible();
  await expect(page.locator("[data-setup-instructions]")).toBeVisible();
  await expect(capacityRoot).not.toHaveAttribute("data-sheet", /.+/);
  await expect(capacityRoot).toHaveAttribute("data-board-full", "false");
  await expect
    .poll(() =>
      capacityRoot.evaluate(
        (root) => root.firstElementChild?.clientHeight ?? 0,
      ),
    )
    .toBeGreaterThan(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
  const capacity = () =>
    capacityRoot.evaluate((root) => {
      const geometry = (element: Element | null) => {
        if (!(element instanceof HTMLElement)) return null;
        const rect = element.getBoundingClientRect(),
          style = getComputedStyle(element);
        return {
          top: rect.top,
          height: rect.height,
          clientHeight: element.clientHeight,
          scrollHeight: element.scrollHeight,
          display: style.display,
          visibility: style.visibility,
          overflowY: style.overflowY,
          gridTemplateRows: style.gridTemplateRows,
        };
      };
      return {
        root: geometry(root),
        viewport: geometry(root.firstElementChild),
        attention: geometry(root.querySelector("[data-room-attention]")),
        setup: geometry(root.querySelector("[data-setup-instructions]")),
        document: geometry(root.querySelector("[data-room-document]")),
        chat: geometry(root.querySelector("[data-room-chat]")),
        composer: geometry(root.querySelector("[data-room-composer]")),
      };
    });
  const initialCapacity = await capacity();
  const capacityEvidence: Record<string, unknown> = {
    scope:
      "Actual production Layout with actual SetupInstructions in neutral snippets; no integrated Root/Worker acceptance",
    initial: initialCapacity,
  };
  report.mobileCapacity = capacityEvidence;
  // Real snippet dismissal isolates attention size without changing geometry or DOM styles.
  await page.getByRole("button", { name: "Setup notice", exact: true }).click();
  await expect(page.locator("[data-setup-instructions]")).toHaveCount(0);
  capacityEvidence.withoutSetup = await capacity();
  await page.getByRole("button", { name: "Setup notice", exact: true }).click();
  await expect(page.locator("[data-setup-instructions]")).toBeVisible();
  // Use the real desktop visibility action, then return to the identical phone viewport.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole("slider", { name: "Document width" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Toggle document capacity", exact: true })
    .click();
  await expect(page.locator("[data-room-document]")).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("[data-room-document]")).toBeHidden();
  capacityEvidence.withoutDocument = await capacity();
  // Keep the original default-state requirement even if one diagnostic control makes Chat usable.
  capacityEvidence.styleWrites = await page.evaluate(() =>
    Reflect.get(window, "roomLayoutStyleWrites"),
  );
  assert.deepEqual(capacityEvidence.styleWrites, []);
  assert.deepEqual(errors, []);
  assert(
    initialCapacity.chat && initialCapacity.chat.clientHeight > 0,
    "Initial mobile Chat must have positive usable height with real setup content and default closed sheets",
  );

  report.status = "passed";
} catch (error) {
  report.status = interrupted ? "interrupted" : "failed";
  report.failure = error instanceof Error ? error.message : String(error);
  process.exitCode = interrupted ? 130 : 1;
} finally {
  await closeBrowser();
  await gallery?.server.stop(true);
  process.off("SIGINT", signal);
  process.off("SIGTERM", signal);
  report.controllerMemory = await readFile("/proc/self/status", "utf8")
    .then((value) =>
      value.split("\n").filter((line) => /^Vm(?:HWM|RSS):/.test(line)),
    )
    .catch(() => null);
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
}
