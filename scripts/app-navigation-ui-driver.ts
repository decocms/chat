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

export function nativeAppNavigationDriver(
  openPane: (page: Page, pane: "apps") => Promise<void>,
): AppNavigationUIDriver {
  return {
    frameSelector: "[data-native-app-frame] iframe",
    containerSelector: "[data-native-app-frame]",
    async openRoom(page, base, roomId) {
      await page.goto(`${base}/b/${roomId}`);
      await expect(page.locator("[data-native-room-header]")).toBeVisible();
    },
    openApps: (page) => openPane(page, "apps"),
    openButton: (page) =>
      page
        .locator("[data-native-apps]")
        .getByRole("button", { name: /capability-probe/ }),
  };
}
