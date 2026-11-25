import { get, writable } from "svelte/store";
import type { Room, RoomEvent } from "../../../shared/room";
import type { RoomCommand, CommandOutcome } from "../../../shared/commands";
import type { MessagesPage } from "../../../shared/schemas";
import type { RoomStateEvent } from "../../../shared/events";
import {
  createRoomConnection,
  type RoomConnectionOptions,
} from "../../app/roomConnection";
import { reduceRoom } from "../../app/roomStore";
import { isRoomMember, roomHasThread } from "../../../shared/call";
import type { RoomCache } from "../room-cache/store";

export type RootConnection = ReturnType<typeof createRoomConnection>;
export type RootRoomSnapshot = {
  roomId: string | null;
  room: Room | null;
  thread: string;
  phase: "idle" | "loading" | "cached" | "live" | "removed" | "unavailable";
  generation: number;
  snapshotGeneration: number;
  connection: RootConnection | null;
  typingNotes: ReadonlyMap<number, string>;
};
export type RootRoomTransition = {
  event: RoomEvent;
  previous: Room | null;
  snapshot: RootRoomSnapshot;
};
/** Events that are only true now: a saved room never waits on them. */
const TRANSIENT = new Set<RoomEvent["t"]>(["typing", "delta", "online"]);
export function createRootRoomSession(options: {
  url(
    roomId: string,
    thread: string,
    lastCloseCode: string,
    resume?: { since: number; at: number; eh?: string },
    /** lite=1: the socket sends hello, not state, and the room comes from `room` over HTTP. */
    lite?: boolean,
  ): string;
  /** Temporary host thread adapter; callers can instead use selectThread. */
  thread?: () => string;
  acceptIdentity(account: string): boolean;
  cacheAllowed?: (room: Room) => boolean;
  /** Presentation fixes applied to every reduced room (your own DM's title in the app's language). */
  present?: (room: Room) => Room;
  onOpen(snapshot: RootRoomSnapshot): void;
  onTransition(transition: RootRoomTransition): void;
  onTerminal(snapshot: RootRoomSnapshot): void;
  connection?: (options: RoomConnectionOptions) => RootConnection;
  /** Rooms saved in IndexedDB (cache plan PR 3); without it, rooms live in memory only. */
  persist?: RoomCache;
  /** The signed-in person before any state arrives (a reload): which account's saved rooms to read. */
  whenAccount?: (found: (email: string) => void) => () => void;
  schedule?: (fn: () => void, ms: number) => unknown;
  /** Scroll-back over HTTP (GET /messages, cache plan PR 1): "older" goes here instead of the socket; null = send it
   *  on the socket as before. */
  older?: (
    roomId: string,
    thread: string,
    before: number | undefined,
  ) => Promise<MessagesPage | null>;
  /** The room's snapshot over HTTP (GET /room, compressed; a WebSocket frame is not). With it, the socket opens light
   *  (lite=1) and answers hello; null = reconnect without lite, so the socket sends the state as before. */
  room?: (
    roomId: string,
    thread: string,
    resume?: { since: number; at: number; eh?: string },
  ) => Promise<RoomStateEvent | null>;
}) {
  const blank = (generation: number): RootRoomSnapshot => ({
    roomId: null,
    room: null,
    thread: "main",
    phase: "idle",
    generation,
    snapshotGeneration: 0,
    connection: null,
    typingNotes: new Map(),
  });
  const state = writable<RootRoomSnapshot>(blank(0));
  const cache = new Map<string, Room>();
  let active = true,
    generation = 0,
    account: string | null = null;
  const read = () => get(state);
  const owns = (ticket: number, connection: RootConnection) =>
    active && ticket === generation && read().connection === connection;
  function leave() {
    const connection = read().connection;
    generation++;
    state.set(blank(generation));
    connection?.dispose();
  }
  function terminal(
    ticket: number,
    connection: RootConnection,
    phase: "removed" | "unavailable",
  ) {
    if (!owns(ticket, connection)) return;
    const current = read();
    if (current.roomId) cache.delete(current.roomId);
    if (current.roomId && phase === "removed")
      options.persist?.drop(current.roomId);
    // Revoke public state before notifying consumers or disposing pending requests.
    generation++;
    const next = { ...blank(generation), roomId: current.roomId, phase };
    state.set(next);
    connection.dispose();
    if (active && generation === next.generation && read() === next)
      options.onTerminal(next);
  }
  function receive(
    event: RoomEvent,
    roomId: string,
    ticket: number,
    connection: RootConnection,
  ) {
    if (!owns(ticket, connection)) return;
    const before = read(),
      previous = before.room;
    if (event.t === "epicsPatch" && previous) {
      const known = new Set([
        ...previous.epics.map((epic) => epic.id),
        ...event.changed.map((epic) => epic.id),
      ]);
      if (event.order.some((id) => !known.has(id))) {
        connection.resync();
        return;
      }
    }
    if (event.t === "state") {
      // Identity replacement can synchronously reset/dispose this session.
      if (options.acceptIdentity(event.me) || !owns(ticket, connection)) return;
      if (account !== null && account !== event.me) {
        cache.clear();
        options.persist?.clear();
      }
      account = event.me;
    }
    const reduced = reduceRoom(previous, event, roomId);
    const room =
      reduced && options.present ? options.present(reduced) : reduced;
    if (!room) {
      if (event.t === "error")
        options.onTransition({ event, previous, snapshot: before });
      return;
    }
    // Membership is authority, not a presentation update. Do not publish a
    // nonmember snapshot or wait for a subsequent socket close to revoke it.
    if ((event.t === "state" || event.t === "members") && !isRoomMember(room)) {
      terminal(ticket, connection, "removed");
      return;
    }
    const notes = new Map(before.typingNotes);
    if (event.t === "state") notes.clear();
    else if (event.t === "delta") notes.delete(event.id);
    else if (event.t === "typing") {
      if (event.note) notes.set(event.id, event.note);
      else notes.delete(event.id);
    }
    const next: RootRoomSnapshot = {
      ...before,
      room,
      thread: options.thread?.() ?? before.thread,
      phase: event.t === "state" ? "live" : before.phase,
      snapshotGeneration:
        before.snapshotGeneration + (event.t === "state" ? 1 : 0),
      typingNotes: notes,
    };
    if (event.t === "state") cache.delete(roomId);
    if (isRoomMember(room) && (options.cacheAllowed?.(room) ?? true)) {
      cache.set(roomId, room);
      // Durable changes only: typing, streaming deltas and presence are never written.
      if (account && !TRANSIENT.has(event.t))
        options.persist?.save(account, room);
    } else {
      cache.delete(roomId);
      options.persist?.drop(roomId);
    }
    // Cache plan PR 4: with IndexedDB, memory keeps only the open room; a switch reads the saved one. Without it
    // (a private window), memory keeps the 12 newest rooms, as before.
    if (options.persist)
      for (const id of cache.keys()) if (id !== roomId) cache.delete(id);
    while (cache.size > 12) {
      const oldest = cache.keys().next();
      if (oldest.done) break;
      cache.delete(oldest.value);
    }
    state.set(next);
    if (owns(ticket, connection))
      options.onTransition({ event, previous, snapshot: next });
  }
  return {
    state,
    read,
    /** Eviction-only compatibility surface for existing Viewer/Apps access adapters. */
    cache: {
      delete: (id: string) => cache.delete(id),
      clear: () => cache.clear(),
    },
    open(roomId: string, selected = "main") {
      if (!active) return;
      const intent = generation + 1;
      leave();
      if (!active || generation !== intent) return;
      const ticket = generation;
      const cached = cache.get(roomId);
      const room =
        cached &&
        isRoomMember(cached) &&
        (account === null || cached.me === account)
          ? cached
          : null;
      const thread =
        room &&
        selected !== "main" &&
        !selected.startsWith("pre:") &&
        !roomHasThread(room, selected)
          ? "main"
          : selected;
      // A light socket (lite=1) sends hello; the state comes over HTTP with the params this socket was opened with.
      // Events after hello wait in `queue` until that state is applied: each one is newer than the read (the Book
      // sends hello first), and each kind is an upsert by id or a whole value, so applying it again is safe.
      let lite = !!options.room,
        asked: {
          thread: string;
          resume?: { since: number; at: number; eh?: string };
        } = { thread: "main" },
        hello = 0,
        queue: RoomEvent[] | null = null;
      const snapshot = (room: NonNullable<typeof options.room>) => {
        const mine = ++hello;
        queue = [];
        void room(roomId, asked.thread, asked.resume).then((state) => {
          if (!owns(ticket, connection) || mine !== hello) return;
          const waiting = queue ?? [];
          queue = null;
          // No room over HTTP: the same room again without lite, whose socket sends the state.
          if (!state) {
            lite = false;
            connection.resync();
            return;
          }
          receive(state, roomId, ticket, connection);
          for (const event of waiting)
            receive(event, roomId, ticket, connection);
        });
      };
      const connection = (options.connection ?? createRoomConnection)({
        url: (code) => {
          const current = options.thread?.() ?? read().thread;
          // The room this socket already has (a reconnect, or a cached room opened again) resumes from it.
          const had = read().roomId === roomId ? read().room : null;
          const since = had?.messages.at(-1)?.id;
          asked = {
            thread: current.startsWith("pre:") ? "main" : current,
            resume:
              had?.at && since ? { since, at: had.at, eh: had.eh } : undefined,
          };
          return options.url(roomId, asked.thread, code, asked.resume, lite);
        },
        onEvent: (event) => {
          if (event.t === "hello") {
            if (lite && options.room && owns(ticket, connection))
              snapshot(options.room);
            return;
          }
          if (queue) queue.push(event);
          else receive(event, roomId, ticket, connection);
        },
        onRemoved: () => terminal(ticket, connection, "removed"),
        onUnavailable: () => terminal(ticket, connection, "unavailable"),
      });
      const next: RootRoomSnapshot = {
        ...blank(ticket),
        roomId,
        room,
        thread,
        phase: room ? "cached" : "loading",
        connection,
      };
      state.set(next);
      if (owns(ticket, connection)) options.onOpen(next);
      // Not in memory: the room saved in IndexedDB draws first and the socket resumes from it (cache plan PR 3).
      // The read waits at most 300 ms, then the socket starts anyway. After a reload the account is not known
      // yet: it waits for it in the same 300 ms, and a saved room never draws for an account that is not known.
      const persist = options.persist;
      const whenAccount = options.whenAccount;
      if (room || !persist || (!account && !whenAccount)) {
        if (owns(ticket, connection)) connection.start();
        return;
      }
      let started = false;
      const start = () => {
        if (started || !owns(ticket, connection)) return;
        started = true;
        connection.start();
      };
      const schedule = options.schedule ?? setTimeout;
      schedule(start, 300);
      const who = account
        ? Promise.resolve(account)
        : new Promise<string | null>((resolve) => {
            const stop = whenAccount!((email) => resolve(email));
            schedule(() => {
              stop();
              resolve(null);
            }, 300);
          });
      void who
        .then((who) => (who && !started ? persist.load(who, roomId) : null))
        .then((saved) => {
          if (
            saved &&
            !started &&
            owns(ticket, connection) &&
            !read().room &&
            isRoomMember(saved) &&
            (account === null || saved.me === account)
          )
            state.update((current) => ({
              ...current,
              room: options.present ? options.present(saved) : saved,
              phase: "cached",
            }));
          start();
        });
    },
    selectThread(thread: string) {
      if (active) state.update((current) => ({ ...current, thread }));
    },
    send(command: RoomCommand): boolean {
      if (!active) return false;
      const { connection, roomId } = read();
      if (command.t !== "older" || !options.older || !connection || !roomId)
        return connection?.send(command) ?? false;
      // The page comes back as the socket's events would (ackRows, then older), so nothing above changes.
      const ticket = generation;
      void options
        .older(roomId, command.thread, command.before)
        .then((page) => {
          if (!owns(ticket, connection)) return;
          if (!page) return void connection.send(command);
          if (page.acks.length)
            receive(
              { t: "ackRows", acks: page.acks },
              roomId,
              ticket,
              connection,
            );
          receive(
            {
              t: "older",
              thread: page.thread,
              messages: page.messages,
              more: page.more,
            },
            roomId,
            ticket,
            connection,
          );
        });
      return true;
    },
    request(command: RoomCommand, timeout?: number): Promise<CommandOutcome> {
      const connection = read().connection,
        ticket = generation;
      if (!active || !connection)
        return Promise.resolve({ ok: false, error: "offline" });
      return connection
        .request(command, timeout)
        .then((outcome) =>
          owns(ticket, connection)
            ? outcome
            : { ok: false, error: "disconnected" },
        );
    },
    /** A definite HTTP membership refusal revokes only the captured live room. */
    denyMembership(
      roomId: string,
      deniedAccount: string,
      roomGeneration: number,
    ) {
      const before = read();
      if (
        !active ||
        before.roomId !== roomId ||
        before.room?.me !== deniedAccount ||
        before.generation !== roomGeneration ||
        !before.connection
      )
        return;
      terminal(roomGeneration, before.connection, "removed");
    },
    resync() {
      if (active) read().connection?.resync();
    },
    leave,
    resetAccount() {
      cache.clear();
      options.persist?.clear();
      account = null;
      leave();
    },
    dispose() {
      if (!active) return;
      active = false;
      leave();
      cache.clear();
      account = null;
    },
  };
}
export type RootRoomSession = ReturnType<typeof createRootRoomSession>;
