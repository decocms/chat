import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import {
  expect as baseExpect,
  type Page,
  type BrowserContext,
  type Route,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleAnimations } from "./studio-browser";
import * as z from "zod/mini";
import { InboxResult, MeResult, OkResult } from "../shared/schemas";

const expect = baseExpect.configure({ timeout: 60_000 });
/** Controlled HTTP response fixtures exercise actual native owners and UI.
 * Rooms/messages/auth/storage are real Worker operations; Inbox projections and
 * held/error responses are explicitly controlled, not backend query acceptance. */
export async function auditDesignSystemInbox(
  page: Page,
  context: BrowserContext,
  base: string,
  output: string,
) {
  const ownedRooms: string[] = [];
  const result: {
    status: string;
    phase: string;
    phases: string[];
    inboxReads: number;
    profileReads: number;
    fixtureScope: string;
    cleanup: string[];
  } = {
    status: "running",
    phase: "setup",
    phases: [],
    inboxReads: 0,
    profileReads: 0,
    fixtureScope:
      "Real loopback Worker auth/create/post/archive with schema-validated controlled /api/inbox and matching /api/me waits; held resolves and HTTP errors are fixtures, not DB/query acceptance",
    cleanup: [],
  };
  let held: Route | null = null,
    readFailures = 0;
  const pendingResolve = (): Route | null => held;
  const roomSchema = z.object({ id: z.string() });
  const postedSchema = z.object({
    ok: z.literal(true),
    id: z.number(),
    thread: z.string(),
  });
  async function create(title: string) {
    const response = await context.request.post(`${base}/api/books`, {
      data: { title },
      headers: { origin: base },
    });
    assert(response.ok());
    const room = roomSchema.parse(await response.json());
    ownedRooms.push(room.id);
    return { ...room, title };
  }
  async function post(id: string, text: string) {
    const response = await context.request.post(
      `${base}/api/books/${id}/post`,
      { data: { text, thread: "main" }, headers: { origin: base } },
    );
    assert(response.ok());
    return postedSchema.parse(await response.json());
  }
  async function finish(status: number) {
    const route = held;
    assert(route, "Missing held resolve");
    held = null;
    try {
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(
          status === 200
            ? { ok: true }
            : { error: "Controlled resolve failure" },
        ),
      });
    } catch (error) {
      // Closing an opening cancels its actual fetch. A cancelled route cannot
      // receive the late response; this is distinct from a successful reply.
      if (!route.request().failure()?.errorText.includes("ERR_ABORTED"))
        throw error;
    }
  }
  const inboxRoute = async (route: Route) => {
    const response = await route.fetch();
    assert(
      response.ok(),
      "Real Inbox endpoint must succeed before fixture projection",
    );
    InboxResult.parse(await response.json());
    result.inboxReads++;
    if (readFailures > 0) {
      readFailures--;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Controlled Inbox read failure" }),
      });
      return;
    }
    await route.fulfill({ response, json: InboxResult.parse(data) });
  };
  let data: InboxResult = { waits: [], mentions: [], tasks: [] };
  const meRoute = async (route: Route) => {
    const response = await route.fetch();
    assert(response.ok());
    const me = MeResult.parse(await response.json());
    result.profileReads++;
    await route.fulfill({
      response,
      json: MeResult.parse({ ...me, waits: data.waits }),
    });
  };
  const resolveRoute = (route: Route) => {
    assert.equal(held, null, "Only one owned resolve at a time");
    held = route;
  };
  try {
    const first = await create("Design system Inbox"),
      second = await create("Cross-room Inbox");
    const ask = await post(first.id, "Please review the typed UI"),
      mention = await post(first.id, "Controlled Inbox mention"),
      other = await post(second.id, "Cross-room target message");
    const now = Date.now();
    const initial = {
      book_id: first.id,
      room: first.title,
      ref: `m${ask.id}`,
      thread: "main",
      topic: null,
      author: "peer@example.test",
      author_name: "Peer",
      text: "Please review the typed UI",
      ts: now,
    };
    data = InboxResult.parse({
      waits: [
        initial,
        {
          ...initial,
          ref: "treview-fixture",
          text: "Controlled review approval",
        },
        {
          ...initial,
          book_id: second.id,
          room: second.title,
          ref: `m${other.id}`,
          text: "Cross-room target message",
        },
      ],
      mentions: [
        {
          book_id: first.id,
          room: first.title,
          msg_id: mention.id,
          thread: "main",
          author: "peer@example.test",
          author_name: "Peer",
          text: "Controlled Inbox mention",
          ts: now + 1,
        },
      ],
      tasks: [
        {
          book_id: first.id,
          room: first.title,
          epic_id: "main",
          epic: null,
          task_id: "task-fixture",
          title: "Controlled open task",
          status: "doing",
          due: null,
        },
      ],
    });
    await page.route("**/api/inbox", inboxRoute);
    await page.route("**/api/me?ui=svelte", meRoute);
    await page.route("**/api/waits/resolve", resolveRoute);
    const trigger = page.locator("[data-native-inbox-toggle]");
    const roomInbox = page.locator("[data-native-room-inbox]");
    const composer = page.locator("[data-native-composer] textarea");
    const roomUrl = `${base}/b/${first.id}?ui=svelte`;
    async function enterRoom() {
      await page.goto(roomUrl);
      await expect(trigger).toBeVisible();
      await expect(composer).toBeVisible();
    }
    async function openRoomInbox() {
      const before = result.inboxReads;
      await trigger.click();
      await expect(roomInbox).toBeVisible();
      await expect.poll(() => result.inboxReads).toBeGreaterThan(before);
      await expect(
        roomInbox.getByRole("button", {
          name: "Controlled open task",
          exact: true,
        }),
      ).toBeVisible();
    }
    result.phase = "in-place Inbox and three input sections";
    await enterRoom();
    const originalUrl = page.url();
    await composer.fill("Preserved Inbox draft");
    await openRoomInbox();
    await expect(
      page.getByRole("dialog", { name: "Inbox", exact: true }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(originalUrl);
    await expect(composer).toBeHidden();
    await expect(roomInbox.locator("[data-room-inbox-chat]")).toBeVisible();
    await expect(roomInbox.locator("[data-room-inbox-doc]")).toBeVisible();
    await expect(
      roomInbox.getByText(initial.text, { exact: true }),
    ).toBeVisible();
    await expect(
      roomInbox.getByText("Controlled Inbox mention", { exact: true }),
    ).toBeVisible();
    await expect(
      roomInbox.getByRole("heading", {
        name: "Waiting on your OK",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      roomInbox.getByRole("button", {
        name: "Controlled review approval",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      roomInbox.getByRole("heading", { name: "Your tasks", exact: true }),
    ).toBeVisible();
    await expect(
      roomInbox.getByRole("button", { name: "This room", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      roomInbox.getByText("Cross-room target message", { exact: true }),
    ).toHaveCount(0);
    await settleAnimations(page);
    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await writeFile(
      `${output}/room-inbox-axe.json`,
      JSON.stringify(axe.violations, null, 2) + "\n",
    );
    assert.deepEqual(axe.violations, []);
    await page.screenshot({
      path: `${output}/room-inbox-390.png`,
      fullPage: true,
    });
    const close = roomInbox.locator("[data-native-room-inbox-close]");
    await close.focus();
    await page.keyboard.press("Enter");
    await expect(roomInbox).toHaveCount(0);
    await expect(composer).toHaveValue("Preserved Inbox draft");
    await expect(trigger).toBeFocused();
    result.phases.push(result.phase);

    result.phase = "recoverable Inbox read and retry";
    readFailures = 1;
    await trigger.click();
    await expect(roomInbox.getByRole("alert")).toContainText(
      "Could not load your inbox.",
    );
    await roomInbox
      .getByRole("button", { name: "Try again", exact: true })
      .click();
    await expect(
      roomInbox.getByRole("button", {
        name: "Controlled open task",
        exact: true,
      }),
    ).toBeVisible();
    await expect(roomInbox.getByRole("alert")).toHaveCount(0);
    await roomInbox
      .getByRole("button", { name: "Resolved", exact: true })
      .click();
    await expect.poll(() => held !== null).toBe(true);
    await finish(500);
    await expect(roomInbox.getByRole("alert")).toContainText(
      "Couldn't resolve this request",
    );
    await expect(
      roomInbox.getByRole("button", { name: "Resolved", exact: true }),
    ).toBeEnabled();
    await roomInbox.locator("[data-native-room-inbox-close]").click();
    await expect(trigger).toBeFocused();
    result.phases.push(result.phase);

    result.phase = "mention and task navigation";
    await openRoomInbox();
    await roomInbox
      .locator("[data-room-inbox-message]")
      .filter({ hasText: "Controlled Inbox mention" })
      .getByRole("button")
      .click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `/b/${first.id}` &&
        url.searchParams.get("ui") === "svelte" &&
        url.hash === `#m${mention.id}`,
    );
    await expect(roomInbox).toHaveCount(0);
    await expect(page.locator("[data-room-chat]")).toContainText(
      "Controlled Inbox mention",
    );
    await openRoomInbox();
    await roomInbox
      .getByRole("button", { name: "Controlled open task", exact: true })
      .click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `/b/${first.id}` &&
        url.searchParams.get("ui") === "svelte" &&
        !url.hash &&
        !url.searchParams.has("t"),
    );
    await expect(roomInbox).toHaveCount(0);
    result.phases.push(result.phase);

    result.phase = "all-room navigation preserves selected UI";
    await openRoomInbox();
    await roomInbox.getByRole("button", { name: "All", exact: true }).click();
    await expect(
      roomInbox.getByRole("button", { name: "All", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const crossRoomOpen = roomInbox
      .locator("[data-room-inbox-message]")
      .filter({ hasText: "Cross-room target message" })
      .getByRole("button")
      .filter({ hasText: "Cross-room target message" });
    await expect(crossRoomOpen).toHaveCount(1);
    await crossRoomOpen.click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `/b/${second.id}` &&
        url.searchParams.get("ui") === "svelte" &&
        url.hash === `#m${other.id}`,
    );
    const crossRoomMessage = page.locator(`[data-room-chat] #m${other.id}`);
    await expect(crossRoomMessage).toHaveCount(1);
    await expect(crossRoomMessage).toContainText("Cross-room target message");
    result.phases.push(result.phase);

    result.phase = "Home Inbox modal resolve cancellation and fresh opening";
    await page.goto(`${base}/app?ui=svelte`);
    const dialog = page.getByRole("dialog", { name: "Inbox", exact: true });
    async function openGlobal() {
      await trigger.click();
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("link").filter({ hasText: data.waits[0]!.text }),
      ).toBeVisible();
    }
    const resolveButton = () =>
      dialog
        .getByRole("button", {
          name: "Done (I answered elsewhere, or it's not for me)",
          exact: true,
        })
        .first();
    await openGlobal();
    // The Studio dialog fades in; audit its colors once it is at rest.
    await settleAnimations(page);
    const modalAxe = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    await writeFile(
      `${output}/global-inbox-axe.json`,
      JSON.stringify(modalAxe.violations, null, 2) + "\n",
    );
    assert.deepEqual(modalAxe.violations, []);
    await expect(dialog.getByRole("tablist")).toHaveCount(0);
    await expect(dialog.getByRole("link")).toHaveCount(5);
    for (const text of [
      initial.text,
      "Controlled review approval",
      "Cross-room target message",
      "Controlled Inbox mention",
      "Controlled open task",
    ]) {
      await expect(
        dialog.getByRole("link").filter({ hasText: text }),
      ).toBeVisible();
    }
    await resolveButton().click();
    await expect.poll(() => held !== null).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await finish(200);
    await expect(dialog).toHaveCount(0);
    await openGlobal();
    await resolveButton().click();
    await expect.poll(() => held !== null).toBe(true);
    await page.keyboard.press("Escape");
    data = InboxResult.parse({
      ...data,
      waits: [
        { ...initial, text: "New opening reader request" },
        ...data.waits.slice(1),
      ],
    });
    await openGlobal();
    const fresh = await dialog.getAttribute("id");
    assert(fresh);
    await finish(200);
    await expect(dialog).toHaveAttribute("id", fresh);
    await expect(
      dialog
        .getByRole("link")
        .filter({ hasText: "New opening reader request" }),
    ).toBeVisible();
    result.phases.push(result.phase);

    result.phase = "recoverable resolve error, modal focus and search Escape";
    await resolveButton().click();
    await expect.poll(() => held !== null).toBe(true);
    await finish(500);
    await expect(dialog.getByRole("alert")).toContainText(
      "Couldn't resolve this request",
    );
    await expect(resolveButton()).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await page.keyboard.press("Control+k");
    const search = page.getByRole("dialog", {
      name: "Search",
      exact: true,
    });
    await expect(search).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(search).toHaveCount(0);
    await expect(trigger).toBeFocused();
    assert(result.inboxReads > 0 && result.profileReads > 0);
    result.phases.push(result.phase);
    result.status = "passed";
    return result;
  } catch (error) {
    result.status = "failed";
    throw error;
  } finally {
    const pending = pendingResolve();
    if (pending) {
      await pending.abort().catch(() => {
        result.cleanup.push("held-route-abort");
      });
      held = null;
    }
    await page.unroute("**/api/inbox", inboxRoute).catch(() => {
      result.cleanup.push("unroute-inbox");
    });
    await page.unroute("**/api/me?ui=svelte", meRoute).catch(() => {
      result.cleanup.push("unroute-profile");
    });
    await page.unroute("**/api/waits/resolve", resolveRoute).catch(() => {
      result.cleanup.push("unroute-resolve");
    });
    for (const id of ownedRooms) {
      try {
        const response = await context.request.post(
          `${base}/api/books/${id}/archive`,
          { data: { archived: true }, headers: { origin: base } },
        );
        assert(response.ok());
        OkResult.parse(await response.json());
      } catch {
        result.cleanup.push("archive-owned-room");
      }
    }
    if (result.cleanup.length) result.status = "failed";
    await writeFile(
      `${output}/inbox-results.json`,
      JSON.stringify(result, null, 2) + "\n",
    );
    assert.deepEqual(result.cleanup, [], "Owned Inbox fixture cleanup failed");
  }
}
