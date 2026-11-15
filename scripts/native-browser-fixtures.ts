import assert from "node:assert/strict";
import {
  expect as baseExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { DocumentPane } from "../svelte/features/documents/types";
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

/** Shared only by incremental native UI suites, not production acceptance. */
export async function nativeBrowserFixtures(
  context: BrowserContext,
  base: string,
) {
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
  return [
    "legacy-only Google CSS isolated",
    "local runner: no active rooms/directory",
  ];
}

/** Actual native document controls. Never click an already-selected phone tab: that closes its history-owned sheet. */
export async function openNativeRoomPane(
  page: Page,
  pane: Exclude<DocumentPane, "view">,
) {
  const layout = page.locator("[data-native-room-layout]");
  const content: Record<Exclude<DocumentPane, "view">, string> = {
    doc: "[data-native-document]",
    board: "[data-board-scope]",
    files: '[data-vb-native="files"]',
    apps: "[data-native-apps]",
    agents: "[data-native-agents]",
    decisions: "[data-decisions-panel]",
    reminders: "[data-reminders-panel]",
  };
  await expect(layout).toBeVisible();
  const full = page.locator("[data-native-board-toggle]");
  if ((await full.getAttribute("aria-pressed")) === "true") await full.click();
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    const button = page.locator(
      `[data-room-peek] [data-document-pane="${pane}"]`,
    );
    if (pane === "board") {
      await full.click();
      await expect(full).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator(content.board)).toBeVisible();
      return;
    }
    if (
      (await layout.getAttribute("data-sheet")) !== "doc" ||
      (await layout.getAttribute("data-pane")) !== pane
    )
      await button.click();
    await expect(layout).toHaveAttribute("data-sheet", "doc");
  } else {
    const button = page.locator(
      `[data-room-document-toolbar] [data-document-pane="${pane}"]`,
    );
    if (!(await button.isVisible()))
      await page.locator("[data-native-document-toggle]").click();
    if ((await layout.getAttribute("data-pane")) !== pane) await button.click();
  }
  await expect(layout).toHaveAttribute("data-pane", pane);
  // A selected pane or a loading placeholder is not feature readiness. Include
  // its actual first module load before font/a11y/history assertions continue.
  await expect(page.locator(content[pane])).toBeVisible();
}
/** Preview-mode AST slot, never the retained hidden legacy #tasks placeholder. */
export function nativeTaskRegion(page: Page, name = "Tasks") {
  return page
    .locator(
      "[data-native-document] [data-document-preview] [data-document-tasks]",
    )
    .getByRole("region", { name, exact: true });
}
export async function showNativeTasks(page: Page, name = "Tasks") {
  await nativeDocumentMode(page, "preview");
  await expect(nativeTaskRegion(page, name)).toBeVisible({ timeout: 60_000 });
}

/** Native header disclosure on phones; the actual native rail disclosure on desktop. */
export async function openNativeSidebar(page: Page) {
  const book = page.locator(".book:not(.skel)");
  await expect(book).toBeAttached({ timeout: 60_000 });
  if ((page.viewportSize()?.width ?? 1440) <= 900) {
    if ((await book.getAttribute("data-sheet")) !== "side")
      await page
        .locator("[data-native-thread-header]")
        .getByRole("button", {
          name: /^(Switch conversation|Trocar de conversa)$/,
        })
        .click();
    await expect(book).toHaveAttribute("data-sheet", "side");
  } else {
    const expand = page
      .locator("[data-native-room-sidebar]")
      .getByRole("button", { name: /^(Open menu|Abrir menu)$/ });
    if (await expand.isVisible()) await expand.click();
  }
  await expect(page.locator("[data-native-room-sidebar]")).toBeVisible();
}

export async function nativeDocumentMode(page: Page, mode: "preview" | "edit") {
  await openNativeRoomPane(page, "doc");
  const toggle = page
    .locator("[data-native-document] > footer")
    .getByRole("button", {
      name: mode === "preview" ? /^(Done|Pronto)$/ : /^(Edit|Editar)$/,
    });
  if (await toggle.isVisible()) await toggle.click();
  await expect(
    page.locator(
      mode === "preview" ? "[data-document-preview]" : "[data-document-editor]",
    ),
  ).toBeVisible({ timeout: 60_000 });
}
