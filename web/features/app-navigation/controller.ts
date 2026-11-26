import { roomIdFromPath } from "./router";
import { get, writable } from "svelte/store";
import type { CommandOutcome } from "../../../shared/commands";
import type { PersonalSession } from "../home/personal";
import type { RoomsSession } from "../rooms/session";
import type { RoomTarget } from "../home/model";
import { orderedRooms, roomsOnly } from "../home/model";
import { createNewRoomSession } from "../home/session";
import { createSearchSession } from "./search";
import { authClock, type AuthClock } from "../auth/owner";
import { corporateDomain } from "../../../shared/dm";
import type { OrgRoom, OrgRoomsResult } from "../../../shared/schemas";
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
  /** The rooms open to your company domain that you did not join (GET /api/org/rooms). */
  orgRooms?: (signal: AbortSignal) => Promise<OrgRoomsResult>;
  /** Joins a room open to your company and opens it. */
  joinOrg?: (room: string) => Promise<void>;
};
/** Where a room's menu opens (the pointer, or under the row from the keyboard) and for which room. */
export type RoomMenuAnchor = Readonly<{ id: string; x: number; y: number }>;
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
    /** The room (or DM) whose context menu is open. */
    menu: null as RoomMenuAnchor | null,
    archiveId: null as string | null,
    /** The room whose "Sair da sala?" confirm is open. */
    leaveId: null as string | null,
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
  /** The rooms on the rail, in its order: your DMs are listed apart, so they are not there. */
  const railRooms = () =>
    orderedRooms(roomsOnly(get(personal.state).me?.books ?? []));
  const close = () =>
    state.update((s) => ({
      ...s,
      menu: null,
      archiveId: null,
      leaveId: null,
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
  // "Da sua empresa": read again each time /api/me changes (a room joined, opened or closed pokes it), never cached.
  const company = writable<readonly OrgRoom[]>([]);
  let companyMe: unknown = null,
    companyLoad: AbortController | null = null;
  const stopCompany = personal.state.subscribe((value) => {
    const load = callbacks.orgRooms;
    if (!load || !value.me || value.me === companyMe) return;
    companyMe = value.me;
    companyLoad?.abort();
    if (!corporateDomain(value.me.email)) return company.set([]);
    const abort = (companyLoad = new AbortController());
    // A failed read keeps the list as it was; it never reaches the personal store's other readers.
    Promise.resolve(abort.signal)
      .then(load)
      .then(
        (result) => {
          if (companyLoad === abort) company.set(result.rooms);
        },
        () => {},
      );
  });
  /** Joins a room open to your company: it leaves the list at once. */
  async function joinCompany(room: string) {
    await callbacks.joinOrg?.(room);
    company.update((list) => list.filter((entry) => entry.id !== room));
  }
  return {
    personal,
    rooms,
    state,
    company: { subscribe: company.subscribe },
    joinCompany,
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
    /** Opens a room's menu: at `point` (a right-click or a long press), else under `element` (the keyboard). */
    openMenu(
      id: string,
      element?: HTMLElement,
      point?: { x: number; y: number },
    ) {
      if (
        !active ||
        !get(personal.state).me?.books.some((room) => room.id === id)
      )
        return;
      trigger = element ?? null;
      const box = point ? null : element?.getBoundingClientRect();
      const at = point ?? (box ? { x: box.left + 12, y: box.bottom } : null);
      state.update((s) => ({
        ...s,
        menu: Object.freeze({ id, x: at?.x ?? 0, y: at?.y ?? 0 }),
      }));
    },
    closeMenu() {
      state.update((s) => (s.menu ? { ...s, menu: null } : s));
    },
    closeSettings() {
      close();
    },
    askArchive(id: string) {
      state.update((s) => ({ ...s, menu: null, archiveId: id }));
    },
    askLeave(id: string) {
      state.update((s) => ({ ...s, menu: null, leaveId: id }));
    },
    /** The room's dot goes now; the server keeps it for your other tabs and devices. */
    markRead(id: string) {
      if (active) void rooms.read(id);
    },
    confirmArchive() {
      const id = get(state).archiveId;
      if (id) void rooms.archive(id);
    },
    /** Takes you out of the room; leaving the open room goes home, since it is no longer yours to see. */
    async confirmLeave() {
      const id = get(state).leaveId;
      if (!id) return;
      const left = await rooms.leave(id);
      if (left && active && get(state).roomId === id) callbacks.home();
    },
    move(id: string, delta: number) {
      const ids = railRooms().map((room) => room.id),
        from = ids.indexOf(id),
        to = from + delta;
      if (from < 0 || to < 0 || to >= ids.length) return;
      ids.splice(from, 1);
      ids.splice(to, 0, id);
      void rooms.order(ids);
    },
    /** The rail's rooms in a new order (a drop): only a reorder of the rooms there are now. Your DMs are not on the rail, so they are not in `ids`. */
    order(ids: readonly string[]) {
      const known = railRooms().map((room) => room.id);
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
        menu: null,
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
      stopCompany();
      companyLoad?.abort();
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
