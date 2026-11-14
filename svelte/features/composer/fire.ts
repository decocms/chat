import { get, writable, readonly } from "svelte/store";
import type { Room } from "../../../shared/room";
import { STT_AUDIO_MAX } from "../../../shared/schemas";
import { MESSAGE_TEXT_LIMIT } from "../../../shared/composition";
import { matchingMessage, maxMessageId, type MessageSnapshot } from "./model";
import type { RequestRoomCommand } from "../../roomConnection";
import type { ComposerFirePort } from "./fireTypes";
import type { FireCapture, FireCaptureFactory } from "./fireAudio";
import type { SpeechClock, SpeechFactory, SpeechRecognizer } from "./speech";
import { definiteMessageFailure } from "./drafts";
import { createFireSegmentation } from "./fireSegmentation";
import { FireFailure } from "./fireApi";
import { createAgentLease } from "../agents/lease";

export type FireState = {
  session: number;
  intent: number;
  phase: "idle" | "switching" | "ready" | "failed" | "leaving";
  talking: boolean;
  locked: boolean;
  sending: "none" | "transcribing" | "message" | "unconfirmed";
  model: string;
  note: string;
  text: string;
  sent: string;
  error:
    | ""
    | "unsupported"
    | "permission"
    | "recording"
    | "empty"
    | "switch"
    | "restore"
    | "send-refused"
    | "unconfirmed";
};
export const initialFireState = (): FireState => ({
  session: 0,
  intent: 0,
  phase: "idle",
  talking: false,
  locked: false,
  sending: "none",
  model: "",
  note: "",
  text: "",
  sent: "",
  error: "",
});
/** Browser recognition is preview only. The authoritative utterance comes from
 * Whisper on release, falling back to the owned preview like the upstream app. */
