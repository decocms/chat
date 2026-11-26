// Real browser + local Worker check. Start `bun run dev --var DEV_EMAIL:codex-test@example.test`
// and run `bun scripts/browser-check.ts`. Test data is confined to a newly created local room.
import { receivedEvent, sentFrame } from "./room-frames";
import { chromium, expect as baseExpect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { parseRoomEvent } from "../shared/validation";
import { createRoomStore } from "../web/app/roomStore";
import * as z from "zod/mini";
import {
  openRoomPane,
  openRoomSidebar,
  tasksRegion,
  openTasksPanel,
  documentMode,
  startThreadFromMessage,
} from "./browser-fixtures";
const expect = baseExpect.configure({ timeout: 60_000 });
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:8797";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))
  throw Error("Browser check requires a local test Worker");
const output = process.env.TEST_OUTPUT_DIR || "/tmp/vibebook-browser-check";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const errors: string[] = [];
const capturedRoom = createRoomStore();
try {
  const desktop = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await desktop.addCookies([{ name: "vb_lang", value: "en", url: base }]);
  desktop.setDefaultTimeout(60_000);
  const created = await desktop.request.post(`${base}/api/books`, {
    timeout: 120_000,
    data: { title: "Svelte migration verification" },
    headers: { origin: base },
  });
  if (!created.ok())
    throw Error(`Create room ${created.status()}: ${await created.text()}`);
  const { id } = z.object({ id: z.string() }).parse(await created.json());
  const second = await browser.newContext({
    locale: "pt-BR",
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: "reduce",
  });
  await second.addCookies([{ name: "vb_lang", value: "pt", url: base }]);
  // Two independent live sessions exercise server fan-out without sending invitations.
  const a = await desktop.newPage(),
    b = await second.newPage();
  for (const page of [a, b]) {
    page.on("websocket", (socket) => {
      socket.on("framesent", (frame) => {
        try {
          const m = sentFrame(String(frame.payload));
          if (m?.t === "msg") console.log("WS sent", m.text);
        } catch {}
      });
      socket.on("framereceived", (frame) => {
        try {
          const m = receivedEvent(String(frame.payload));
          if (m && socket.url().includes("/ws/"))
            capturedRoom.apply(parseRoomEvent(String(frame.payload)), id);
          if (m?.t === "msg")
            console.log("WS received", (m.m as { text?: unknown }).text);
        } catch {}
      });
    });
    page.on("pageerror", (error) => {
      errors.push(error.message);
      console.error("BROWSER_ERROR", error.message);
    });
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.abort(),
    );
    await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await page.route("http://127.0.0.1:47321/**", (route) => route.abort());
  }
  const opened = Date.now();
  await a.goto(`${base}/b/${id}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(a.locator("#composer")).toBeVisible({ timeout: 120_000 });
  await openRoomSidebar(a);
  // No "Nova thread" in the sidebar (Gimenes #4286): a thread starts from a message.
  await expect(a.locator("#side [data-new-epic]")).toHaveCount(0);
  const readyMs = Date.now() - opened;
  await startThreadFromMessage(a, "Verify live Svelte");
  const epic = a
    .locator("#side [data-epic-thread]")
    .filter({ hasText: "Verify live Svelte" });
  await expect(epic).toHaveCount(1, { timeout: 90_000 });
  const eid = await epic.getAttribute("data-epic-thread");
  if (!eid) throw Error("Missing epic");
  await epic.click();
  await openTasksPanel(a);
  const aTasks = tasksRegion(a);
  await expect(aTasks.locator("#newTask input")).toBeVisible({
    timeout: 90_000,
  });
  await aTasks.locator("#newTask input").fill("Check two-session updates");
  await aTasks.locator("#newTask input").press("Enter");
  await expect(aTasks.locator("[data-task-title]").first()).toContainText(
    "Check two-session updates",
  );
  await aTasks
    .locator("#newTask input")
    .fill("Keep epic open during verification");
  await aTasks.locator("#newTask input").press("Enter");
  await expect(aTasks.locator("[data-task]")).toHaveCount(2);
  console.log("PASS desktop renders; epic and tasks created");
  await b.goto(`${base}/b/${id}?t=${eid}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await expect(b.locator("#composer")).toBeVisible({ timeout: 120_000 });
  await openTasksPanel(b, "Tarefas");
  const bTasks = tasksRegion(b, "Tarefas");
  await expect(bTasks.locator("[data-task-title]").first()).toContainText(
    "Check two-session updates",
  );
  const taskId = await aTasks
    .locator("[data-task]")
    .filter({ hasText: "Check two-session updates" })
    .getAttribute("data-task");
  if (!taskId) throw Error("Missing task id");
  const checkbox = aTasks.locator(
    `[data-task="${taskId}"] input[type=checkbox]`,
  );
  const remoteCheckbox = bTasks.locator(
    `[data-task="${taskId}"] input[type=checkbox]`,
  );
  await checkbox.check();
  await expect(remoteCheckbox).toBeChecked({ timeout: 90_000 });
  await checkbox.uncheck();
  await expect(remoteCheckbox).not.toBeChecked({ timeout: 90_000 });
  const [me, shell] = await Promise.all([
    desktop.request.get(`${base}/api/me`),
    desktop.request.get(`${base}/b/${id}`),
  ]);
  const version = z.object({ v: z.string() }).parse(await me.json()).v;
  expect(await shell.text()).toContain(`name="vb-v" content="${version}"`);
  await a.reload({ waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(a.locator("#composer")).toBeVisible({ timeout: 120_000 });
  await openTasksPanel(a);
  await expect(aTasks.locator(`[data-task="${taskId}"]`)).toBeVisible();
  console.log(
    "PASS release version in the room shell and task state after reload",
  );
  const composer = a.locator("[data-composer]");
  const send = composer.locator("[data-composer-send]");
  // A keyed message row preserves escaping, actions and reply context.
  await composer
    .locator("#input")
    .fill("Migration <img src=x onerror=alert(1)> verified");
  await send.click();
  await expect(
    b
      .locator("#msgs [data-chat-message] [data-message-body]")
      .filter({ hasText: "Migration <img src=x onerror=alert(1)> verified" }),
  ).toHaveCount(1, { timeout: 90_000 });
  console.log("PASS two live sessions, task fan-out and escaped chat");
  await expect(a.locator("#msgs [data-message-body] img")).toHaveCount(0);
  const sent = a
    .locator("#msgs [data-chat-message]")
    .filter({ hasText: "Migration <img src=x onerror=alert(1)> verified" });
  await sent.hover();
  // Reply is in the bar of your own message too (Valls).
  await sent.locator("[data-message-toolbar] [data-reply]").click();
  await expect(composer.locator("[data-composer-reply]")).toBeVisible();
  await composer.locator("#input").fill("Reply keeps its context");
  await send.click();
  await expect(
    b
      .locator("#msgs [data-chat-message]")
      .filter({ hasText: "Reply keeps its context" })
      .locator("[data-quote]"),
  ).toContainText("Migration", { timeout: 90_000 });
  console.log("PASS reply context");
  // Typed HTTP upload then files filter/viewer and shared pin update.
  await composer.locator('input[type="file"]').setInputFiles({
    name: "verification.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Verified typed upload"),
  });
  await expect(send).toBeEnabled({ timeout: 90_000 });
  await composer.locator("#input").fill("Attached verification");
  await send.click();
  await openRoomPane(a, "files");
  const fileTile = a
    .locator('[data-view="files"] [data-file-id]')
    .filter({ hasText: "verification.txt" });
  await expect(fileTile).toHaveCount(1, { timeout: 90_000 });
  console.log("PASS typed file upload");
  await fileTile.locator("button[aria-pressed]").click();
  await openRoomSidebar(b);
  await expect(b.locator("[data-pins]")).toContainText("verification.txt", {
    timeout: 90_000,
  });
  await openRoomPane(a, "doc");
  await a.locator("#inboxBtn").click();
  const inbox = a.getByRole("dialog", { name: "Inbox", exact: true });
  await expect(inbox).toBeVisible();
  await inbox.getByRole("button", { name: "Close", exact: true }).click();
  console.log("PASS files/pins and Inbox");
  await a.screenshot({ path: `${output}/desktop-after.png`, fullPage: true });
  await b.screenshot({ path: `${output}/mobile-after.png`, fullPage: true });
  // Both CodeMirror instances edit the same Yjs document; the backend mirrors it to Book.
  await documentMode(a, "edit");
  await documentMode(b, "edit");
  const aEditor = a.locator("[data-document-editor] .cm-content"),
    bEditor = b.locator("[data-document-editor] .cm-content");
  await expect(aEditor).toBeVisible();
  await expect(bEditor).toBeVisible();
  await expect(aEditor).toHaveAttribute("contenteditable", "true");
  await aEditor.click();
  await a.keyboard.press("ControlOrMeta+End");
  await a.keyboard.insertText("\n\nLive document synchronization verified");
  await expect(bEditor).toContainText(
    "Live document synchronization verified",
    { timeout: 90_000 },
  );
  console.log("PASS two live Yjs document editors");
  // Exercise real SPA navigation while an editor owns a live provider.
  await a
    .locator('[data-room-sidebar-panel] a[href="/"]:visible')
    .first()
    .click();
  await expect.poll(() => new URL(a.url()).pathname).toBe("/");
  await expect(a.locator("[data-document-editor] .cm-content")).toHaveCount(0);
  await a.goBack();
  await expect(a.locator("#composer")).toBeVisible({ timeout: 120_000 });
  await a
    .locator('[data-room-sidebar-panel] a[href="/"]:visible')
    .first()
    .click();
  await expect(
    a.locator(`[data-room-id="${id}"] a[href="/b/${id}"]:visible`).first(),
  ).toBeVisible({ timeout: 90_000 });
  await a
    .locator(`[data-room-id="${id}"] a[href="/b/${id}"]:visible`)
    .first()
    .click();
  await expect(a.locator("#composer")).toBeVisible({ timeout: 120_000 });
  console.log("PASS home/back/room navigation and live editor teardown");
  const invalid = await desktop.request.post(`${base}/api/books/${id}/post`, {
    data: { text: 42 },
    headers: { origin: base },
  });
  expect(invalid.status()).toBe(400);
  expect(errors).toEqual([]);
  const snapshot = capturedRoom.get();
  if (snapshot)
    await writeFile(
      `${output}/room-state.json`,
      JSON.stringify({ t: "state", ...snapshot }),
    );
  await writeFile(
    `${output}/results.json`,
    JSON.stringify(
      {
        room: id,
        epic: eid,
        readyMs,
        checks: [
          "two live sessions",
          "release version in the room shell",
          "reload",
          "home/back/room navigation and editor teardown",
          "task updates",
          "escaped chat",
          "reply context",
          "typed upload",
          "files and pins",
          "board keyboard/list",
          "invalid HTTP payload",
          "two Yjs editors",
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    `PASS real Worker/browser checks; evidence ${output}; ready ${readyMs} ms`,
  );
} finally {
  await browser.close();
}
