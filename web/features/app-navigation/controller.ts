import { roomIdFromPath } from "./router";
import { get, writable } from "svelte/store";
import type { CommandOutcome } from "../../../shared/commands";
import type { PersonalSession } from "../home/personal";
import type { RoomsSession } from "../rooms/session";
import type { RoomTarget } from "../home/model";
import { orderedRooms } from "../home/model";
import { createNewRoomSession } from "../home/session";
import { createSearchSession } from "./search";
import { authClock, type AuthClock } from "../auth/owner";
export type AppNavigationCallbacks = {
  navigate: (target: RoomTarget) => void;
  home: () => void;
  archived: () => void;
  /** Opens your Inbox for all rooms: the home's page at `/?inbox`. */
  inbox?: () => void;
  rename?: (id: string, title: string) => Promise<CommandOutcome>;
  /** Answers a message request: accept opens the DM with their first message, decline closes it (rejects on failure). */
  answerRequest?: (email: string, accept: boolean) => Promise<void>;
  /** Answers a room invite: yes joins and opens the room. */
  answerInvite?: (room: string, yes: boolean) => Promise<void>;
  /** Writes to someone: resolves with the DM's id when it opened (and goes there), nothing when it went as a request. */
  connect?: (email: string, text?: string) => Promise<string | undefined>;
  /** Cancels your message request to someone. */
  dismiss?: (email: string) => Promise<void>;
};
export function createAppNavigationSession(
  personal: PersonalSession,
  rooms: RoomsSession,
  callbacks: AppNavigationCallbacks,
  clock: AuthClock = authClock,
) {
  const state = writable({
    roomId: null as string | null,
    /** The home shows your Inbox (`/?inbox`). */
    inbox: false,
    settingsId: null as string | null,
    archiveId: null as string | null,
    renameId: null as string | null,
    renameDraft: "",
    renameBusy: false,
    renameError: "",
    renameSubmitted: false,
  });
  const creator = createNewRoomSession(personal, callbacks.navigate, clock),
    search = createSearchSession(personal, callbacks.navigate, clock);
  let trigger: HTMLElement | null = null,
    active = true,
    path = "";
  const close = () =>
    state.update((s) => ({
      ...s,
      settingsId: null,
      archiveId: null,
      renameId: null,
      renameBusy: false,
      renameError: "",
      renameDraft: "",
      renameSubmitted: false,
    }));
  let identityRevision = get(personal.state).identityRevision;
  const stopIdentity = personal.state.subscribe((value) => {
    if (value.identityRevision === identityRevision) return;
    identityRevision = value.identityRevision;
    trigger = null;
    search.close();
    creator.close();
    close();
  });
  return {
    personal,
    rooms,
    state,
    creator,
    search,
    callbacks,
    syncPath(href: string) {
      if (!active) return;
      const url = new URL(href);
      if (path !== url.pathname + url.search) {
        path = url.pathname + url.search;
        search.close();
        creator.close();
        close();
      }
      state.update((s) => ({
        ...s,
        roomId: roomIdFromPath(url.pathname),
        inbox: url.pathname === "/" && url.searchParams.has("inbox"),
      }));
    },
    openSearch(element?: HTMLElement) {
      trigger = element ?? null;
      search.open();
    },
    openCreate(element?: HTMLElement) {
      trigger = element ?? null;
      creator.open();
    },
    openSettings(id: string, element?: HTMLElement) {
      if (!get(personal.state).me?.books.some((room) => room.id === id)) return;
      trigger = element ?? null;
      state.update((s) => ({ ...s, settingsId: id }));
    },
    closeSettings() {
      close();
    },
    askArchive(id: string) {
      state.update((s) => ({ ...s, settingsId: null, archiveId: id }));
    },
    confirmArchive() {
      const id = get(state).archiveId;
      if (id) void rooms.archive(id);
    },
    move(id: string, delta: number) {
      const ids = orderedRooms(get(personal.state).me?.books ?? []).map(
          (room) => room.id,
        ),
        from = ids.indexOf(id),
        to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return;
      ids.splice(from, 1);
      ids.splice(to, 0, id);
      void rooms.order(ids);
    },
    /** The rail's rooms in a new order (a drop): only a reorder of the rooms there are now. */
    order(ids: readonly string[]) {
      const known = orderedRooms(get(personal.state).me?.books ?? []).map(
        (room) => room.id,
      );
      if (
        ids.length !== known.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => known.includes(id))
      )
        return;
      void rooms.order([...ids]);
    },
    askRename(id: string) {
      const room = get(personal.state).me?.books.find((room) => room.id === id);
      if (!room || get(state).roomId !== id || !callbacks.rename) return;
      state.update((s) => ({
        ...s,
        settingsId: null,
        renameId: id,
        renameDraft: room.title ?? "",
        renameError: "",
        renameSubmitted: false,
      }));
    },
    editRename(value: string) {
      state.update((s) => ({ ...s, renameDraft: value }));
    },
    async rename() {
      const s = get(state);
      if (
        !active ||
        s.renameBusy ||
        !s.renameId ||
        s.roomId !== s.renameId ||
        !callbacks.rename ||
        !s.renameDraft.trim()
      )
        return;
      const id = s.renameId,
        title = s.renameDraft.trim().slice(0, 120);
      state.update((value) => ({
        ...value,
        renameBusy: true,
        renameError: "",
        renameSubmitted: true,
      }));
      try {
        await rooms.rename(id, title, () => callbacks.rename!(id, title));
      } catch {}
      if (active && get(state).renameId === id)
        state.update((value) => ({ ...value, renameBusy: false }));
    },
    returnFocus(fallback: HTMLElement | null) {
      return trigger?.isConnected ? trigger : fallback;
    },
    pageLeft() {
      search.close();
      creator.close();
      close();
    },
    dispose() {
      stopIdentity();
      trigger = null;
      active = false;
      creator.dispose();
      search.dispose();
      close();
    },
  };
}
export type AppNavigationSession = ReturnType<
  typeof createAppNavigationSession
>;
