// The room's call in this tab: one RTCPeerConnection to the Cloudflare Realtime SFU. It publishes the microphone
// (and the screen), and receives every track that the others in the call publish. The room says who is in the call
// (room.call, src/calls.ts); the Worker passes the WebRTC negotiation on to the SFU (callApi.ts).
import { get, writable } from "svelte/store";
import type { CallPeer } from "../../../shared/room";
import type { SendRoomCommand } from "../../../shared/commands";
import type { CallApi } from "./callApi";
import { isRecorder } from "../../../shared/call";
import type { Denoiser } from "./denoise";
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
  type AudioDevice,
} from "./devices";

// The noise suppression (RNNoise, denoise.ts) is on unless the person turned it off on this device.
const DENOISE_KEY = "vb-call-denoise";
const denoiseStored = () => {
  try {
    return localStorage.getItem(DENOISE_KEY) !== "0";
  } catch {
    return true;
  }
};
/** Is the noise suppression on? It stays between calls, on this device. */
export const denoiseOn = writable(
  typeof localStorage === "undefined" ? true : denoiseStored(),
);

/** Does this tab join the room's call by itself? Only the room's recorder (a browser the chat sends to record the
 *  call, recorder/container/main.ts) does, and only while a person is in the call and its last try did not fail. A
 *  person never does: only a click joins (Entrar na call, Iniciar call, Atender). */
export function joinsByItself(
  me: string,
  peers: readonly CallPeer[] | undefined,
  view: Pick<CallView, "phase" | "error">,
) {
  return (
    isRecorder(me) &&
    view.phase === "idle" &&
    view.error !== "mic" &&
    view.error !== "failed" &&
    !!peers?.some((peer) => !isRecorder(peer.email))
  );
}

export type CallView = {
  phase: "idle" | "joining" | "in";
  muted: boolean;
  sharing: boolean;
  /** The screens that other people share, by email. More than one person can share at a time. */
  screens: Record<string, MediaStream>;
  /** The cameras of other people, by email. */
  cams: Record<string, MediaStream>;
  /** My camera is on, and its picture as my machine has it (the others get a smaller one). */
  camera: boolean;
  ownCam: MediaStream | null;
  /** Whose screen I chose to see (an email, mine too). "" = the first one. */
  watching: string;
  /** Who is speaking now (emails, mine too). */
  speaking: string[];
  /** My own screen while I share it, so I see what the others see. */
  own: MediaStream | null;
  error: "" | "mic" | "failed" | "dropped";
  /** A screen share was refused: the month's traffic budget is spent (the app offers Google Meet). */
  limit: boolean;
  /** Why my screen share stopped or did not start: nobody else is in the call, or the screen did not change. */
  notice: "" | "alone" | "idle";
  /** The people I silenced for me only (emails): this tab does not play their voice; nobody else is told. */
  silenced: string[];
};
/** The microphones and outputs that this device has, and the ones the call uses now (SYSTEM_DEVICE: the system's).
 *  `output`: the browser can send the call's sound to an output that the page chooses (setSinkId). */
export type CallDevices = {
  inputs: AudioDevice[];
  outputs: AudioDevice[];
  mic: string;
  speaker: string;
  output: boolean;
};
const IDLE: CallView = {
  phase: "idle",
  muted: false,
  sharing: false,
  screens: {},
  cams: {},
  camera: false,
  ownCam: null,
  watching: "",
  speaking: [],
  own: null,
  error: "",
  limit: false,
  silenced: [],
  notice: "",
};
const USAGE_MS = 30_000;
/** A track that the SFU did not give is asked for again after this long. */
const PULL_RETRY_MS = 3_000;
// A shared screen that does not change sends almost nothing. Under SCREEN_IDLE_BYTES in each report (30 seconds),
// SCREEN_IDLE_REPORTS times in a row (10 minutes), the share stops by itself. Tune these two with real screens.
const SCREEN_IDLE_BYTES = 50_000,
  SCREEN_IDLE_REPORTS = 20;
