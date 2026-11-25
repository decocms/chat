import { tick } from "svelte";
import { createApplicationServices } from "./services";
import type { ApplicationBrowser } from "./types";
import { createPwaService } from "../pwa/service";
import { browserDeviceLock } from "../account/device";
import { createHomeApi } from "../home/api";
import { createAccountApi } from "../account/api";
import { createAuthLogoutApi } from "../auth/api";
import { createAgentsApi } from "../agents/api";
import { createMessagesApi } from "../root-room/api";
import { createRoomCache } from "../room-cache/store";
import { pwaLogoutWarning, pwaLogoutFailure } from "../pwa/copy";
import {
  resolveApplicationLanguage,
  applicationLocale,
  createApplicationCopy,
} from "./copy";

/** IndexedDB, or undefined where reading it throws (a private window, blocked site data): rooms then stay in memory. */
function readIndexedDb(win: Window): IDBFactory | undefined {
  try {
    return win.indexedDB ?? undefined;
  } catch {
    return undefined;
  }
}

/** The production document binds browser effects once. Core services have no
 * globals, selectors, HTML strings, mount registry or framework lifecycle. */
export function createBrowserApplicationServices(options: {
  window: Window & typeof globalThis;
  document: Document;
  shellVersion: string | null;
  onIdentityReset?: () => void;
}) {
  const win = options.window,
    doc = options.document;
  const language = resolveApplicationLanguage(
    doc.cookie,
    win.navigator.language,
  );
  const t = createApplicationCopy(language);
  let storage: Storage | null = null;
  try {
    storage = win.localStorage;
  } catch {
    /* Disabled browser storage is supported. */
  }
  let latestTransition: ViewTransition | null = null;
  const browser: ApplicationBrowser = {
    language,
    origin: win.location.origin,
    href: () => win.location.href,
    history: win.history,
    socketUrl(path) {
      const url = new URL(path, win.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.href;
    },
    visible: () => doc.visibilityState === "visible",
    listenVisibility(callback) {
      doc.addEventListener("visibilitychange", callback);
      return () => doc.removeEventListener("visibilitychange", callback);
    },
    listenPop(callback) {
      win.addEventListener("popstate", callback);
      return () => win.removeEventListener("popstate", callback);
    },
    enqueue: (callback) => win.queueMicrotask(callback),
    viewTransition(update) {
      const root = doc.documentElement;
      if (
        typeof doc.startViewTransition !== "function" ||
        win.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ) {
        void update();
        return;
      }
      // The chat's layer name applies only while a room switch runs (the vt-room variant).
      root.dataset.vt = "room";
      // The screen is frozen until update settles, so wait at most 120 ms for the
      // next room's state; a slow room animates in and its messages fill in after.
      const transition = doc.startViewTransition(async () => {
        await Promise.race([
          update(),
          new Promise((done) => win.setTimeout(done, 120)),
        ]);
        await tick();
      });
      latestTransition = transition;
      // The old conversation fades up and out, the new one rises in; the rest crossfades.
      void transition.ready.then(
        () => {
          // The browser's own crossfade of the rest of the page is 250 ms; make it 150.
          for (const animation of doc.getAnimations()) {
            const effect = animation.effect as KeyframeEffect | null;
            if (effect?.pseudoElement?.startsWith("::view-transition"))
              effect.updateTiming({ duration: 150 });
          }
          root.animate(
            [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: "translateY(-6px)" },
            ],
            {
              duration: 90,
              easing: "ease-in",
              fill: "both",
              pseudoElement: "::view-transition-old(room-chat)",
            },
          );
          root.animate(
            [
              { opacity: 0, transform: "translateY(6px)" },
              { opacity: 1, transform: "none" },
            ],
            {
              duration: 150,
              delay: 30,
              easing: "cubic-bezier(0.2, 0.7, 0.2, 1)",
              fill: "both",
              pseudoElement: "::view-transition-new(room-chat)",
            },
          );
        },
        () => {},
      );
      void transition.finished.finally(() => {
        if (latestTransition === transition) delete root.dataset.vt;
      });
    },
    navigateDocument: (href) => {
      win.location.href = href;
    },
    reload: () => win.location.reload(),
    logoutPost: createAuthLogoutApi(win.fetch.bind(win)),
    logoutWarning: () => win.alert(pwaLogoutWarning(language)),
    logoutFailure: () => win.alert(pwaLogoutFailure(language)),
    shellVersion: options.shellVersion,
    storage,
  };
  const fetcher: typeof fetch = win.fetch.bind(win);
  const device = browserDeviceLock();
  const services = createApplicationServices({
    browser,
    pwa: createPwaService,
    device,
    homeApi: createHomeApi(fetcher),
    accountApi: createAccountApi(fetcher),
    agentsApi: createAgentsApi(fetcher),
    messagesApi: createMessagesApi(fetcher),
    roomCache: createRoomCache(readIndexedDb(win)),
    runnerFetch: fetcher,
    onIdentityReset: options.onIdentityReset,
  });
  return {
    ...services,
    device,
    language,
    locale: applicationLocale(language),
    t,
  };
}
export type BrowserApplicationServices = ReturnType<
  typeof createBrowserApplicationServices
>;
