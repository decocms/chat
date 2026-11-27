// The call's microphone and audio output (web/features/call/devices.ts): which devices the menu lists, the fall
// back to the system's device, the choice in device storage, and the switch of the microphone in a call that
// goes on (session.ts, with a fake SFU, peer connection and media devices).
import { afterEach, expect, test } from "bun:test";
import { get } from "svelte/store";
import {
  audioDevices,
  canChooseOutput,
  chosenDevice,
  micConstraints,
  sinkId,
  storedDevice,
  storeDevice,
  SYSTEM_DEVICE,
  systemDeviceKey,
} from "../web/features/call/devices";
import type { CallApi } from "../web/features/call/callApi";

const info = (
  kind: MediaDeviceKind,
  deviceId: string,
  label = "",
  groupId = "",
) => ({ kind, deviceId, label, groupId });

test("the menu lists each device of a kind one time, without the browser's own aliases of the system's device", () => {
  const list = [
    info("audioinput", "default", "Default - Headset", "g1"),
    info("audioinput", "communications", "Communications - Headset", "g1"),
    info("audioinput", "mic-a", "Built-in microphone", "g0"),
    info("audioinput", "mic-b", "Headset", "g1"),
    info("audioinput", "mic-b", "Headset", "g1"),
    info("audiooutput", "out-a", "Speakers", "g0"),
    info("videoinput", "cam-a", "Camera", "g2"),
    // Before the microphone is allowed, Safari and Firefox give no id.
    info("audioinput", ""),
  ];
  expect(audioDevices(list, "audioinput")).toEqual([
    { id: "mic-a", label: "Built-in microphone" },
    { id: "mic-b", label: "Headset" },
  ]);
  expect(audioDevices(list, "audiooutput")).toEqual([
    { id: "out-a", label: "Speakers" },
  ]);
  expect(systemDeviceKey(list, "audioinput")).toBe("g1/Default - Headset");
  expect(systemDeviceKey(list, "audiooutput")).toBe("");
});

test("a chosen device that is not plugged in gives the system's, and the chosen one again when it comes back", () => {
  const plugged = [{ id: "mic-a", label: "A" }];
  expect(chosenDevice(plugged, "mic-a")).toBe("mic-a");
  expect(chosenDevice(plugged, "mic-b")).toBe(SYSTEM_DEVICE);
  expect(chosenDevice([], "mic-a")).toBe(SYSTEM_DEVICE);
  expect(chosenDevice(plugged, SYSTEM_DEVICE)).toBe(SYSTEM_DEVICE);
  expect(chosenDevice([...plugged, { id: "mic-b", label: "B" }], "mic-b")).toBe(
    "mic-b",
  );
});

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

test("the choice stays in device storage, one for each kind, and the system's device stores nothing", () => {
  const storage = memoryStorage();
  expect(storedDevice("audioinput", storage)).toBe(SYSTEM_DEVICE);
  storeDevice("audioinput", "mic-b", storage);
  storeDevice("audiooutput", "out-a", storage);
  expect(storedDevice("audioinput", storage)).toBe("mic-b");
  expect(storedDevice("audiooutput", storage)).toBe("out-a");
  storeDevice("audioinput", SYSTEM_DEVICE, storage);
  expect(storedDevice("audioinput", storage)).toBe(SYSTEM_DEVICE);
  expect([...storage.values.keys()]).toEqual(["vb-call-speaker"]);
});

test("without device storage (private mode, blocked) the choice is the system's and nothing throws", () => {
  const broken = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
  };
  expect(storedDevice("audioinput", broken)).toBe(SYSTEM_DEVICE);
  expect(() => storeDevice("audioinput", "mic-a", broken)).not.toThrow();
  expect(storedDevice("audioinput", null)).toBe(SYSTEM_DEVICE);
});

test("the microphone keeps its cleanup with a device, and the output id of the system's is empty", () => {
  const cleanup = { noiseSuppression: true, echoCancellation: true };
  expect(micConstraints(cleanup, SYSTEM_DEVICE, true)).toEqual(cleanup);
  expect(micConstraints(cleanup, "mic-a", true)).toEqual({
    ...cleanup,
    deviceId: { exact: "mic-a" },
  });
  expect(micConstraints(cleanup, "mic-a", false)).toEqual({
    ...cleanup,
    deviceId: { ideal: "mic-a" },
  });
  expect(sinkId(SYSTEM_DEVICE)).toBe("");
  expect(sinkId("out-a")).toBe("out-a");
});