function preview(event: unknown): string | null {
  if (
    typeof event !== "object" ||
    !event ||
    !("results" in event) ||
    typeof event.results !== "object" ||
    !event.results
  )
    return null;
  const length: unknown = Reflect.get(event.results, "length");
  if (
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < 0 ||
    length > 512
  )
    return null;
  let text = "";
  for (let i = 0; i < length; i++) {
    const row: unknown = Reflect.get(event.results, String(i));
    if (typeof row !== "object" || !row) return null;
    const first: unknown = Reflect.get(row, "0");
    if (typeof first !== "object" || !first) return null;
    const value: unknown = Reflect.get(first, "transcript");
    if (typeof value !== "string" || (text += value).length > 65536)
      return null;
  }
  return text.trim();
}
export function createFireController(options: {
  roomId: string;
  thread: string;
  room(): Room;
  locale: string;
  capture?: FireCaptureFactory;
  factory?: SpeechFactory;
  clock: SpeechClock & { now?(): number };
  request: RequestRoomCommand;
  port: ComposerFirePort;
}) {
  const account = options.room().me;
  const state = writable(initialFireState());
  const clock = {
      ...options.clock,
      now: () => options.clock.now?.() ?? Date.now(),
    },
    modeLease = createAgentLease(clock),
    audioLease = createAgentLease(clock),
    sttLease = createAgentLease(clock),
    messageLease = createAgentLease(clock);
  let active = true,
    session = 0,
    utterance = 0,
    intent = 0,
    capture: FireCapture | null = null,
    sr: SpeechRecognizer | null = null,
    currentSaid = "";
  let releaseRequested = false,
    stopLevel: (() => void) | null = null,
    restoreTimer: unknown,
    deliveryTimer: unknown;
  const ending = new Map<FireCapture, { said: string; timer: unknown }>();
  const segments: { blob: Blob; said: string; ticket: number }[] = [];
  let segmentBytes = 0,
    processing = 0,
    nextProcess = 0,
    workGeneration = 0;
  const segmentCurrent = (ticket: number, opened: FireCapture) =>
    current(ticket) && (capture === opened || ending.has(opened));
  function stopLevels() {
    const stop = stopLevel;
    stopLevel = null;
    try {
      stop?.();
    } catch {}
  }
  function clearSegments() {
    workGeneration++;
    processing = 0;
    segments.length = 0;
    segmentBytes = 0;
  }
  function drain() {
    if (
      processing ||
      pending ||
      !segments.length ||
      !owned() ||
      get(state).error === "send-refused" ||
      get(state).sending === "unconfirmed" ||
      get(state).phase === "leaving"
    )
      return;
    const next = segments.shift()!;
    segmentBytes -= next.blob.size;
    if (!current(next.ticket)) return;
    const job = ++nextProcess;
    processing = job;
    void transcribe(next.blob, next.said, next.ticket).finally(() => {
      if (processing !== job) return;
      processing = 0;
      drain();
    });
  }
  function enqueue(blob: Blob, said: string, ticket: number) {
    if (
      !current(ticket) ||
      blob.size < 2000 ||
      get(state).sending === "unconfirmed" ||
      get(state).error === "send-refused"
    )
      return;
    // Bound retained, unsent audio while an ACK/provider is slow. Never drop a
    // sent uncertainty marker or replay a segment that may have been accepted.
    if (segments.length >= 8 || segmentBytes + blob.size > STT_AUDIO_MAX * 2) {
      state.update((value) => ({
        ...value,
        locked: false,
        error: "recording",
      }));
      stopLevels();
      release();
      return;
    }
    segments.push({ blob, said, ticket });
    segmentBytes += blob.size;
    drain();
  }
  let pending: { snapshot: MessageSnapshot; ack: boolean } | null = null;
  const owned = () => {
    const room = options.room();
    return (
      active &&
      options.port.current() &&
      room.id === options.roomId &&
      room.me === account &&
      room.members.includes(account) &&
      (options.thread === "main" ||
        room.epics.some((epic) => epic.id === options.thread))
    );
  };
  const current = (ticket: number) => owned() && ticket === session;
  const recording = (ticket: number, take: number) =>
    current(ticket) && take === utterance;
  function clearTimer(which: "restore" | "delivery") {
    const value = which === "restore" ? restoreTimer : deliveryTimer;
    if (value !== undefined) options.clock.cancel(value);
    if (which === "restore") restoreTimer = undefined;
    else deliveryTimer = undefined;
  }
  function releaseAudio() {
    const stopped = [...ending];
    ending.clear();
    const previous = capture;
    capture = null;
    const recognition = sr;
    sr = null;
    stopLevels();
    // The factory revokes its epoch before any native stop callbacks and stops
    // the actual stream even if a getUserMedia or resume promise ignores abort.
    try {
      options.capture?.release?.();
    } catch {}
    for (const [opened, value] of stopped) {
      options.clock.cancel(value.timer);
      try {
        opened.dispose();
      } catch {}
    }
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      try {
        recognition.abort();
      } catch {}
    }
    try {
      previous?.dispose();
    } catch {}
  }
  function releaseIdleStream() {
    if (!capture && !ending.size && !get(state).talking && !get(state).locked) {
      try {
        options.capture?.release?.();
      } catch {}
    }
  }
  function haltCapture() {
    utterance++;
    releaseRequested = true;
    audioLease.cancel();
    releaseAudio();
    if (owned())
      state.update((value) => ({
        ...value,
        talking: false,
        locked: false,
        error: "recording",
      }));
  }
  function failure(error: unknown) {
    if (error instanceof FireFailure) {
      if (error.unauthenticated) options.port.sessionLost();
      else if (error.membershipDenied) options.port.denyMembership();
    }
  }
  function settle() {
    if (!owned() || !pending?.ack) return;
    if (!matchingMessage(options.room(), options.thread, pending.snapshot))
      return;
    const text = pending.snapshot.text;
    pending = null;
    clearTimer("delivery");
    state.update((value) => ({
      ...value,
      sending: "none",
      text: "",
      sent: text,
      error: "",
    }));
    if (owned()) drain();
  }
  async function post(text: string, ticket: number) {
    if (!current(ticket) || pending) return;
    const snapshot: MessageSnapshot = {
      text: text.trim().slice(0, MESSAGE_TEXT_LIMIT),
      fileIds: [],
      baseline: maxMessageId(options.room()),
      revision: 0,
    };
    if (!snapshot.text) {
      state.update((value) => ({ ...value, sending: "none", error: "empty" }));
      return;
    }
    const operation = { snapshot, ack: false };
    pending = operation;
    state.update((value) => ({
      ...value,
      sending: "message",
      text: snapshot.text,
      error: "",
      intent: ++intent,
    }));
    if (!current(ticket) || pending !== operation) return;
    try {
      const result = await messageLease.run(() => {
        if (!current(ticket) || pending !== operation)
          throw Error("Released Fire message");
        return options.request({
          t: "msg",
          text: snapshot.text,
          thread: options.thread,
        });
      }, 20000);
      if (!current(ticket) || pending !== operation) return;
      if (!result.ok) {
        if (definiteMessageFailure(result.error)) {
          pending = null;
          state.update((value) => ({
            ...value,
            sending: "none",
            error: "send-refused",
            text: snapshot.text,
          }));
          if (get(state).locked) {
            state.update((value) => ({ ...value, locked: false }));
            release();
          }
          return;
        }
        // Timeout/disconnect may already have written. No automatic resend.
        state.update((value) => ({
          ...value,
          sending: "unconfirmed",
          error: "unconfirmed",
          text: snapshot.text,
          locked: false,
        }));
        release();
        return;
      }
      operation.ack = true;
      settle();
      if (pending !== operation) return;
      deliveryTimer = options.clock.schedule(() => {
        if (current(ticket) && pending === operation) {
          state.update((value) => ({
            ...value,
            sending: "unconfirmed",
            error: "unconfirmed",
            text: snapshot.text,
            locked: false,
          }));
          release();
        }
      }, 20000);
    } catch {
      if (current(ticket) && pending === operation) {
        settle();
        if (pending === operation) {
          state.update((value) => ({
            ...value,
            sending: "unconfirmed",
            error: "unconfirmed",
            text: snapshot.text,
            locked: false,
          }));
          release();
        }
      }
    }
  }
  async function transcribe(blob: Blob, said: string, ticket: number) {
    const generation = workGeneration;
    const ownsWork = () => current(ticket) && generation === workGeneration;
    if (!ownsWork()) return;
    state.update((value) => ({
      ...value,
      sending: "transcribing",
    }));
    if (!ownsWork()) return;
    const room = options.room();
    const prompt =
      `Conversa no vibebook (vibebook.dev), sala ${room.book?.title ?? ""}. Pessoas: ${room.members.map((email) => email.split("@")[0]).join(", ")}. Épicos: ${room.epics
        .filter((epic) => !epic.archived)
        .slice(0, 15)
        .map((epic) => epic.title)
        .join("; ")}.`.slice(0, 600);
    let text = "";
    try {
      text = await sttLease.run(
        (signal) =>
          options.port.transcribe(
            blob,
            { lang: options.locale.startsWith("en") ? "en" : "pt", prompt },
            signal,
          ),
        45000,
      );
    } catch (error) {
      if (ownsWork()) failure(error);
    }
    if (!ownsWork()) return;
    await post((text || said).trim(), ticket);
  }
  function release() {
    if (!owned() || !get(state).talking) return;
    const ticket = session,
      take = utterance;
    releaseRequested = true;
    stopLevels();
    const currentCapture = capture;
    capture = null;
    const said = currentSaid;
    const recognition = sr;
    sr = null;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      try {
        recognition.abort();
      } catch {}
    }
    state.update((value) => ({ ...value, talking: false }));
    if (!currentCapture) {
      releaseIdleStream();
      return;
    }
    if (
      !recording(ticket, take) ||
      get(state).phase === "leaving" ||
      get(state).phase === "idle"
    ) {
      currentCapture.dispose();
      return;
    }
    const timer = options.clock.schedule(() => {
      if (!ending.has(currentCapture)) return;
      if (current(ticket)) haltCapture();
      else {
        ending.delete(currentCapture);
        currentCapture.dispose();
        releaseIdleStream();
      }
    }, 20000);
    ending.set(currentCapture, { said, timer });
    try {
      currentCapture.stop();
    } catch {
      const stopped = ending.get(currentCapture);
      ending.delete(currentCapture);
      if (stopped) options.clock.cancel(stopped.timer);
      currentCapture.dispose();
      if (current(ticket)) haltCapture();
      else releaseIdleStream();
    }
    if (current(ticket) && get(state).locked) {
      if (ending.size >= 8)
        state.update((value) => ({
          ...value,
          locked: false,
          error: "recording",
        }));
      else void hold();
    }
  }
  function startPreview(ticket: number, take: number) {
    if (!options.factory) return;
    try {
      const recognition = options.factory();
      sr = recognition;
      recognition.lang = options.locale;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        if (
          !recording(ticket, take) ||
          sr !== recognition ||
          !get(state).talking
        )
          return;
        const text = preview(event);
        if (text !== null) {
          currentSaid = text;
          state.update((value) => ({ ...value, text }));
        }
      };
      recognition.onerror = () => {};
      recognition.onend = () => {};
      recognition.start();
    } catch {
      /* Recognition is optional preview; recording/Whisper remain authoritative. */
    }
  }
  function attachLevels(opened: FireCapture, ticket: number, take: number) {
    if (
      !recording(ticket, take) ||
      capture !== opened ||
      !get(state).locked ||
      stopLevel
    )
      return;
    const segmenter = createFireSegmentation(clock.now());
    try {
      if (!opened.observeLevel) throw Error("Microphone level unavailable");
      const stop = opened.observeLevel(
        (level) => {
          if (
            recording(ticket, take) &&
            capture === opened &&
            get(state).locked &&
            segmenter.sample(level, clock.now())
          )
            release();
        },
        () => {
          if (recording(ticket, take) && capture === opened) haltCapture();
        },
      );
      if (!recording(ticket, take) || capture !== opened) stop();
      else stopLevel = stop;
    } catch {
      if (recording(ticket, take) && capture === opened) haltCapture();
    }
  }
  async function hold() {
    if (
      !owned() ||
      (!get(state).locked && !!pending) ||
      get(state).talking ||
      (!get(state).locked && get(state).sending !== "none") ||
      get(state).phase === "leaving" ||
      get(state).error === "send-refused"
    )
      return;
    const factory = options.capture;
    if (!factory) {
      state.update((value) => ({ ...value, error: "unsupported" }));
      return;
    }
    if (get(state).phase === "idle") {
      session++;
      const ticket = session;
      state.set({
        ...initialFireState(),
        session,
        phase: "switching",
        locked: get(state).locked,
      });
      if (
        !current(ticket) ||
        get(state).phase === "leaving" ||
        get(state).phase === "idle"
      )
        return;
      void modeLease
        .run((signal) => {
          if (
            !current(ticket) ||
            get(state).phase === "leaving" ||
            get(state).phase === "idle"
          )
            throw Error("Released Fire switch");
          return options.port.set(true, signal);
        }, 20000)
        .catch((error) => {
          if (current(ticket) && get(state).phase === "switching") {
            failure(error);
            if (current(ticket))
              state.update((value) => ({
                ...value,
                phase: "failed",
                error: "switch",
              }));
          }
        });
    }
    const ticket = session,
      take = ++utterance;
    releaseRequested = false;
    currentSaid = "";
    state.update((value) => ({
      ...value,
      talking: true,
      text: "",
      sent: "",
      error: "",
    }));
    if (!recording(ticket, take)) return;
    try {
      const opened = await audioLease.run(
        () =>
          factory().then((value) => {
            if (!recording(ticket, take) || releaseRequested) {
              value.dispose();
              throw Error("Released audio permission");
            }
            return value;
          }),
        20000,
      );
      if (!recording(ticket, take) || releaseRequested) {
        opened.dispose();
        return;
      }
      capture = opened;
      const chunks: Blob[] = [];
      let size = 0;
      opened.start(
        (chunk) => {
          if (!segmentCurrent(ticket, opened)) return;
          if ((size += chunk.size) > STT_AUDIO_MAX) {
            utterance++;
            releaseAudio();
            state.update((value) => ({
              ...value,
              talking: false,
              locked: false,
              error: "recording",
            }));
            return;
          }
          chunks.push(chunk);
        },
        () => {
          if (!segmentCurrent(ticket, opened)) return;
          const retired = ending.get(opened);
          if (!retired) {
            releaseAudio();
            state.update((value) => ({
              ...value,
              talking: false,
              locked: false,
              error: "recording",
            }));
            return;
          }
          ending.delete(opened);
          options.clock.cancel(retired.timer);
          const blob = new Blob(chunks, { type: opened.type });
          try {
            opened.dispose();
          } finally {
            releaseIdleStream();
          }
          enqueue(blob, retired.said, ticket);
        },
        () => {
          if (segmentCurrent(ticket, opened)) haltCapture();
        },
      );
      if (recording(ticket, take) && !releaseRequested) {
        startPreview(ticket, take);
        if (get(state).locked) attachLevels(opened, ticket, take);
      }
    } catch {
      if (recording(ticket, take)) {
        utterance++;
        releaseAudio();
        state.update((value) => ({
          ...value,
          talking: false,
          locked: false,
          error: releaseRequested ? "" : "permission",
        }));
      }
    }
  }
  function suspend() {
    if (
      !capture &&
      ending.size === 0 &&
      segments.length === 0 &&
      !get(state).talking &&
      get(state).sending !== "transcribing"
    )
      return;
    utterance++;
    clearSegments();
    stopLevels();
    state.update((value) => ({ ...value, locked: false }));
    releaseRequested = true;
    audioLease.cancel();
    sttLease.cancel();
    releaseAudio();
    state.update((value) => ({
      ...value,
      talking: false,
      sending: value.sending === "transcribing" ? "none" : value.sending,
      text: "",
    }));
  }
  let restoring = false;
  function restore() {
    if (restoring) return;
    restoring = true;
    const controller = new AbortController();
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      restoring = false;
      options.clock.cancel(timer);
      if (error && owned() && get(state).phase === "leaving") {
        failure(error);
        if (owned()) state.update((value) => ({ ...value, error: "restore" }));
      }
    };
    const timer = options.clock.schedule(() => {
      controller.abort();
      finish(Error("Unconfirmed Fire restoration"));
    }, 20000);
    try {
      void options.port.restore(controller.signal).then(
        () => finish(),
        (error) => finish(error),
      );
    } catch (error) {
      finish(error);
    }
  }
  function stop() {
    if (!owned() || get(state).phase === "idle") return;
    const ticket = session;
    utterance++;
    clearSegments();
    releaseRequested = true;
    modeLease.cancel();
    audioLease.cancel();
    sttLease.cancel();
    releaseAudio();
    state.update((value) => ({
      ...value,
      phase: "leaving",
      talking: false,
      locked: false,
      sending: pending ? value.sending : "none",
      text: pending ? value.text : "",
      error: "",
    }));
    if (!current(ticket)) return;
    restore();
    clearTimer("restore");
    restoreTimer = options.clock.schedule(() => {
      if (current(ticket) && get(state).phase === "leaving")
        state.update((value) => ({ ...value, error: "restore" }));
    }, 30000);
  }
  const unwatch = options.port.watch((report) => {
    if (
      !owned() ||
      report.book !== options.roomId ||
      get(state).phase === "idle"
    )
      return;
    if (report.state === "off") {
      utterance++;
      clearSegments();
      state.update((value) => ({ ...value, locked: false }));
      modeLease.cancel();
      audioLease.cancel();
      sttLease.cancel();
      releaseAudio();
      clearTimer("restore");
      state.update((value) => ({
        ...value,
        phase: "idle",
        talking: false,
        sending: pending ? value.sending : "none",
        model: "",
        note: "",
        text: pending ? value.text : "",
        error: pending ? value.error : "",
      }));
    } else if (
      get(state).phase !== "leaving" &&
      (report.state === "switching" ||
        report.state === "ready" ||
        report.state === "failed")
    ) {
      const phase = report.state;
      state.update((value) => ({
        ...value,
        phase,
        model: report.model ?? value.model,
        note: report.note ?? "",
      }));
    }
  });
  function cancel() {
    if (get(state).phase !== "idle") restore();
    session++;
    utterance++;
    clearSegments();
    releaseRequested = true;
    modeLease.cancel();
    audioLease.cancel();
    sttLease.cancel();
    messageLease.cancel();
    releaseAudio();
    clearTimer("restore");
    clearTimer("delivery");
    pending = null;
    state.set({ ...initialFireState(), session });
  }
  const detachLeaving = options.port.beforeLeave(cancel);
  return {
    state: readonly(state),
    supported: !!options.capture,
    hold,
    start: hold,
    lock() {
      if (
        !owned() ||
        get(state).phase === "leaving" ||
        get(state).sending === "unconfirmed" ||
        get(state).error === "send-refused"
      )
        return;
      const ticket = session,
        take = utterance,
        opened = capture;
      state.update((value) => ({ ...value, locked: true }));
      if (!recording(ticket, take) || !get(state).locked) return;
      if (get(state).talking) {
        if (opened && capture === opened) attachLevels(opened, ticket, take);
      } else void hold();
    },
    unlock() {
      if (!owned() || !get(state).locked) return;
      state.update((value) => ({ ...value, locked: false }));
      if (owned()) release();
    },
    release,
    stop,
    suspend,
    toggle() {
      if (get(state).locked) {
        state.update((value) => ({ ...value, locked: false }));
        release();
      } else if (get(state).talking) release();
      else void hold();
    },
    retry(expected: number) {
      if (
        owned() &&
        get(state).intent === expected &&
        get(state).error === "send-refused"
      )
        void post(get(state).text, session);
    },
    discard(expected: number) {
      if (!owned() || get(state).intent !== expected) return;
      clearSegments();
      utterance++;
      releaseRequested = true;
      audioLease.cancel();
      sttLease.cancel();
      releaseAudio();
      messageLease.cancel();
      pending = null;
      clearTimer("delivery");
      state.update((value) => ({
        ...value,
        sending: "none",
        talking: false,
        locked: false,
        text: "",
        error: "",
        intent: ++intent,
      }));
    },
    live: () => get(state).phase !== "idle",
    owns: (ticket: number) => current(ticket),
    sync() {
      if (!owned()) cancel();
      else settle();
    },
    cancel,
    dispose() {
      if (!active) return;
      cancel();
      active = false;
      unwatch();
      detachLeaving();
    },
  };
}
