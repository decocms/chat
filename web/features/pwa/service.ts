import { get, writable } from "svelte/store";
import type { Message, Room } from "../../../shared/room";
import { createPushApi, withPushEndpointLock } from "../notifications/api";
import { createPushReconciler } from "../notifications/reconcile";
import { notificationPolicy } from "../notifications/policy";
import { createChime } from "../notifications/audio";
import {
  NOTIFY_KEY,
  SOUND_KEY,
  deviceStorage,
  enableDeviceNotifications,
  readDeviceAlerts,
  saveDeviceAlert,
  type EnableOutcome,
  type Permission,
} from "../notifications/device";
import {
  installEvent,
  installOutcome,
  platform,
  store,
  stored,
  type InstallEvent,
} from "./platform";
import {
  existingPushRegistration,
  pushRegistration,
  keyBytes,
} from "./registration";
const currentPermission = (): Permission =>
  "Notification" in window ? Notification.permission : "unsupported";
const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window;
export function createPwaService() {
  const storage = deviceStorage();
  const state = writable({
    ...platform(),
    pushSupported: pushSupported(),
    permission: currentPermission(),
    // This device's two switches (see notifications/device.ts).
    ...readDeviceAlerts(storage, currentPermission()),
    dismissed: stored("vb.pwaOff"),
    canInstall: false,
    steps: false,
    installBusy: false,
    error: "",
    /** The Notifications switch is turning on: permission, subscription, test. */
    enabling: false,
  });
  const api = createPushApi();
  const endpointApi = withPushEndpointLock(api);
  const push = createPushReconciler(endpointApi, {
    matchesKey: (sub, key) => {
      const bytes = sub.options?.applicationServerKey;
      if (!bytes) return true;
      const actual = new Uint8Array(bytes),
        desired = keyBytes(key);
      return (
        actual.length === desired.length &&
        actual.every((byte, index) => byte === desired[index])
      );
    },
    get: async () =>
      (await existingPushRegistration())?.pushManager.getSubscription() ?? null,
    subscribe: async (key) =>
      (await pushRegistration()).pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      }),
  });
  const sound = createChime();
  let accountRevision = 0;
  let active = true,
    account: string | null = null,
    leaving = false,
    installed = false,
    install: InstallEvent | null = null;
  const observed = new Set<string>();
  const supported = () => pushSupported() && !get(state).iosWeb;
  const refresh = () => {
    if (active)
      state.update((value) => ({
        ...value,
        ...platform(),
        standalone: installed || platform().standalone,
        pushSupported: pushSupported(),
        permission: currentPermission(),
      }));
  };
  const sync = () => {
    refresh();
    if (!active || !account || leaving || !supported())
      return Promise.resolve();
    const value = get(state);
    // The push endpoint exists only while the Notifications switch is on.
    return push.set(
      account,
      value.permission === "granted" && value.notifications,
    );
  };
  const storageChange = (event: StorageEvent) => {
    if (
      event.key !== NOTIFY_KEY &&
      event.key !== SOUND_KEY &&
      event.key !== "vb.pwaOff"
    )
      return;
    state.update((value) => ({
      ...value,
      ...readDeviceAlerts(storage, value.permission),
      dismissed: stored("vb.pwaOff"),
    }));
    void sync();
  };
  const visible = () => {
    if (!document.hidden) void sync();
  };
  const beforeInstall = (event: Event) => {
    if (!active || get(state).ios || !installEvent(event)) return;
    event.preventDefault();
    install = event;
    state.update((value) => ({ ...value, canInstall: true }));
  };
  const appInstalled = () => {
    installed = true;
    install = null;
    refresh();
    state.update((value) => ({ ...value, canInstall: false }));
  };
  const display = matchMedia("(display-mode: standalone)"),
    coarse = matchMedia("(pointer: coarse)");
  window.addEventListener("beforeinstallprompt", beforeInstall);
  window.addEventListener("appinstalled", appInstalled);
  window.addEventListener("storage", storageChange);
  document.addEventListener("visibilitychange", visible);
  display.addEventListener("change", refresh);
  coarse.addEventListener("change", refresh);
  const updateWorker = () => {
    void existingPushRegistration()
      .then((reg) => reg?.update())
      .catch(() => {
        if (active)
          state.update((value) => ({ ...value, error: "worker-update" }));
      });
  };
  import.meta.hot?.on("vb:pwa-worker", updateWorker);
  return {
    state,
    push: push.state,
    account(email: string) {
      if (!active || leaving || account === email) return;
      account = email;
      accountRevision++;
      observed.clear();
      state.update((value) => ({ ...value, enabling: false, error: "" }));
      void sync();
    },
    refresh: sync,
    /** The Notifications switch. On: ask, subscribe, send a test. Off: remove this device's endpoint. */
    async setNotifications(on: boolean) {
      if (!active || leaving) return;
      if (!on) {
        const persisted = saveDeviceAlert(storage, NOTIFY_KEY, false);
        state.update((value) => ({
          ...value,
          notifications: false,
          enabling: false,
          error: persisted ? "" : "storage",
        }));
        await sync();
        return;
      }
      if (get(state).enabling) return;
      const epoch = accountRevision;
      const live = () => active && !leaving && epoch === accountRevision;
      state.update((value) => ({ ...value, enabling: true, error: "" }));
      let outcome: EnableOutcome;
      try {
        outcome = await enableDeviceNotifications({
          permission: currentPermission,
          request: () => Notification.requestPermission(),
          save: () => {
            const persisted = saveDeviceAlert(storage, NOTIFY_KEY, true);
            state.update((value) => ({
              ...value,
              permission: currentPermission(),
              notifications: true,
              error: persisted ? "" : "storage",
            }));
          },
          subscribe: async () => {
            await sync();
            return get(push.state).status;
          },
          wanted: () => live() && get(state).notifications,
          endpoint: async () => {
            const reg = await existingPushRegistration();
            return (await reg?.pushManager.getSubscription())?.endpoint ?? null;
          },
          test: async (endpoint) => (await api.test(endpoint)).sent,
        });
      } catch {
        outcome = "failed";
      }
      if (!active) return;
      refresh();
      state.update((value) => ({
        ...value,
        enabling: false,
        error:
          live() && outcome === "failed" && value.notifications
            ? "enable"
            : value.error === "storage"
              ? "storage"
              : "",
      }));
    },
    /** "Try again" after a failed turn-on: the same path; the switch stays on. */
    retry() {
      if (get(state).notifications) void this.setNotifications(true);
      else void sync();
    },
    /** The Sound switch (the in-app chime). Turning it on plays the chime once; that click unlocks audio. */
    setSound(on: boolean) {
      if (!active || leaving) return;
      const persisted = saveDeviceAlert(storage, SOUND_KEY, on);
      state.update((value) => ({
        ...value,
        sound: on,
        error: persisted ? value.error : "storage",
      }));
      if (on) {
        sound.unlock();
        sound.play();
      }
    },
    dismissInstall() {
      if (!active || leaving) return;
      store("vb.pwaOff", true);
      state.update((value) => ({ ...value, dismissed: true }));
    },
    async install() {
      if (!active || leaving || get(state).installBusy) return;
      const event = install;
      if (!event) {
        state.update((value) => ({ ...value, steps: !value.steps }));
        return;
      }
      install = null;
      state.update((value) => ({
        ...value,
        installBusy: true,
        error: "",
        canInstall: false,
      }));
      try {
        await event.prompt();
        const outcome = installOutcome(await event.userChoice);
        if (active && outcome === "accepted") {
          installed = true;
          refresh();
        }
      } catch {
        if (active) state.update((value) => ({ ...value, error: "install" }));
      } finally {
        if (active) state.update((value) => ({ ...value, installBusy: false }));
      }
    },
    notify(
      message: Message,
      room: Room,
      thread: string,
      target: (handle: string) => string | null | undefined,
      label: (message: Message) => string,
    ) {
      if (
        !active ||
        leaving ||
        account !== room.me ||
        observed.has(`${room.id}:${message.id}`)
      )
        return;
      observed.add(`${room.id}:${message.id}`);
      if (observed.size > 500) observed.delete(observed.values().next().value!);
      const policy = notificationPolicy(
        message,
        room,
        thread,
        document.hidden,
        get(state),
        target,
      );
      if (policy.chime) sound.play();
      if (policy.browser && get(state).permission === "granted") {
        try {
          const notification = new Notification(
            `${policy.mentioned ? "@ · " : ""}${label(message)} · ${room.book.title}`,
            {
              body: (message.text || "📎").slice(0, 180),
              tag: `vb-${room.id}`,
              icon: "/apple-touch-icon.png",
            },
          );
          notification.onclick = () => {
            if (active) window.focus();
            notification.close();
          };
        } catch {
          // Mobile browsers require the shared worker's notification API.
          const epoch = accountRevision;
          void pushRegistration()
            .then(async (reg) => {
              if (!active || leaving || epoch !== accountRevision) return;
              await reg.showNotification(
                `${policy.mentioned ? "@ · " : ""}${label(message)} · ${room.book.title}`,
                {
                  body: (message.text || "📎").slice(0, 180),
                  tag: `vb-${room.id}`,
                  icon: "/apple-touch-icon.png",
                  data: {
                    url: `/b/${room.id}${message.thread && message.thread !== "main" ? `?t=${encodeURIComponent(message.thread)}` : ""}#m${message.id}`,
                  },
                },
              );
            })
            .catch(() => {
              if (active && !leaving && epoch === accountRevision)
                state.update((value) => ({ ...value, error: "foreground" }));
            });
        }
      }
    },
    async beforeLogout() {
      leaving = true;
      accountRevision++;
      if (!("serviceWorker" in navigator) || !("PushManager" in window))
        return { local: true, settled: true, confirmed: true };
      return await push.beforeLogout();
    },
    dispose() {
      active = false;
      push.dispose();
      sound.dispose();
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
      window.removeEventListener("storage", storageChange);
      document.removeEventListener("visibilitychange", visible);
      display.removeEventListener("change", refresh);
      coarse.removeEventListener("change", refresh);
      import.meta.hot?.off("vb:pwa-worker", updateWorker);
    },
  };
}
export type PwaService = ReturnType<typeof createPwaService>;