test("the output list shows only where the browser can choose the output (setSinkId)", () => {
  expect(canChooseOutput({ setSinkId() {} })).toBe(true);
  // Safari and Firefox without the flag.
  expect(canChooseOutput({})).toBe(false);
  expect(canChooseOutput(undefined)).toBe(false);
});

// ---- the session: a new microphone in a call that goes on ----

class FakeTrack {
  kind = "audio";
  enabled = true;
  readyState: "live" | "ended" = "live";
  onended: (() => void) | null = null;
  constructor(readonly deviceId: string) {}
  getSettings() {
    return { deviceId: this.deviceId };
  }
  stop() {
    this.readyState = "ended";
  }
  /** The device was unplugged: the browser ends the track. */
  unplug() {
    this.readyState = "ended";
    this.onended?.();
  }
}
const streamOf = (track: FakeTrack) =>
  ({
    getAudioTracks: () => [track],
    getTracks: () => [track],
  }) as unknown as MediaStream;

const saved = new Map<string, PropertyDescriptor | undefined>();
function stub(name: string, value: unknown) {
  if (!saved.has(name))
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}
afterEach(() => {
  for (const [name, descriptor] of saved)
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete (globalThis as Record<string, unknown>)[name];
  saved.clear();
});

async function inCall(options: { plugged: string[]; stored?: string }) {
  const storage = memoryStorage();
  if (options.stored) storage.setItem("vb-call-mic", options.stored);
  let plugged = options.plugged;
  const opened: { constraints: MediaTrackConstraints; track: FakeTrack }[] = [];
  const changeListeners: (() => void)[] = [];
  const replaced: unknown[] = [];
  const sinks: string[] = [];
  const players: { sinkId: string }[] = [];
  let ontrack: ((event: unknown) => void) | null = null;
  stub("localStorage", storage);
  stub("document", {
    visibilityState: "visible",
    addEventListener() {},
    removeEventListener() {},
  });
  stub("navigator", {
    mediaDevices: {
      async getUserMedia({ audio }: { audio: MediaTrackConstraints }) {
        const wanted = audio.deviceId as
          { exact?: string; ideal?: string } | undefined;
        if (wanted?.exact && !plugged.includes(wanted.exact))
          throw new Error("OverconstrainedError");
        const id =
          wanted?.exact ??
          (wanted?.ideal && plugged.includes(wanted.ideal)
            ? wanted.ideal
            : plugged[0]!);
        const track = new FakeTrack(id);
        opened.push({ constraints: audio, track });
        return streamOf(track);
      },
      async enumerateDevices() {
        return plugged.map((id) => info("audioinput", id, `Mic ${id}`));
      },
      addEventListener(_type: string, listener: () => void) {
        changeListeners.push(listener);
      },
      removeEventListener() {},
    },
  });
  stub(
    "HTMLMediaElement",
    class {
      setSinkId() {}
    },
  );
  stub(
    "Audio",
    class {
      srcObject: unknown = null;
      muted = false;
      sinkId = "";
      constructor() {
        players.push(this);
      }
      async setSinkId(id: string) {
        sinks.push(id);
        this.sinkId = id;
      }
      play() {
        return Promise.resolve();
      }
    },
  );
  stub(
    "MediaStream",
    class {
      constructor(readonly tracks: unknown[]) {}
    },
  );
  stub(
    "RTCPeerConnection",
    class {
      localDescription = { sdp: "" };
      set ontrack(listener: (event: unknown) => void) {
        ontrack = listener;
      }
      addTransceiver(track: unknown) {
        return {
          mid: "0",
          sender: {
            track,
            async replaceTrack(next: unknown) {
              replaced.push(next);
              this.track = next;
            },
            getParameters: () => ({ encodings: [{}] }),
            async setParameters() {},
          },
        };
      }
      async createOffer() {
        return { type: "offer", sdp: "" };
      }
      async createAnswer() {
        return { type: "answer", sdp: "" };
      }
      async setLocalDescription() {}
      async setRemoteDescription() {}
      async getStats() {
        return new Map();
      }
      close() {}
    },
  );
  const api = {
    join: async () => "s-me",
    tracks: async () => ({
      sessionDescription: { type: "answer", sdp: "" },
      tracks: [],
    }),
    answer: async () => {},
    leave: async () => {},
    close: async () => {},
    decline: async () => {},
  } as unknown as CallApi;
  const { createCallSession } = await import("../web/features/call/session");
  const call = createCallSession(
    "room",
    api,
    () => true,
    () => "main",
  );
  call.join(true);
  for (let i = 0; i < 50 && get(call.state).phase !== "in"; i++)
    await new Promise((ok) => setTimeout(ok, 0));
  expect(get(call.state).phase).toBe("in");
  const settle = async () => {
    for (let i = 0; i < 20; i++) await new Promise((ok) => setTimeout(ok, 0));
  };
  await settle();
  return {
    call,
    opened,
    replaced,
    sinks,
    players,
    storage,
    settle,
    unplug(id: string) {
      plugged = plugged.filter((one) => one !== id);
      opened.find((one) => one.track.deviceId === id)?.track.unplug();
    },
    plug(id: string) {
      plugged = [...plugged, id];
      for (const listener of changeListeners) listener();
    },
    receive() {
      ontrack?.({ transceiver: { mid: "1" }, track: { kind: "audio" } });
    },
  };
}