/** A shared screen goes out at 1080p and 30 frames a second at most (720p was hard to read, 2026-11-24). */
const SCREEN_LIMITS = {
  width: { max: 1920 },
  height: { max: 1080 },
  frameRate: { max: 30 },
};
/** Speaking: the level (RMS, 0 to 1) that counts as a voice, how often it is read, and how long the mark stays. */
const SPEAK_LEVEL = 0.02,
  SPEAK_MS = 200,
  SPEAK_HOLD_MS = 700;
type Wanted = { session: string; name: string };
const trackKey = (track: Wanted) => `${track.session}/${track.name}`;

// The browser cleans the microphone before it is sent: no room noise, no echo, an even level. Less noise is also
// more silence, and silence is not sent (withDtx).
const MIC_CLEANUP = {
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
};
// The most that each kind of track sends. A voice is clear at 24 kbps; a 720p screen at 1.5 Mbps.
const MIC_MAX_BPS = 32_000,
  SCREEN_MAX_BPS = 2_500_000;
// The camera is taken at 720p for my own view and sent at half of that (360p), 24 frames a second, 500 kbps at
// most: each person in the call receives one copy of each camera, so this number is the cost of a camera.
// (The first numbers, 15 frames and 200 kbps, gave 180p in practice: people asked for more, 2026-11-24.)
export const CAM_CAPTURE = {
  width: { ideal: 1280 },
  height: { ideal: 720 },
  frameRate: { ideal: 30 },
};
const CAM_SEND = {
  maxBitrate: 500_000,
  scaleResolutionDownBy: 2,
  maxFramerate: 24,
};
/** Opus stops sending in silence (DTX) when the description of the other side asks for it: this adds the ask to
 * each Opus line that does not have it. */
export const withDtx = (sdp: string) =>
  sdp.replace(
    /^a=fmtp:(\d+) (.*useinbandfec=1.*)$/gm,
    (line: string, type: string, params: string) =>
      params.includes("usedtx") ? line : `a=fmtp:${type} ${params};usedtx=1`,
  );

/** Which tracks to start receiving and which to stop, from who is in the call and what this tab receives now. */
export function planTracks(
  peers: readonly CallPeer[],
  mySession: string,
  pulled: Iterable<string>,
  /** The one session whose screen is received (null: none). Not given: every screen. */
  screenFrom?: string | null,
  cams = true,
) {
  const wanted = new Map<string, Wanted>();
  for (const peer of peers)
    if (peer.session !== mySession)
      for (const name of peer.tracks) {
        if (
          name === "screen" &&
          screenFrom !== undefined &&
          peer.session !== screenFrom
        )
          continue;
        if (name === "cam" && !cams) continue;
        const track = { session: peer.session, name };
        wanted.set(trackKey(track), track);
      }
  const have = new Set(pulled);
  return {
    pull: [...wanted].filter(([key]) => !have.has(key)).map(([, t]) => t),
    drop: [...have].filter((key) => !wanted.has(key)),
  };
}

