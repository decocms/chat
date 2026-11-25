import type { CommandOutcome, RoomCommand } from "../../shared/commands";
import type { RoomEvent } from "../../shared/room";
import { receiveRoomMessage, sendRoomCommand } from "./transport";

/** How long `request` waits for the server's answer before it gives up (the command may still have run). */
export const REQUEST_TIMEOUT_MS = 10_000;

type Socket = Pick<
  WebSocket,
  "readyState" | "send" | "close" | "onopen" | "onmessage" | "onclose"
>;
type Timer = number | ReturnType<typeof setTimeout>;
export interface RoomConnectionOptions {
  url: (lastCloseCode: string) => string;
  onEvent: (event: RoomEvent) => void;
  onRemoved: () => void;
  onUnavailable: () => void;
  createSocket?: (url: string) => Socket;
  /** The event that says the socket reached the room (a close before it: the room is unavailable). The room's
   *  socket: its "state"; the call's own socket (web/features/call/hub.ts): its first "call". */
  snapshot?: RoomEvent["t"];
  schedule?: (callback: () => void, delay: number) => Timer;
  cancel?: (timer: Timer) => void;
}

/** One room owns its socket and timers until disposal, including callbacks already queued by the browser. */
export function createRoomConnection(options: RoomConnectionOptions) {
  const schedule = options.schedule ?? setTimeout;
  const cancel = options.cancel ?? clearTimeout;
  const createSocket =
    options.createSocket ?? ((url: string) => new WebSocket(url));
  let socket: Socket | null = null;
  let retry: Timer | undefined;
  let stable: Timer | undefined;
  let disposed = false;
  let hasSnapshot = false;
  let tries = 0;
  let lastCode = "";
  // JSON-RPC requests waiting for their response (one per id). A dropped socket answers them all: the server may
  // or may not have run them, and the caller decides (the snapshot after reconnect shows what happened).
  const pending = new Map<
    string,
    { done: (r: CommandOutcome) => void; timer: Timer }
  >();
  const prefix = Math.random().toString(36).slice(2, 8);
  let nextId = 0;
  const settle = (id: string, r: CommandOutcome) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    cancel(p.timer);
    p.done(r);
  };
  const settleAll = (error: string) => {
    for (const id of [...pending.keys()]) settle(id, { ok: false, error });
  };
  const clearTimers = () => {
    if (retry !== undefined) cancel(retry);
    if (stable !== undefined) cancel(stable);
    retry = stable = undefined;
  };
  const dispose = () => {
    disposed = true;
    clearTimers();
    settleAll("disconnected");
    const previous = socket;
    socket = null;
    if (previous) {
      previous.onopen = previous.onmessage = previous.onclose = null;
      previous.close();
    }
  };
  const connect = () => {
    if (disposed) return;
    retry = undefined;
    const current = createSocket(options.url(lastCode));
    socket = current;
    const owns = () => !disposed && socket === current;
    current.onopen = () => {
      if (!owns()) return;
      stable = schedule(() => {
        if (!owns()) return;
        stable = undefined;
        if (current.readyState === 1) tries = 0;
      }, 15_000);
    };
    current.onmessage = (message) => {
      if (!owns()) return;
      const received = receiveRoomMessage(message.data);
      if (received.kind === "response") {
        settle(received.id, received.outcome);
        return;
      }
      // hello: a light socket was let in; its state comes over HTTP (root-room/session.ts).
      if (
        received.event.t === (options.snapshot ?? "state") ||
        received.event.t === "hello"
      )
        hasSnapshot = true;
      options.onEvent(received.event);
    };
    current.onclose = (event) => {
      if (!owns()) return;
      socket = null;
      clearTimers();
      settleAll("disconnected");
      current.onopen = current.onmessage = current.onclose = null;
      if (event.code === 4003) {
        dispose();
        options.onRemoved();
        return;
      }
      if (!hasSnapshot && event.code !== 1000) {
        dispose();
        options.onUnavailable();
        return;
      }
      lastCode = String(event.code || "");
      retry = schedule(connect, Math.min(30_000, 1000 * 2 ** tries++));
    };
  };
  return {
    start() {
      if (!socket && retry === undefined && !disposed) connect();
    },
    dispose,
    /** The existing bridge: true = queued on an open socket, nothing more. */
    send(command: RoomCommand) {
      return sendRoomCommand(socket, command);
    },
    /** Send a command and wait for the server's answer: ok, or why it was refused. Resolves (never rejects) with
     *  "offline" when there is no open socket, "disconnected" when the socket drops first, "timeout" after
     *  REQUEST_TIMEOUT_MS. Invalid commands throw, like `send`. */
    request(
      command: RoomCommand,
      timeoutMs = REQUEST_TIMEOUT_MS,
    ): Promise<CommandOutcome> {
      const id = `${prefix}-${++nextId}`;
      return new Promise<CommandOutcome>((resolve) => {
        if (!sendRoomCommand(socket, command, id))
          return resolve({ ok: false, error: "offline" });
        pending.set(id, {
          done: resolve,
          timer: schedule(
            () => settle(id, { ok: false, error: "timeout" }),
            timeoutMs,
          ),
        });
      });
    },
    /** Request a fresh snapshot using the normal reconnect/backoff path. */
    resync() {
      socket?.close();
    },
  };
}

/** Inferred Promise-only command request surface for new mutations. */
export type RequestRoomCommand = ReturnType<
  typeof createRoomConnection
>["request"];
