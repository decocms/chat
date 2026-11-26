import { resetChatTime } from "../chat/time";
import type { RoomScopeBrowser } from "./types";
import { cssHex } from "../../lib/ui/cssColor";
import { MOBILE_QUERY } from "../../lib/breakpoints";
/** Only browser bindings; visual geometry/viewport/pointer ownership belongs to
 * RoomLayout, and this adapter does not query or build application DOM. */
export function createRoomScopeBrowser(
  win: Window & typeof globalThis,
  doc: Document,
): RoomScopeBrowser {
  let storage: Storage | null = null;
  try {
    storage = win.localStorage;
  } catch {
    /* Device storage may be disabled. */
  }
  const standalone =
    win.matchMedia("(display-mode: standalone)").matches ||
    Reflect.get(win.navigator, "standalone") === true;
  const ios =
    /iP(hone|ad|od)/.test(win.navigator.userAgent) ||
    (/Mac/.test(win.navigator.userAgent) && win.navigator.maxTouchPoints > 1);
  return {
    origin: win.location.origin,
    href: () => win.location.href,
    historyState: () => win.history.state,
    history: win.history,
    storage,
    fetcher: win.fetch.bind(win),
    iosStandalone: standalone && ios,
    phone: () => win.matchMedia(MOBILE_QUERY).matches,
    visible: () => doc.visibilityState === "visible",
    listenVisibility(callback) {
      const resumed = () => {
        if (doc.visibilityState === "visible") resetChatTime();
        callback();
      };
      doc.addEventListener("visibilitychange", resumed);
      win.addEventListener("focus", resetChatTime);
      return () => {
        doc.removeEventListener("visibilitychange", resumed);
        win.removeEventListener("focus", resetChatTime);
      };
    },
    openExternal: (url) => {
      win.open(url, "_blank", "noopener");
    },
    awarenessColor(account) {
      const index =
        ([...account].reduce((sum, value) => sum + value.codePointAt(0)!, 0) %
          5) +
        1;
      const style = win.getComputedStyle(doc.documentElement);
      return cssHex(
        doc,
        style.getPropertyValue(`--vb-chart-${index}`).trim() ||
          style.getPropertyValue("--vb-primary").trim(),
      );
    },
    clock: {
      schedule: (callback, ms) => win.setTimeout(callback, ms),
      cancel: (handle) => {
        if (typeof handle === "number") win.clearTimeout(handle);
      },
    },
    enqueue: (callback) => win.queueMicrotask(callback),
  };
}
