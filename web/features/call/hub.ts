// The call I am in belongs to the app, not to the room's view (like a voice channel): it goes on while I go to
// another room, a DM or Home, and ends only when I hang up (or close the tab). Each room's view asks the hub for its
// room's call session; once a session joins, the hub keeps it as the live call, with a socket of its own to the
// room (/ws/:id?call=1, Book.isCallSocket) that carries the call's word on who is in it and the call's commands,
// so the server keeps me in the call after the room's own socket closes.
import { get, writable, type Readable } from "svelte/store";
import type { RoomCommand } from "../../../shared/commands";
import type { RoomEvent } from "../../../shared/room";
import {
  createRoomConnection,
  type RoomConnectionOptions,
} from "../../app/roomConnection";
import { createCallApi, type CallApi } from "./callApi";
import { createCallSession, type CallSession } from "./session";

export type LiveCall = {
  /** The room of the call. */
  room: string;
  /** Where the call is, for the call's panel: the room's title (a DM: the person). */
  title: string;
  session: CallSession;
};
type CallSocket = {
  start(): void;
  dispose(): void;
  send(command: RoomCommand): boolean;
};
export type CallHubOptions = {
  api?: CallApi;
  /** The call's own socket to a room. */
  connect?: (
    room: string,
    events: Pick<
      RoomConnectionOptions,
      "onEvent" | "onRemoved" | "onUnavailable"
    >,
  ) => CallSocket;
};
type Entry = {
  session: CallSession;
  thread: () => string;
  title: () => string;
  /** The room's view let go of it: once idle, it is forgotten. */
  released: boolean;
  stop: () => void;
};

function browserSocket(
  room: string,
  events: Pick<
    RoomConnectionOptions,
    "onEvent" | "onRemoved" | "onUnavailable"
  >,
): CallSocket {
  return createRoomConnection({
    url: () => {
      const url = new URL(
        `/ws/${encodeURIComponent(room)}?call=1`,
        window.location.href,
      );
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.href;
    },
    snapshot: "call",
    ...events,
  });
}

export function createCallHub(options: CallHubOptions = {}) {
  const api = options.api ?? createCallApi(),
    connect = options.connect ?? browserSocket;
  const live = writable<LiveCall | null>(null);
  const entries = new Map<string, Entry>();
  let me = "",
    socket: CallSocket | null = null,
    // One click asked for the stage of this room's call (the panel on another screen, Atender): the room's view takes
    // it once it is up. `camera`: and the camera's dialog.
    stage: { room: string; camera: boolean } | null = null;
  function closeSocket() {
    socket?.dispose();
    socket = null;
  }
  function forget(room: string, entry: Entry) {
    if (entries.get(room) !== entry) return;
    entry.stop();
    entries.delete(room);
  }
  function promote(room: string, entry: Entry) {
    const now = get(live);
    if (now?.session === entry.session) return;
    // One call at a time: joining another room's call hangs up this one.
    if (now) now.session.leave();
    closeSocket();
    live.set({ room, title: entry.title(), session: entry.session });
    const opened = connect(room, {
      onEvent(event: RoomEvent) {
        // The room's word on the call: the session sees who is in it (and if it was dropped).
        if (event.t === "call") entry.session.setPeers(event.call, me);
      },
      onRemoved: () => entry.session.leave(),
      onUnavailable: () => entry.session.leave(),
    });
    socket = opened;
    opened.start();
  }
  function demote(room: string, entry: Entry) {
    if (get(live)?.session !== entry.session) return;
    closeSocket();
    live.set(null);
    if (stage?.room === room) stage = null;
    if (entry.released) forget(room, entry);
  }
  return {
    live: { subscribe: live.subscribe } as Readable<LiveCall | null>,
    /** Who I am: the session's own mark in the call. */
    setMe(email: string) {
      me = email;
    },
    /** This room's call session: the live call when it is this room's, else the room's own (idle until it joins).
     *  `thread`: the thread open now (the join sends it); `title`: where the call is, for the panel. */
    session(
      room: string,
      getters: { thread?: () => string; title?: () => string } = {},
    ): CallSession {
      const found = entries.get(room);
      if (found) {
        if (getters.thread) found.thread = getters.thread;
        if (getters.title) found.title = getters.title;
        found.released = false;
        return found.session;
      }
      const entry = {
        thread: getters.thread ?? (() => "main"),
        title: getters.title ?? (() => ""),
        released: false,
      } as Entry;
      entry.session = createCallSession(
        room,
        api,
        (command) => socket?.send(command) ?? false,
        () => entry.thread(),
      );
      entries.set(room, entry);
      entry.stop = entry.session.state.subscribe((view) => {
        if (view.phase !== "idle") promote(room, entry);
        else demote(room, entry);
      });
      return entry.session;
    },
    /** Show this room's call on its stage when its view is up (the click comes from another screen, before the
     *  room's view exists). */
    openStage(room: string, camera = false) {
      stage = { room, camera };
    },
    /** The room's view takes the stage asked for it, once. */
    takeStage(room: string) {
      if (stage?.room !== room) return null;
      const taken = stage;
      stage = null;
      return { camera: taken.camera };
    },
    /** Is this session the call I am in? */
    isLive(session: CallSession) {
      return get(live)?.session === session;
    },
    /** In a call of another room than this one. */
    busyElsewhere(room: string) {
      const now = get(live);
      return !!now && now.room !== room;
    },
    /** The room's title changed: the panel follows. */
    retitle(room: string, title: string) {
      const now = get(live);
      if (now?.room === room && now.title !== title && title)
        live.set({ ...now, title });
    },
    /** The room's view closes: its call goes on if it is the live one; an idle one is forgotten. */
    release(room: string, session: CallSession) {
      const entry = entries.get(room);
      if (!entry || entry.session !== session) return;
      entry.released = true;
      if (get(live)?.session !== session) forget(room, entry);
    },
  };
}
export type CallHub = ReturnType<typeof createCallHub>;

/** The app's one hub (the ring's card, a call line in the chat and each room's view use it). */
let shared: CallHub | null = null;
export function callHub() {
  return (shared ??= createCallHub());
}
/** Tests: the app's hub is this one (null: a new one next time). */
export function setCallHub(hub: CallHub | null) {
  shared = hub;
}
