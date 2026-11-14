import { get, writable, readonly } from "svelte/store";
import type { FireBody } from "../../../shared/schemas";
import type { Room } from "../../../shared/room";
import { MESSAGE_TEXT_LIMIT } from "../../../shared/composition";
import { matchingMessage, maxMessageId, type MessageSnapshot } from "./model";
import type { RequestRoomCommand } from "../../roomConnection";
import type { ComposerFirePort, FireFile } from "./fireTypes";
import type { SpeechClock, SpeechFactory, SpeechRecognizer } from "./speech";
import { FireFailure } from "./fireApi";
import { createAgentLease, AgentLeaseFailure } from "../agents/lease";
import { record } from "../../../shared/validation";
export type FirePhase =
  | "idle"
  | "live"
  | "stopping"
  | "unconfirmed"
  | "review-pending"
  | "review-unconfirmed"
  | "complete";
export type FireState = {
  session: number;
  phase: FirePhase;
  busy: boolean;
  interim: string;
  applied: number;
  lastText: string;
  error: "" | "speech" | "not-allowed" | "request" | "unconfirmed";
  cardId: number | null;
};
export const initialFireState = (): FireState => ({
  session: 0,
  phase: "idle",
  busy: false,
  interim: "",
  applied: 0,
  lastText: "",
  error: "",
  cardId: null,
});
/** Browser result collections are array-like, not Arrays; parse only the needed values. */
export function fireSpeechPieces(event: unknown) {
  if (
    !record(event) ||
    typeof event.results !== "object" ||
    event.results === null
  )
    return null;
  const length: unknown = Reflect.get(event.results, "length"),
    start: unknown = event.resultIndex;
  if (
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < 0 ||
    length > 512 ||
    typeof start !== "number" ||
    !Number.isInteger(start) ||
    start < 0 ||
    start > length
  )
    return null;
  const rows: { text: string; final: boolean }[] = [];
  let chars = 0;
  for (let index = 0; index < length; index++) {
    const row: unknown = Reflect.get(event.results, String(index));
    if (typeof row !== "object" || row === null) return null;
    const first: unknown = Reflect.get(row, "0"),
      final: unknown = Reflect.get(row, "isFinal");
    if (
      !record(first) ||
      typeof first.transcript !== "string" ||
      typeof final !== "boolean" ||
      (chars += first.transcript.length) > 65536
    )
      return null;
    rows.push({ text: first.transcript, final });
  }
  return { start, rows };
}
export function createFireController(options: {
  roomId: string;
  thread: string;
  room: () => Room;
  locale: string;
  port: ComposerFirePort;
  factory?: SpeechFactory;
  clock: SpeechClock;
  request: RequestRoomCommand;
  reviewText: (
    chunks: readonly string[],
    file: FireFile | null,
    cardId: number | null,
  ) => string;
}) {
  const account = options.room().me;
  const state = writable<FireState>(initialFireState()),
    lease = createAgentLease({ ...options.clock, now: () => Date.now() }),
    reviewLease = createAgentLease({ ...options.clock, now: () => Date.now() });
  let active = true,
    generation = 0,
    rec: SpeechRecognizer | undefined,
    pending = "",
    chunks: string[] = [],
    file: FireFile | null = null,
    cardId: number | null = null,
    restart: unknown,
    stable: unknown,
    working = false,
    reviewSnapshot: MessageSnapshot | null = null,
    reviewAck = false,
    reviewTimer: unknown;
  const current = (ticket = generation) => {
    const room = options.room();
    return (
      active &&
      ticket === generation &&
      options.port.current() &&
      room.id === options.roomId &&
      room.me === account &&
      room.members.includes(account) &&
      (options.thread === "main" ||
        room.epics.some((epic) => epic.id === options.thread))
    );
  };
  const clear = (kind: "restart" | "stable") => {
    const handle = kind === "restart" ? restart : stable;
    if (handle !== undefined) options.clock.cancel(handle);
    if (kind === "restart") restart = undefined;
    else stable = undefined;
  };
  function recognitionStop() {
    clear("restart");
    clear("stable");
    const previous = rec;
    rec = undefined;
    if (previous) {
      previous.onresult = previous.onerror = previous.onend = null;
      try {
        previous.abort();
      } catch {}
    }
  }
  function cancel() {
    generation++;
    recognitionStop();
    lease.cancel();
    reviewLease.cancel();
    pending = "";
    chunks = [];
    file = null;
    cardId = null;
    working = false;
    reviewSnapshot = null;
    reviewAck = false;
    if (reviewTimer !== undefined) options.clock.cancel(reviewTimer);
    reviewTimer = undefined;
    state.set({ ...initialFireState(), session: generation });
  }
  function dispose() {
    active = false;
    cancel();
  }
  function settleReview() {
    if (
      !current() ||
      !reviewSnapshot ||
      !reviewAck ||
      !matchingMessage(options.room(), options.thread, reviewSnapshot)
    )
      return;
    if (reviewTimer !== undefined) options.clock.cancel(reviewTimer);
    reviewTimer = undefined;
    reviewSnapshot = null;
    chunks = [];
    file = null;
    cardId = null;
    state.update((value) => ({ ...value, phase: "complete", error: "" }));
  }
  async function review(ticket: number) {
    if (
      !current(ticket) ||
      working ||
      pending ||
      get(state).phase !== "stopping"
    )
      return;
    if (!chunks.length || (!file && !cardId)) {
      state.update((value) => ({ ...value, phase: "complete" }));
      return;
    }
    const text = options.reviewText([...chunks], file, cardId),
      targetFile = file,
      targetCard = cardId;
    reviewSnapshot = {
      text: text.trim().slice(0, MESSAGE_TEXT_LIMIT),
      fileIds: targetFile ? [targetFile.id] : [],
      replyId: targetCard ?? undefined,
      baseline: maxMessageId(options.room()),
      revision: generation,
    };
    state.update((value) => ({ ...value, phase: "review-pending" }));
    if (!current(ticket) || get(state).phase !== "review-pending") return;
    try {
      const result = await reviewLease.run(() => {
        if (!current(ticket)) throw new AgentLeaseFailure("cancelled");
        return options.request({
          t: "msg",
          text,
          thread: options.thread,
          ...(targetCard
            ? { reply_to: targetCard }
            : { files: targetFile ? [targetFile.id] : [] }),
        });
      }, 20000);
      if (!current(ticket)) return;
      if (!result.ok) {
        state.update((value) => ({
          ...value,
          phase: "review-unconfirmed",
          error: "unconfirmed",
        }));
        return;
      }
      reviewAck = true;
      settleReview();
      if (current(ticket) && reviewSnapshot) {
        reviewTimer = options.clock.schedule(() => {
          reviewTimer = undefined;
          if (current(ticket) && reviewSnapshot)
            state.update((value) => ({
              ...value,
              phase: "review-unconfirmed",
              error: "unconfirmed",
            }));
        }, 20000);
      }
    } catch {
      if (current(ticket))
        state.update((value) => ({
          ...value,
          phase: "review-unconfirmed",
          error: "unconfirmed",
        }));
    }
  }
  async function pump() {
    const phase = get(state).phase;
    if (
      !current() ||
      working ||
      !pending ||
      (phase !== "live" && phase !== "stopping")
    )
      return;
    const ticket = generation,
      text = pending;
    pending = "";
    working = true;
    state.update((value) => ({
      ...value,
      busy: true,
      interim: "",
      lastText: text,
      error: "",
    }));
    if (!current(ticket)) {
      working = false;
      return;
    }
    const open = options.port.currentFile();
    if (!current(ticket)) {
      working = false;
      return;
    }
    const body: FireBody = {
      text,
      thread: options.thread,
      history: chunks.slice(-10),
      ...(cardId
        ? { card_msg: cardId }
        : { file_id: open?.roomId === options.roomId ? open.id : file?.id }),
    };
    try {
      const result = await lease.run((signal) => {
        if (!current(ticket)) throw new AgentLeaseFailure("cancelled");
        return options.port.apply(body, signal);
      }, 90000);
      if (!current(ticket)) return;
      if (!result.ok) {
        state.update((value) => ({ ...value, error: "request" }));
      } else {
        chunks.push(text);
        if (result.mode === "card") {
          cardId = result.card_msg;
          file = null;
        } else {
          file = result.file;
          cardId = null;
          const selected = options.port.currentFile();
          if (!current(ticket)) return;
          if (
            !result.opened &&
            !(
              selected?.roomId === options.roomId && selected.name === file.name
            )
          )
            options.port.openFile(file);
        }
        if (!current(ticket)) return;
        state.update((value) => ({
          ...value,
          applied: chunks.length,
          cardId,
          lastText: text,
        }));
      }
    } catch (error) {
      if (!current(ticket)) return;
      if (
        error instanceof FireFailure &&
        (error.unauthenticated || error.membershipDenied)
      ) {
        recognitionStop();
        pending = "";
        state.update((value) => ({
          ...value,
          phase: "unconfirmed",
          error: "unconfirmed",
        }));
        if (current(ticket)) {
          if (error.unauthenticated) options.port.sessionLost();
          else options.port.denyMembership();
        }
        return;
      }
      if (error instanceof FireFailure && error.status === 429) {
        state.update((value) => ({ ...value, error: "request" }));
        return;
      }
      recognitionStop();
      pending = "";
      state.update((value) => ({
        ...value,
        phase: "unconfirmed",
        error: "unconfirmed",
      }));
    } finally {
      if (current(ticket)) {
        working = false;
        state.update((value) => ({ ...value, busy: false }));
        if (current(ticket)) {
          if (pending) void pump();
          else void review(ticket);
        }
      }
    }
  }
  function say(text: string) {
    if (!current() || get(state).phase !== "live" || !text.trim()) return;
    pending = `${pending} ${text.trim()}`.trim();
    void pump();
  }
  function listen(ticket: number) {
    if (!current(ticket) || get(state).phase !== "live" || !options.factory)
      return;
    let recognition: SpeechRecognizer;
    try {
      recognition = options.factory();
    } catch {
      stop();
      return;
    }
    rec = recognition;
    let done = 0;
    const owns = () =>
      current(ticket) && rec === recognition && get(state).phase === "live";
    recognition.lang = options.locale;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      if (!owns()) return;
      const parsed = fireSpeechPieces(event);
      if (!parsed) {
        state.update((value) => ({ ...value, error: "speech" }));
        stop();
        return;
      }
      let interim = "",
        at = -1;
      for (let index = parsed.start; index < parsed.rows.length; index++) {
        if (index < done) continue;
        const row = parsed.rows[index];
        if (row.final) {
          done = index + 1;
          say(row.text);
        } else {
          if (at < 0) at = index;
          interim += row.text;
        }
      }
      clear("stable");
      if (!owns() || !interim.trim()) return;
      state.update((value) => ({ ...value, interim: interim.trim() }));
      if (!owns()) return;
      const upTo = parsed.rows.length;
      stable = options.clock.schedule(() => {
        stable = undefined;
        if (owns() && done <= at) {
          done = upTo;
          say(interim);
        }
      }, 700);
    };
    recognition.onerror = (event) => {
      if (!owns()) return;
      state.update((value) => ({
        ...value,
        error:
          record(event) && event.error === "not-allowed"
            ? "not-allowed"
            : "speech",
      }));
      stop();
    };
    recognition.onend = () => {
      if (!owns()) return;
      rec = undefined;
      clear("stable");
      restart = options.clock.schedule(() => {
        restart = undefined;
        listen(ticket);
      }, 150);
    };
    try {
      recognition.start();
    } catch {
      if (owns()) {
        state.update((value) => ({ ...value, error: "speech" }));
        stop();
      }
    }
  }
  function stop() {
    if (!current() || get(state).phase !== "live") return;
    recognitionStop();
    state.update((value) => ({ ...value, phase: "stopping", interim: "" }));
    if (current()) void review(generation);
  }
  return {
    state: readonly(state),
    owns: (ticket: number) => current(ticket) && get(state).session === ticket,
    sync() {
      if (!current()) {
        if (
          rec ||
          working ||
          pending ||
          reviewSnapshot ||
          get(state).phase !== "idle"
        )
          cancel();
        return;
      }
      settleReview();
    },
    cancel,
    live: () => get(state).phase === "live",
    start() {
      if (
        !current() ||
        !options.factory ||
        !["idle", "complete"].includes(get(state).phase)
      )
        return;
      generation++;
      const ticket = generation;
      pending = "";
      chunks = [];
      file = null;
      cardId = null;
      state.set({ ...initialFireState(), session: ticket, phase: "live" });
      if (current(ticket) && get(state).phase === "live") listen(ticket);
    },
    stop,
    dispose,
  };
}
