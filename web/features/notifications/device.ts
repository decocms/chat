import type { PushState } from "./reconcile";

/** This device's two alert switches. Stored in localStorage only; the server never sees them. */
export type DeviceAlerts = { notifications: boolean; sound: boolean };
export type Permission = NotificationPermission | "unsupported";
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

export const NOTIFY_KEY = "vb.notify",
  SOUND_KEY = "vb.sound",
  /** The old single switch for sound and notifications ("1" = muted). Read once by the migration. */
  LEGACY_MUTE_KEY = "vb.mute",
  /** "1" after this device was offered notifications once (banner or first send). It is not offered again. */
  ASKED_KEY = "vb.notifyAsked";

export function readAsked(storage: Storage | null) {
  try {
    return storage?.getItem(ASKED_KEY) === "1";
  } catch {
    return true;
  }
}

/**
 * Notifications are on by default in spirit: a device that never chose gets
 * one offer (Gimenes #4354, #4363). The browser still needs its own prompt,
 * which opens only from a click or a key, so the offer is a banner and the
 * first send.
 */
export function notificationOffer(view: {
  permission: Permission;
  iosWeb: boolean;
  pushSupported: boolean;
  notifications: boolean;
  asked: boolean;
}) {
  return (
    notificationAvailability(view) === "ready" &&
    view.permission === "default" &&
    !view.notifications &&
    !view.asked
  );
}

export function deviceStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the two switches. A device without them gets them once from the old
 * mute value: granted and not muted → both on; muted → both off; anything
 * else → notifications off, sound on. New devices land in the last case.
 */
export function readDeviceAlerts(
  storage: Storage | null,
  permission: Permission,
): DeviceAlerts {
  try {
    if (!storage) throw new Error("no-storage");
    const notify = storage.getItem(NOTIFY_KEY),
      sound = storage.getItem(SOUND_KEY);
    if (notify !== null || sound !== null)
      return {
        notifications: notify === "1",
        sound: sound === null || sound === "1",
      };
    const muted = storage.getItem(LEGACY_MUTE_KEY) === "1";
    const migrated: DeviceAlerts = muted
      ? { notifications: false, sound: false }
      : { notifications: permission === "granted", sound: true };
    storage.setItem(NOTIFY_KEY, migrated.notifications ? "1" : "");
    storage.setItem(SOUND_KEY, migrated.sound ? "1" : "");
    storage.removeItem(LEGACY_MUTE_KEY);
    return migrated;
  } catch {
    return { notifications: false, sound: true };
  }
}

export function saveDeviceAlert(
  storage: Storage | null,
  key: typeof NOTIFY_KEY | typeof SOUND_KEY,
  on: boolean,
) {
  try {
    if (!storage) return false;
    storage.setItem(key, on ? "1" : "");
    return true;
  } catch {
    return false;
  }
}

/** Why the Notifications switch cannot turn on here, or "ready". */
export function notificationAvailability(view: {
  permission: Permission;
  iosWeb: boolean;
  pushSupported: boolean;
}) {
  if (view.iosWeb) return "ios" as const;
  if (view.permission === "unsupported" || !view.pushSupported)
    return "unsupported" as const;
  if (view.permission === "denied") return "denied" as const;
  return "ready" as const;
}

export type EnableOutcome =
  "on" | "denied" | "dismissed" | "off" | "unavailable" | "failed";

/**
 * Turning the switch on, from the click: ask the browser (the first await, so
 * the click still allows the prompt), save the switch, subscribe this device,
 * then send one test notification to this device only.
 */
export async function enableDeviceNotifications(port: {
  permission(): Permission;
  request(): Promise<NotificationPermission>;
  save(): void;
  subscribe(): Promise<PushState["status"]>;
  /** False when the switch went off (or the account changed) while this ran. */
  wanted(): boolean;
  endpoint(): Promise<string | null>;
  test(endpoint: string): Promise<number>;
}): Promise<EnableOutcome> {
  let permission = port.permission();
  if (permission === "unsupported") return "failed";
  if (permission === "default") permission = await port.request();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "dismissed";
  port.save();
  const status = await port.subscribe();
  if (!port.wanted()) return "off";
  if (status === "unavailable") return "unavailable";
  if (status !== "on") return "failed";
  const endpoint = await port.endpoint();
  if (!port.wanted()) return "off";
  if (!endpoint) return "failed";
  return (await port.test(endpoint)) > 0 ? "on" : "failed";
}
