// The microphone, the audio output and the camera of the call, as the person chose them on this device (the "Mais
// opções" menu of the stage, and the camera's dialog). The choice stays in device storage; a device that is not plugged in now gives the system's own
// device until it comes back.

export type AudioKind = "audioinput" | "audiooutput" | "videoinput";
export type AudioDevice = { id: string; label: string };
/** The system's own device: what the browser uses when the person chose nothing. */
export const SYSTEM_DEVICE = "system";

type DeviceInfo = Pick<MediaDeviceInfo, "kind" | "deviceId" | "label"> & {
  groupId?: string;
};
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

const KEYS: Record<AudioKind, string> = {
  audioinput: "vb-call-mic",
  audiooutput: "vb-call-speaker",
  videoinput: "vb-call-camera",
};
// Chrome lists the system's device again as "default" (and Windows' as "communications"): the menu has its own
// "Padrão do sistema" item for them.
const ALIASES = new Set(["", "default", "communications"]);

function browserStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** The devices of one kind that a person can choose, in the browser's order, each one time. */
export function audioDevices(
  list: readonly DeviceInfo[],
  kind: AudioKind,
): AudioDevice[] {
  const seen = new Set<string>();
  const devices: AudioDevice[] = [];
  for (const info of list) {
    if (info.kind !== kind || ALIASES.has(info.deviceId)) continue;
    if (seen.has(info.deviceId)) continue;
    seen.add(info.deviceId);
    devices.push({ id: info.deviceId, label: info.label });
  }
  return devices;
}

/** The device to use: the one wanted while it is plugged in, else the system's. */
export function chosenDevice(devices: readonly AudioDevice[], wanted: string) {
  return devices.some((device) => device.id === wanted)
    ? wanted
    : SYSTEM_DEVICE;
}

/** What the system's device is now (Chrome's "default" entry), so a change of it can be seen. "" = not known. */
export function systemDeviceKey(list: readonly DeviceInfo[], kind: AudioKind) {
  const entry = list.find(
    (info) => info.kind === kind && info.deviceId === "default",
  );
  return entry ? `${entry.groupId ?? ""}/${entry.label}` : "";
}

/** The device that the person chose last on this device. Nothing stored, or no storage: the system's. */
export function storedDevice(
  kind: AudioKind,
  storage: Storage | null = browserStorage(),
) {
  try {
    return storage?.getItem(KEYS[kind]) || SYSTEM_DEVICE;
  } catch {
    return SYSTEM_DEVICE;
  }
}

export function storeDevice(
  kind: AudioKind,
  id: string,
  storage: Storage | null = browserStorage(),
) {
  try {
    if (id === SYSTEM_DEVICE) storage?.removeItem(KEYS[kind]);
    else storage?.setItem(KEYS[kind], id);
  } catch {
    // Without device storage the choice lasts until the page closes.
  }
}

/** The microphone's constraints for a device. `exact`: that device or an error; else the browser can take another. */
export function micConstraints<T extends object>(
  cleanup: T,
  id: string,
  exact: boolean,
): T & { deviceId?: ConstrainDOMString } {
  if (id === SYSTEM_DEVICE) return { ...cleanup };
  return { ...cleanup, deviceId: exact ? { exact: id } : { ideal: id } };
}

/** The id that `setSinkId` takes: "" is the system's output. */
export const sinkId = (id: string) => (id === SYSTEM_DEVICE ? "" : id);

/** Can this browser send a page's sound to an output that the page chooses? Safari and Firefox (without a flag)
 *  cannot: they get no output list. */
export function canChooseOutput(
  media: object | undefined = globalThis.HTMLMediaElement?.prototype,
) {
  return !!media && "setSinkId" in media;
}