export function createCallSession(
  roomId: string,
  api: CallApi,
  send: SendRoomCommand,
  /** The thread that the person has open now. */
  thread: () => string,
) {
  const state = writable<CallView>(IDLE);
  const devices = writable<CallDevices>({
    inputs: [],
    outputs: [],
    mic: SYSTEM_DEVICE,
    speaker: SYSTEM_DEVICE,
    output: false,
  });
  let pc: RTCPeerConnection | null = null,
    session = "",
    mic: MediaStream | null = null,
    // What goes to the call in place of the microphone when the noise suppression is on, and the sender of it.
    denoiser: Denoiser | null = null,
    micSender: RTCRtpSender | null = null,
    screen: MediaStream | null = null,
    screenMid = "",
    cam: MediaStream | null = null,
    camMid = "",
    camStop: (() => void) | undefined,
    peers: CallPeer[] = [],
    usageTimer: ReturnType<typeof setInterval> | undefined,
    reported = 0,
    self = "",
    retryTimer: ReturnType<typeof setTimeout> | undefined,
    screenSent = 0,
    idleReports = 0,
    sound: AudioContext | null = null,
    speakTimer: ReturnType<typeof setInterval> | undefined,
    // Each teardown (a hang-up, a drop, a failure) starts a new epoch. A step of the SFU that was on its way when
    // the call ended belongs to the old one: what it does or fails afterwards is no error of the call (a hang-up
    // showed "A call falhou", 2026-11-25).
    epoch = 0,
    queue: Promise<unknown> = Promise.resolve(),
    // A change of the microphone's track (another device, the noise suppression on or off) waits for the one before.
    micQueue: Promise<unknown> = Promise.resolve(),
    // The system's microphone as the last device list had it: a new one (a headset plugged in) is taken again.
    systemMic = "";
  /** key → mid of what this tab receives; mid → whose track it is; mid → the element that plays it. */
  const pulled = new Map<string, string>(),
    owners = new Map<string, { email: string; key: string }>(),
    players = new Map<string, HTMLAudioElement>();
  /** One meter for each voice (a received track's mid, or "mic" for mine), and when each person was last heard. */
  const meters = new Map<
      string,
      { email: string; node: AnalyserNode; source: MediaStreamAudioSourceNode }
    >(),
    heard = new Map<string, number>();
  function listen(key: string, email: string, stream: MediaStream) {
    try {
      sound ??= new AudioContext();
      void sound.resume();
      const source = sound.createMediaStreamSource(stream),
        node = sound.createAnalyser();
      node.fftSize = 512;
      source.connect(node);
      meters.set(key, { email, node, source });
    } catch {
      // No meter: the call works, the speaking mark does not.
    }
  }
  function unlisten(key: string) {
    meters.get(key)?.source.disconnect();
    meters.delete(key);
  }
  function measure() {
    const samples = new Uint8Array(512),
      now = Date.now();
    for (const meter of meters.values()) {
      meter.node.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
      if (Math.sqrt(sum / samples.length) > SPEAK_LEVEL)
        heard.set(meter.email, now);
    }
    const speaking = [...heard]
      .filter(([, at]) => now - at < SPEAK_HOLD_MS)
      .map(([email]) => email);
    const before = get(state).speaking;
    if (
      speaking.length !== before.length ||
      speaking.some((email) => !before.includes(email))
    )
      patch({ speaking });
  }
  const patch = (next: Partial<CallView>) =>
    state.update((value) => ({ ...value, ...next }));
  // The SFU takes one change to a session at a time: every negotiation waits for the one before it.
  const enqueue = (job: () => Promise<void>) => {
    const at = epoch;
    return (queue = queue
      .then(() => (at === epoch ? job() : undefined))
      .catch((error) => {
        if (at !== epoch) return;
        console.error("call", error);
        if (pc) patch({ error: "failed" });
      }));
  };
  /** This session leaves the room's call on the server. The route names the session, so a newer one of mine (another
   *  tab) stays; without the route, the room's socket says it. */
  const leaveServer = (gone: string) =>
    void api.leave(roomId, gone).catch(() => send({ t: "call.leave" }));
  const wire = (type: "offer" | "answer") => ({
    type,
    sdp: pc?.localDescription?.sdp ?? "",
  });

  async function cleaned(microphone: MediaStream) {
    // No Web Audio (an old browser, the unit tests): the raw microphone goes.
    if (typeof AudioContext === "undefined") return null;
    try {
      return await (await import("./denoise")).denoise(microphone);
    } catch (error) {
      console.error("call noise suppression", error);
      return null;
    }
  }
  function teardown(error: CallView["error"] = "") {
    epoch++;
    denoiser?.stop();
    denoiser = null;
    micSender = null;
    clearInterval(usageTimer);
    clearInterval(speakTimer);
    clearTimeout(retryTimer);
    document.removeEventListener("visibilitychange", onVisibility);
    navigator.mediaDevices?.removeEventListener?.(
      "devicechange",
      onDeviceChange,
    );
    systemMic = "";
    screenSent = idleReports = 0;
    for (const key of [...meters.keys()]) unlisten(key);
    heard.clear();
    void sound?.close().catch(() => {});
    sound = null;
    for (const player of players.values()) player.srcObject = null;
    for (const stream of [mic, screen])
      stream?.getTracks().forEach((track) => track.stop());
    pc?.close();
    pc = null;
    camStop?.();
    camStop = undefined;
    mic = screen = cam = null;
    camMid = "";
    session = screenMid = "";
    reported = 0;
    pulled.clear();
    owners.clear();
    players.clear();
    state.set({ ...IDLE, error });
  }
  async function push(track: MediaStreamTrack, name: string) {
    // The connection of this call: a hang-up while the SFU answers closes it, and the steps after fail on it.
    const conn = pc;
    if (!conn) return "";
    const transceiver = conn.addTransceiver(track, { direction: "sendonly" });
    // The noise suppression switches the microphone's track on this sender.
    if (name === "mic") micSender = transceiver.sender;
    await conn.setLocalDescription(await conn.createOffer());
    const mid = transceiver.mid ?? "";
    const out = await api.tracks(roomId, {
      session,
      offer: wire("offer"),
      push: [{ mid, name }],
    });
    if (out === "limit" || !out.sessionDescription) {
      await conn.setLocalDescription({ type: "rollback" });
      return out === "limit" ? ("limit" as const) : "";
    }
    await conn.setRemoteDescription({
      type: out.sessionDescription.type,
      sdp: withDtx(out.sessionDescription.sdp),
    });
    // A ceiling for what this track sends. A browser that refuses it sends at its own rate.
    const sender = transceiver.sender,
      params = sender.getParameters();
    if (params.encodings[0]) {
      if (name === "cam") Object.assign(params.encodings[0], CAM_SEND);
      else
        params.encodings[0].maxBitrate =
          name === "mic" ? MIC_MAX_BPS : SCREEN_MAX_BPS;
      // With little bandwidth, a screen keeps its sharpness (text) and a camera keeps its motion.
      params.degradationPreference =
        name === "screen" ? "maintain-resolution" : "balanced";
      await sender.setParameters(params).catch(() => {});
    }
    return mid;
  }
  async function sync() {
    if (!pc) return;
    // To spare traffic, one screen is received at a time: the one chosen, else the first. None while this tab is
    // hidden, or while I look at my own screen.
    const sharers = peers.filter(
        (peer) => peer.session !== session && peer.tracks.includes("screen"),
      ),
      watching = get(state).watching,
      none =
        document.visibilityState === "hidden" ||
        (watching === self && !!screen),
      chosen = none
        ? null
        : ((sharers.find((peer) => peer.email === watching) ?? sharers[0])
            ?.session ?? null);
    // Cameras are received while this tab is on show, with a screen on the stage too (people asked to see the
    // faces while someone shares, 2026-11-24).
    const cams = document.visibilityState !== "hidden";
    const plan = planTracks(peers, session, pulled.keys(), chosen, cams);
    if (plan.drop.length) {
      const mids = plan.drop.flatMap((key) => pulled.get(key) ?? []);
      for (const key of plan.drop) pulled.delete(key);
      for (const mid of mids) {
        const player = players.get(mid);
        if (player) player.srcObject = null;
        players.delete(mid);
        unlisten(mid);
        const owner = owners.get(mid);
        if (owner?.key.endsWith("/screen"))
          state.update((value) => {
            const { [owner.email]: _gone, ...screens } = value.screens;
            return {
              ...value,
              screens,
              watching: value.watching === owner.email ? "" : value.watching,
            };
          });
        if (owner?.key.endsWith("/cam"))
          state.update((value) => {
            const { [owner.email]: _gone, ...cams } = value.cams;
            return { ...value, cams };
          });
        owners.delete(mid);
      }
      // The SFU refuses to close a track that its publisher already stopped: nothing is left to do.
      await api.close(roomId, session, mids).catch(() => {});
    }
    if (!plan.pull.length || !pc) return;
    const out = await api.tracks(roomId, { session, pull: plan.pull });
    if (out === "limit" || !pc) return;
    // A track with an error is not kept, so the next change in the call asks for it again.
    let failed = false;
    (out.tracks ?? []).forEach((track, index) => {
      const want = plan.pull[index];
      if (!want || !track.mid || track.errorCode) {
        failed = true;
        return;
      }
      const key = trackKey(want);
      pulled.set(key, track.mid);
      owners.set(track.mid, {
        key,
        email: peers.find((p) => p.session === want.session)?.email ?? "",
      });
    });
    if (out.requiresImmediateRenegotiation && out.sessionDescription) {
      await pc.setRemoteDescription(out.sessionDescription);
      await pc.setLocalDescription(await pc.createAnswer());
      await api.answer(roomId, session, wire("answer"));
    }
    if (failed) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void enqueue(sync), PULL_RETRY_MS);
    }
  }
  function received(event: RTCTrackEvent) {
    const mid = event.transceiver.mid ?? "",
      stream = new MediaStream([event.track]);
    const email = owners.get(mid)?.email ?? "";
    if (event.track.kind === "video") {
      const kind = owners.get(mid)?.key.endsWith("/cam") ? "cams" : "screens";
      state.update((value) => ({
        ...value,
        [kind]: { ...value[kind], [email]: stream },
      }));
      return;
    }
    const player = new Audio();
    player.srcObject = stream;
    player.muted = get(state).silenced.includes(email);
    void sink(player, get(devices).speaker);
    void player.play().catch(() => {});
    players.set(mid, player);
    listen(mid, email, stream);
  }
  /** The bytes this tab received since its last report, for the month's traffic budget (src/calls.ts). */
  async function reportUsage() {
    if (!pc) return;
    let total = 0,
      sent = 0;
    (await pc.getStats()).forEach(
      (stat: {
        type?: string;
        mid?: string;
        bytesReceived?: number;
        bytesSent?: number;
      }) => {
        if (stat.type === "inbound-rtp") total += stat.bytesReceived ?? 0;
        // Only the screen's own track: a camera that is on must not hide a screen that stands still.
        if (stat.type === "outbound-rtp" && screenMid && stat.mid === screenMid)
          sent += stat.bytesSent ?? 0;
      },
    );
    if (total > reported) send({ t: "call.usage", bytes: total - reported });
    reported = total;
    // My screen did not change for a long time: stop it, the others see a still picture for nothing.
    idleReports =
      get(state).sharing && sent - screenSent < SCREEN_IDLE_BYTES
        ? idleReports + 1
        : 0;
    screenSent = sent;
    if (idleReports >= SCREEN_IDLE_REPORTS) stopShare("idle");
  }
  function stopShare(notice: CallView["notice"] = "") {
    if (!get(state).sharing) return;
    const mid = screenMid;
    screen?.getTracks().forEach((track) => track.stop());
    screen = null;
    screenMid = "";
    idleReports = 0;
    patch({ sharing: false, own: null, notice });
    void enqueue(() => api.close(roomId, session, [mid], ["screen"]));
    void enqueue(sync);
  }
  const onVisibility = () => void enqueue(sync);

  const micStep = <T>(job: () => Promise<T>) => {
    const step = micQueue.then(job);
    micQueue = step.catch(() => {});
    return step;
  };
  /** Sends the call's sound of one person to an output. A browser without setSinkId plays it on the system's. */
  async function sink(player: HTMLAudioElement, id: string) {
    if (!canChooseOutput()) return true;
    try {
      await player.setSinkId(sinkId(id));
      return true;
    } catch {
      return false;
    }
  }
  async function useSpeaker(id: string) {
    devices.update((value) => ({ ...value, speaker: id }));
    const done = await Promise.all(
      [...players.values()].map((p) => sink(p, id)),
    );
    if (done.every(Boolean) || id === SYSTEM_DEVICE) return true;
    // The output went away while it was chosen: the system's plays everything.
    await useSpeaker(SYSTEM_DEVICE);
    return false;
  }
  /** Changes the microphone in the call: a new track of that device goes to the SFU in place of the old one, with
   *  the same cleanup, the same mute and the noise suppression if it is on. The old track stops. false: the device
   *  did not open, and the old microphone stays. */
  function useMic(id: string) {
    const at = epoch;
    return micStep(async () => {
      if (at !== epoch || !mic || !micSender) return false;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: micConstraints(MIC_CLEANUP, id, true),
        });
      } catch {
        return false;
      }
      const [track] = stream.getAudioTracks();
      const next = track && denoiser ? await cleaned(stream) : null;
      const sender = micSender;
      if (!track || at !== epoch || !sender || !mic) {
        next?.stop();
        stream.getTracks().forEach((one) => one.stop());
        return false;
      }
      track.enabled = !get(state).muted;
      try {
        await sender.replaceTrack(next?.track ?? track);
      } catch {
        next?.stop();
        stream.getTracks().forEach((one) => one.stop());
        return false;
      }
      denoiser?.stop();
      mic.getTracks().forEach((one) => one.stop());
      mic = stream;
      denoiser = next;
      watchMic(track);
      unlisten("mic");
      listen("mic", self, stream);
      devices.update((value) => ({ ...value, mic: id }));
      return true;
    });
  }
  /** A microphone that is unplugged ends its track: the call takes the device that is left. */
  function watchMic(track: MediaStreamTrack) {
    track.onended = () => {
      if (mic?.getAudioTracks()[0] === track) void refreshDevices(true);
    };
  }
  /** Reads the devices again. The call follows: a chosen device that went away gives the system's, and one that
   *  came back is used again. `ended`: the microphone in use stopped, so it is taken again. */
  async function refreshDevices(ended = false) {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    let list: MediaDeviceInfo[];
    try {
      list = await navigator.mediaDevices.enumerateDevices();
    } catch {
      return;
    }
    const inputs = audioDevices(list, "audioinput"),
      outputs = audioDevices(list, "audiooutput"),
      output = canChooseOutput(),
      wantMic = chosenDevice(inputs, storedDevice("audioinput")),
      wantSpeaker = output
        ? chosenDevice(outputs, storedDevice("audiooutput"))
        : SYSTEM_DEVICE,
      system = systemDeviceKey(list, "audioinput"),
      now = get(devices);
    const newSystem =
      wantMic === SYSTEM_DEVICE &&
      !!systemMic &&
      !!system &&
      system !== systemMic;
    systemMic = system;
    devices.update((value) => ({ ...value, inputs, outputs, output }));
    if (get(state).phase !== "in") return;
    if (ended || newSystem || wantMic !== now.mic)
      void useMic(wantMic).then((done) => {
        // The chosen one did not open after the old one stopped: the system's, so the call still hears me.
        if (!done && ended && wantMic !== SYSTEM_DEVICE)
          void useMic(SYSTEM_DEVICE);
      });
    if (wantSpeaker !== now.speaker) void useSpeaker(wantSpeaker);
  }
  const onDeviceChange = () => void refreshDevices();

  return {
    state: { subscribe: state.subscribe },
    /** The room's word on who is in the call. Missing from it while in the call = this tab was dropped. */
    /** `me`: who I am (my own mark in the list). Hearing that a call is on never joins this tab: only a click
     *  (Entrar na call, Iniciar call, Atender) does. A room that joined by itself kept every visitor in its call once
     *  the call outlived the room's view (hub.ts): Viktor, 2026-11-25, "everybody joined every call". */
    setPeers(next: readonly CallPeer[] | undefined, me = "") {
      // The recorder (shared/call.ts) is in the list, and is not a person: nobody receives its tracks, and it
      // does not count as company.
      const all = [...(next ?? [])];
      peers = all.filter((peer) => !isRecorder(peer.email));
      self = me || self;
      if (get(state).phase !== "in") return;
      if (!all.some((peer) => peer.session === session)) teardown("dropped");
      else {
        // Nobody is left to see my screen.
        if (peers.length < 2) stopShare("alone");
        void enqueue(sync);
      }
    },
    join(muted = false) {
      if (get(state).phase !== "idle") return;
      state.set({ ...IDLE, phase: "joining", muted });
      // Asked for inside the click, before any await: browsers want the gesture.
      // The microphone chosen on this device, if it is there; else the browser's own.
      const wanted = storedDevice("audioinput");
      const media = navigator.mediaDevices.getUserMedia({
        audio: micConstraints(MIC_CLEANUP, wanted, false),
      });
      const at = epoch;
      let joined = "";
      void (async () => {
        let stream: MediaStream;
        try {
          stream = await media;
        } catch {
          if (at === epoch) teardown("mic");
          return;
        }
        // Hung up before the microphone came.
        if (at !== epoch) return stream.getTracks().forEach((t) => t.stop());
        mic = stream;
        try {
          joined = await api.join(roomId, thread());
          // Hung up while the room let me in: that session leaves at once, the room does not keep me in the call.
          if (at !== epoch) return leaveServer(joined);
          session = joined;
          // ponytail: STUN only. A network that blocks UDP needs Cloudflare TURN credentials here.
          pc = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
            bundlePolicy: "max-bundle",
          });
          pc.ontrack = received;
          const [track] = mic.getAudioTracks();
          if (track) track.enabled = !muted;
          if (track) watchMic(track);
          // The browser can give another microphone than the one asked for (it is not plugged in): the system's.
          devices.update((value) => ({
            ...value,
            mic:
              wanted !== SYSTEM_DEVICE &&
              track?.getSettings().deviceId === wanted
                ? wanted
                : SYSTEM_DEVICE,
            speaker: SYSTEM_DEVICE,
          }));
          // The call gets the cleaned microphone; the raw one stays for mute and for the speaking mark. If the
          // cleaning does not start (an old browser), the raw microphone goes.
          if (track && get(denoiseOn)) denoiser = await cleaned(mic);
          if (at !== epoch) return leaveServer(joined);
          const mid = track ? await push(denoiser?.track ?? track, "mic") : "";
          if (at !== epoch) return leaveServer(joined);
          if (!mid) return teardown("failed");
          usageTimer = setInterval(() => void reportUsage(), USAGE_MS);
          listen("mic", self, mic);
          speakTimer = setInterval(measure, SPEAK_MS);
          document.addEventListener("visibilitychange", onVisibility);
          navigator.mediaDevices.addEventListener?.(
            "devicechange",
            onDeviceChange,
          );
          patch({ phase: "in" });
          // Now with the labels (the microphone is allowed): the lists, and the output chosen on this device.
          void refreshDevices();
          send({ t: "call.mute", muted });
          void enqueue(sync);
        } catch (error) {
          if (at !== epoch) {
            if (joined) leaveServer(joined);
            return;
          }
          console.error("call", error);
          teardown("failed");
        }
      })();
    },
    leave() {
      if (get(state).phase === "idle") return;
      // Still joining with no session yet: the join, when the room answers, leaves that session (join).
      if (session) leaveServer(session);
      teardown();
    },
    /** Noise suppression on or off: in the call now, and in the next calls on this device. */
    async toggleDenoise() {
      const on = !get(denoiseOn);
      denoiseOn.set(on);
      try {
        localStorage.setItem(DENOISE_KEY, on ? "1" : "0");
      } catch {
        // Private mode: it lasts until the page closes.
      }
      await micStep(async () => {
        const [track] = mic?.getAudioTracks() ?? [];
        if (!micSender || !mic || !track) return;
        if (on && !denoiser) denoiser = await cleaned(mic);
        await micSender
          ?.replaceTrack(on && denoiser ? denoiser.track : track)
          .catch(() => {});
        if (!on) {
          denoiser?.stop();
          denoiser = null;
        }
      });
    },
    /** The devices of this machine and the ones in use (the stage's menu). */
    devices: { subscribe: devices.subscribe },
    /** Reads the devices again (the menu opens: a device may be new). */
    refreshDevices() {
      void refreshDevices();
    },
    /** Another microphone, in the call now and in the next calls on this device. false: it did not open. */
    async chooseMic(id: string) {
      storeDevice("audioinput", id);
      if (get(state).phase !== "in") {
        devices.update((value) => ({ ...value, mic: id }));
        return true;
      }
      return useMic(id);
    },
    /** Another output for the call's sound, now and in the next calls on this device. false: it did not play. */
    async chooseSpeaker(id: string) {
      storeDevice("audiooutput", id);
      const done = await useSpeaker(id);
      if (!done) storeDevice("audiooutput", SYSTEM_DEVICE);
      return done;
    },
    /** Silence a person for me only ("Silenciar pra mim"), or hear them again. Their microphone stays on for the
     *  others: only this tab stops playing their voice. */
    toggleSilence(email: string) {
      if (get(state).phase === "idle") return;
      const now = get(state).silenced,
        on = !now.includes(email);
      for (const [mid, player] of players)
        if (owners.get(mid)?.email === email) player.muted = on;
      patch({
        silenced: on ? [...now, email] : now.filter((one) => one !== email),
      });
    },
    toggleMute() {
      const muted = !get(state).muted;
      const [track] = mic?.getAudioTracks() ?? [];
      if (track) track.enabled = !muted;
      // Off = a track that is disabled. It gives silence, and silence is not sent (withDtx). The sender keeps its
      // track: the SFU refuses to give the others a track that never sent anything (empty_track_error).
      patch({ muted });
      send({ t: "call.mute", muted });
    },
    share() {
      if (get(state).phase !== "in" || get(state).sharing) return;
      // A screen is for someone to see: alone in the call, there is no share.
      if (peers.length < 2) return patch({ notice: "alone" });
      patch({ notice: "" });
      const media = navigator.mediaDevices.getDisplayMedia({
        video: SCREEN_LIMITS,
      });
      void enqueue(async () => {
        let stream: MediaStream;
        try {
          stream = await media;
        } catch {
          return; // the person closed the picker
        }
        const [track] = stream.getVideoTracks();
        const mid = track ? await push(track, "screen") : "";
        if (!track || !mid || mid === "limit") {
          stream.getTracks().forEach((t) => t.stop());
          if (mid === "limit") patch({ limit: true });
          return;
        }
        screen = stream;
        screenMid = mid;
        // The browser's own "stop sharing" button.
        track.onended = () => stopShare();
        // Text first: the browser keeps the picture sharp and sends fewer frames.
        track.contentHint = "detail";
        patch({ sharing: true, own: stream });
        await sync();
      });
    },
    stopShare() {
      stopShare();
    },
    /** My camera, as the person confirmed it (CameraDialog): the stream to send, and what stops it. */
    startCamera(stream: MediaStream, stop: () => void) {
      if (get(state).phase !== "in" || get(state).camera) return stop();
      void enqueue(async () => {
        const [track] = stream.getVideoTracks();
        const mid = track ? await push(track, "cam") : "";
        if (!track || !mid || mid === "limit") return stop();
        cam = stream;
        camStop = stop;
        camMid = mid;
        patch({ camera: true, ownCam: stream });
      });
    },
    stopCamera() {
      if (!get(state).camera) return;
      const mid = camMid;
      camStop?.();
      cam = null;
      camStop = undefined;
      camMid = "";
      patch({ camera: false, ownCam: null });
      void enqueue(() => api.close(roomId, session, [mid], ["cam"]));
    },
    /** Choose whose screen to see. Only that one is received. */
    watch(email: string) {
      patch({ watching: email });
      void enqueue(sync);
    },
    dismissLimit() {
      patch({ limit: false });
    },
  };
}
export type CallSession = ReturnType<typeof createCallSession>;