test("a new microphone replaces the track in the call, keeps the mute and the cleanup, and stops the old one", async () => {
  const t = await inCall({ plugged: ["mic-a", "mic-b"] });
  expect(get(t.call.devices).inputs.map((device) => device.id)).toEqual([
    "mic-a",
    "mic-b",
  ]);
  expect(get(t.call.devices).mic).toBe(SYSTEM_DEVICE);
  const first = t.opened[0]!.track;
  expect(await t.call.chooseMic("mic-b")).toBe(true);
  const second = t.opened.at(-1)!;
  expect(second.constraints).toMatchObject({
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
    deviceId: { exact: "mic-b" },
  });
  expect(t.replaced.at(-1)).toBe(second.track);
  // Joined muted: the new microphone is muted too.
  expect(second.track.enabled).toBe(false);
  expect(first.readyState).toBe("ended");
  expect(get(t.call.state).phase).toBe("in");
  expect(get(t.call.devices).mic).toBe("mic-b");
  expect(t.storage.getItem("vb-call-mic")).toBe("mic-b");
  // Mute goes to the new track.
  t.call.toggleMute();
  expect(second.track.enabled).toBe(true);
  t.call.leave();
});

test("a microphone that does not open leaves the old one in the call", async () => {
  const t = await inCall({ plugged: ["mic-a"] });
  const first = t.opened[0]!.track;
  expect(await t.call.chooseMic("mic-gone")).toBe(false);
  expect(first.readyState).toBe("live");
  expect(t.replaced).toEqual([]);
  t.call.leave();
});

test("the chosen microphone is unplugged: the call takes the system's, and the chosen one again when it comes back", async () => {
  const t = await inCall({ plugged: ["mic-a", "mic-b"], stored: "mic-b" });
  // The join asked for the stored one.
  expect(t.opened[0]!.constraints.deviceId).toEqual({ ideal: "mic-b" });
  expect(get(t.call.devices).mic).toBe("mic-b");
  t.unplug("mic-b");
  await t.settle();
  expect(get(t.call.devices).mic).toBe(SYSTEM_DEVICE);
  expect(t.opened.at(-1)!.constraints.deviceId).toBeUndefined();
  expect(t.replaced.at(-1)).toBe(t.opened.at(-1)!.track);
  // The choice stays for when it comes back.
  expect(t.storage.getItem("vb-call-mic")).toBe("mic-b");
  t.plug("mic-b");
  await t.settle();
  expect(get(t.call.devices).mic).toBe("mic-b");
  expect(t.replaced.at(-1)).toBe(t.opened.at(-1)!.track);
  t.call.leave();
});

