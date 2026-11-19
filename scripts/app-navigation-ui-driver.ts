import {
  expect as baseExpect,
  type Locator,
  type Page,
} from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30_000 });
/** How the app-navigation probe drives the UI. */
export type AppNavigationUIDriver = {
  frameSelector: string;
  containerSelector: string;
  openRoom(page: Page, base: string, roomId: string): Promise<void>;
  openApps(page: Page): Promise<void>;
  openButton(page: Page): Locator;
};

export function appNavigationDriver(
  openPane: (page: Page, pane: "apps") => Promise<void>,
): AppNavigationUIDriver {
  return {
    frameSelector: "[data-app-frame] iframe",
    containerSelector: "[data-app-frame]",
    async openRoom(page, base, roomId) {
      await page.goto(`${base}/b/${roomId}`);
      await expect(page.locator("[data-room-bar]")).toBeVisible();
    },
    openApps: (page) => openPane(page, "apps"),
    openButton: (page) =>
      page
        .locator("[data-apps]")
        .getByRole("button", { name: /capability-probe/ }),
  };
}
