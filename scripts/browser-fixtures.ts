import assert from "node:assert/strict";
import {
  expect as baseExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { DocumentPane } from "../web/features/documents/types";
const expect = baseExpect.configure({ timeout: 60_000 });

/** Public local script locations only; never persist error text, auth URLs or query strings. */
export function localBrowserError(
  error: Pick<Error, "name" | "stack">,
  origin: string | readonly string[],
) {
  const allowed = new Set(typeof origin === "string" ? [origin] : origin);
  const locations = new Set<string>();
  for (const match of (error.stack ?? "").matchAll(
    /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/[^\s)]+/g,
  )) {
    const frame = /^(.*?):(\d+):(\d+)$/.exec(match[0]);
    try {
      const url = new URL(frame?.[1] ?? match[0]);
      if (allowed.has(url.origin) && /\.(?:js|ts)$/.test(url.pathname))
        locations.add(
          `${url.pathname}${frame ? `:${frame[2]}:${frame[3]}` : ""}`,
        );
    } catch {
      /* Ignore non-URL stack formatting. */
    }
  }
  return { name: error.name, locations: [...locations] };
}

/** Shared by the browser suites, not production acceptance. */
export async function browserFixtures(context: BrowserContext, base: string) {
  assert(
    /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base),
    "Use a local test Worker",
  );
  await context.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
  await context.route("http://127.0.0.1:47321/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    assert(
      path === "/ping" || path === "/where",
      "Unexpected local runner operation",
    );
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": base },
      body: path === "/ping" ? '{"rooms":[]}' : "null",
    });
  });
  return ["Google CSS isolated", "local runner: no active rooms/directory"];
}

/** On desktop, the Agents pane opens only from an agent's row: false when the room has no agent yet. */
export async function desktopAgentsPane(page: Page) {
  return !(await page
    .locator('[data-agent-footer] [data-agent-foot="setup"]')
    .isVisible());
}