test("the chosen output plays every voice, also a voice that comes later", async () => {
  const t = await inCall({ plugged: ["mic-a"] });
  t.receive();
  expect(await t.call.chooseSpeaker("out-b")).toBe(true);
  expect(t.players.map((player) => player.sinkId)).toEqual(["out-b"]);
  t.receive();
  await t.settle();
  expect(t.players.map((player) => player.sinkId)).toEqual(["out-b", "out-b"]);
  expect(t.storage.getItem("vb-call-speaker")).toBe("out-b");
  t.call.leave();
});

test("the stored cleanup keeps only known switches with a boolean, and is on by default", async () => {
  const { cleanupStored } = await import("../web/features/call/session");
  const on = {
    noiseSuppression: true,
    echoCancellation: true,
    autoGainControl: true,
  };
  expect(cleanupStored(null)).toEqual(on);
  expect(cleanupStored("not json")).toEqual(on);
  expect(
    cleanupStored(
      '{"echoCancellation":false,"autoGainControl":"no","x":false}',
    ),
  ).toEqual({ ...on, echoCancellation: false });
});

test("a cleanup switch opens the microphone again with it, and keeps it on this device", async () => {
  const t = await inCall({ plugged: ["mic-a"] });
  const { micCleanup } = await import("../web/features/call/session");
  const first = t.opened[0]!.track;
  expect(await t.call.toggleCleanup("echoCancellation")).toBe(true);
  const second = t.opened.at(-1)!;
  expect(second.constraints).toMatchObject({
    noiseSuppression: true,
    echoCancellation: false,
    autoGainControl: true,
  });
  expect(t.replaced.at(-1)).toBe(second.track);
  expect(first.readyState).toBe("ended");
  expect(JSON.parse(t.storage.getItem("vb-call-cleanup")!)).toMatchObject({
    echoCancellation: false,
  });
  // Back on, for the next tests.
  expect(await t.call.toggleCleanup("echoCancellation")).toBe(true);
  expect(get(micCleanup).echoCancellation).toBe(true);
  t.call.leave();
});

test("the stored volumes keep only numbers from 0 to 200%", async () => {
  const { volumesStored } = await import("../web/features/call/session");
  expect(volumesStored(null)).toEqual({});
  expect(volumesStored("[")).toEqual({});
  expect(volumesStored('{"a@x":1.5,"b@x":3,"c@x":"1","d@x":0}')).toEqual({
    "a@x": 1.5,
    "d@x": 0,
  });
});

test("a voice past 100% plays louder through Web Audio, and plays as sent again at 100% or less", async () => {
  const gains: { gain: { value: number } }[] = [];
  const node = () => ({ connect: (next: unknown) => next, disconnect() {} });
  stub(
    "AudioContext",
    class {
      resume = async () => {};
      close = async () => {};
      createMediaStreamSource = node;
      createAnalyser = () => ({
        ...node(),
        fftSize: 0,
        getByteTimeDomainData() {},
      });
      createGain = () => {
        const gain = { ...node(), gain: { value: 1 } };
        gains.push(gain);
        return gain;
      };
      createMediaStreamDestination = () => ({ ...node(), stream: "loud" });
    },
  );
  const t = await inCall({ plugged: ["mic-a"] });
  // The fake SFU names no owner for the voice it sends: its person is "".
  t.call.setVolume("", 1.5);
  t.receive();
  const player = t.players[0] as unknown as {
    srcObject: unknown;
    volume: number;
  };
  const raw = t.players[1] as unknown as { srcObject: unknown; muted: boolean };
  expect(player.srcObject).toBe("loud");
  expect(player.volume).toBe(1);
  expect(gains.at(-1)!.gain.value).toBe(1.5);
  // Chrome needs an element on the remote track for Web Audio to hear it: a muted one.
  expect(raw.muted).toBe(true);
  t.call.setVolume("", 1.8);
  expect(gains.at(-1)!.gain.value).toBe(1.8);
  t.call.setVolume("", 0.5);
  expect(player.srcObject).not.toBe("loud");
  expect(player.volume).toBe(0.5);
  expect(raw.srcObject).toBe(null);
  expect(JSON.parse(t.storage.getItem("vb-call-volumes")!)).toEqual({
    "": 0.5,
  });
  t.call.leave();
});
