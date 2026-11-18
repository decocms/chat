import {
  expect as baseExpect,
  type Locator,
  type Page,
} from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30_000 });
/** UI-only adaptation. HTTP/R2 fixtures, SDK protocol and capability assertions are shared. */
export type AppNavigationUIDriver = {
  variant: "svelte";
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
    variant: "svelte",
    frameSelector: "[data-native-app-frame] iframe",
    containerSelector: "[data-native-app-frame]",
    async openRoom(page, base, roomId) {
      await page.goto(`${base}/b/${roomId}?ui=svelte`);
      await expect(page.locator("[data-native-room-header]")).toBeVisible();
    },
    openApps: (page) => openPane(page, "apps"),
    openButton: (page) =>
      page
        .locator("[data-native-apps]")
        .getByRole("button", { name: /capability-probe/ }),
  };
}