/** Actual document controls. Never click an already-selected phone tab: that closes its history-owned sheet. */
export async function openRoomPane(
  page: Page,
  pane: Exclude<DocumentPane, "view">,
) {
  const layout = page.locator("[data-room-layout]");
  const content: Record<Exclude<DocumentPane, "view">, string> = {
    doc: "[data-document]",
    board: "[data-board-scope]",
    files: '[data-view="files"]',
    apps: "[data-apps]",
    agents: "[data-agents]",
    decisions: "[data-decisions-panel]",
    reminders: "[data-reminders-panel]",
    people: "[data-pane-people]",
    search: "[data-room-search]",
  };
  await expect(layout).toBeVisible();
  const full = page.locator("[data-board-toggle]");
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    // Phones: no bottom bar (#3738). The title opens a menu whose shortcuts
    // (Doc, Board, Files, Agents) own the board and open the doc sheet; Back
    // leaves the board. The header's board toggle is desktop only.
    const shortcut = async (tab: string) => {
      if ((await layout.getAttribute("data-sheet")) !== "side")
        await page.locator("[data-room-bar] [data-phone-title]").click();
      await expect(layout).toHaveAttribute("data-sheet", "side");
      await page.locator(`[data-phone-menu] [data-phone-tab="${tab}"]`).click();
    };
    const button = page.locator(
      `[data-room-peek] [data-document-pane="${pane}"]`,
    );
    if (pane === "board") {
      if ((await layout.getAttribute("data-board-full")) !== "true")
        await shortcut("board");
      await expect(layout).toHaveAttribute("data-board-full", "true");
      await expect(page.locator(content.board)).toBeVisible();
      return;
    }
    if ((await layout.getAttribute("data-board-full")) === "true") {
      await page.locator("[data-room-bar] [data-phone-back]").click();
      await expect(layout).not.toHaveAttribute("data-board-full", "true");
    }
    // The peek tabs show only while the doc sheet is open (#80), and only the
    // panes of the shortcut it was opened from: Doc + Decisions, Files + Apps,
    // Agents + Reminders. Use the shortcut first when the pane is elsewhere.
    const tab =
      pane === "doc" || pane === "decisions"
        ? "doc"
        : pane === "files" || pane === "apps"
          ? "files"
          : "claude";
    if (
      (await layout.getAttribute("data-sheet")) !== "doc" ||
      !(await button.isVisible())
    ) {
      await shortcut(tab);
      await expect(layout).toHaveAttribute("data-sheet", "doc");
      await expect(button).toBeVisible();
    }
    if ((await layout.getAttribute("data-pane")) !== pane) await button.click();
    await expect(layout).toHaveAttribute("data-sheet", "doc");
  } else {
    // Desktop: the board is always full width, behind its toggle (no pane tab).
    if (pane === "board") {
      if ((await full.getAttribute("aria-pressed")) !== "true")
        await full.click();
      await expect(layout).toHaveAttribute("data-board-full", "true");
      await expect(page.locator(content.board)).toBeVisible();
      return;
    }
    if ((await full.getAttribute("aria-pressed")) === "true")
      await full.click();
    // The tabs live in the room's top bar and open the pane when it's closed;
    // your Claude (the Agents pane) opens from its row at the foot of the
    // sidebar. With no agent the foot has only setup options (the cloud one
    // links to /settings), so callers skip the pane: see desktopAgentsPane.
    const button =
      pane === "agents"
        ? page
            .locator(
              "[data-agent-footer] [data-agent-row] button, [data-agent-footer] > button",
            )
            .first()
        : page.locator(
            `[data-room-document-toolbar] [data-document-pane="${pane}"]`,
          );
    if (
      (await layout.getAttribute("data-pane")) !== pane ||
      !(await page.locator(content[pane]).isVisible())
    )
      await button.click();
  }
  await expect(layout).toHaveAttribute("data-pane", pane);
  // A selected pane or a loading placeholder is not feature readiness. Include
  // its actual first module load before font/a11y/history assertions continue.
  await expect(page.locator(content[pane])).toBeVisible();
}
/** Preview-mode AST slot, never a hidden #tasks placeholder. */
export function tasksRegion(page: Page, name = "Tasks") {
  return page
    .locator("[data-document] [data-document-preview] [data-document-tasks]")
    .getByRole("region", { name, exact: true });
}
export async function openTasksPanel(page: Page, name = "Tasks") {
  await documentMode(page, "preview");
  await expect(tasksRegion(page, name)).toBeVisible({ timeout: 60_000 });
}

/** Header disclosure on phones; the actual rail disclosure on desktop. */
export async function openRoomSidebar(page: Page) {
  const book = page.locator(".book:not(.skel)");
  await expect(book).toBeAttached({ timeout: 60_000 });
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    if ((await book.getAttribute("data-sheet")) !== "side")
      // Phones: the header's title button (room · thread ▾) opens the list.
      await page.locator("[data-room-bar] [data-phone-title]").click();
    await expect(book).toHaveAttribute("data-sheet", "side");
  } else {
    const expand = page
      .locator("[data-room-sidebar-panel]")
      .getByRole("button", { name: /^(Open menu|Abrir menu)$/ });
    if (await expand.isVisible()) await expand.click();
  }
  await expect(page.locator("[data-room-sidebar-panel]")).toBeVisible();
}

export async function documentMode(page: Page, mode: "preview" | "edit") {
  await openRoomPane(page, "doc");
  const toggle = page.locator("[data-document] > footer").getByRole("button", {
    name: mode === "preview" ? /^(Done|Pronto)$/ : /^(Edit|Editar)$/,
  });
  if (await toggle.isVisible()) await toggle.click();
  await expect(
    page.locator(
      mode === "preview" ? "[data-document-preview]" : "[data-document-editor]",
    ),
  ).toBeVisible({ timeout: 60_000 });
}
