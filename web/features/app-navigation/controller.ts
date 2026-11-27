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
import type {
  MeAppResult,
  OrgRoom,
  OrgRoomsResult,
} from "../../../shared/schemas";
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
  /** You looked at the company rooms: the ones opened up to `until` are no longer new (POST /api/org/rooms/seen). */
  seeOrgRooms?: (until: number) => Promise<void>;
  /** Whether you run the deco.chat menu bar app on a computer (GET /api/me/app). */
  meApp?: (signal: AbortSignal) => Promise<MeAppResult>;
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
    path = "",
    // "Editar sala…" on a room that is not open: open it, then its dialog (a rename goes through the room's socket).
    editAfterOpen: string | null = null;
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
  function openEdit(id: string) {
    const room = get(personal.state).me?.books.find((room) => room.id === id);
    if (!room) return;
    state.update((s) => ({
      ...s,
      menu: null,
      renameId: id,
      renameDraft: room.title ?? "",
      renameError: "",
      renameSubmitted: false,
    }));
  }
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
  function loadCompany(email: string): Promise<void> {
    const load = callbacks.orgRooms;
    if (!load) return Promise.resolve();
    companyLoad?.abort();
    if (!corporateDomain(email)) return Promise.resolve(company.set([]));
    const abort = (companyLoad = new AbortController());
    // A failed read keeps the list as it was; it never reaches the personal store's other readers.
    return Promise.resolve(abort.signal)
      .then(load)
      .then(
        (result) => {
          if (companyLoad === abort) company.set(result.rooms);
        },
        () => {},
      );
  }
  const stopCompany = personal.state.subscribe((value) => {
    if (!callbacks.orgRooms || !value.me || value.me === companyMe) return;
    companyMe = value.me;
    loadCompany(value.me.email);
  });
  /** Reads the company's rooms again (the "Salas da empresa" dialog, each time it opens, and the app regaining focus). */
  function refreshCompany() {
    const me = get(personal.state).me;
    return me ? loadCompany(me.email) : Promise.resolve();
  }
  /** The list opened: read it again, then tell the server that what it shows was seen (every device drops the dot).
   *  The rows keep their "New" pill until the list closes. */
  function openCompany() {
    void refreshCompany().then(() => {
      const shown = get(company).filter((room) => room.new);
      if (!shown.length || !callbacks.seeOrgRooms) return;
      const until = Math.max(...shown.map((room) => room.opened_at ?? 0));
      callbacks.seeOrgRooms(until).catch(() => {});
    });
  }
  /** The list closed: nothing in it is new anymore. */
  function closeCompany() {
    company.update((list) =>
      list.some((room) => room.new)
        ? list.map((room) => (room.new ? { ...room, new: false } : room))
        : list,
    );
  }
  // A room opened to your company meanwhile: read the list again when the app comes back (no polling), at most once a
  // minute.
  let companyAt = 0;
  const companyBack = () => {
    if (
      document.visibilityState !== "visible" ||
      Date.now() - companyAt < 60_000
    )
      return;
    companyAt = Date.now();
    void refreshCompany();
  };
  if (typeof document !== "undefined")
    document.addEventListener("visibilitychange", companyBack);
  // "Instale o app" (Gimenes #5843): null until known, read once per signed-in person; a failed read stays null.
  const appInstalled = writable<boolean | null>(null);
  let appEmail = "",
    appLoad: AbortController | null = null;
  const stopApp = personal.state.subscribe((value) => {
    const load = callbacks.meApp;
    if (!load || !value.me || value.me.email === appEmail) return;
    appEmail = value.me.email;
    appLoad?.abort();
    appInstalled.set(null);
    const abort = (appLoad = new AbortController());
    Promise.resolve(abort.signal)
      .then(load)
      .then(
        (result) => {
          if (appLoad === abort) appInstalled.set(result.app);
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
    appInstalled: { subscribe: appInstalled.subscribe },
    joinCompany,
    refreshCompany,
    openCompany,
    closeCompany,
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
      const edit = editAfterOpen;
      editAfterOpen = null;
      if (edit && roomIdFromPath(url.pathname) === edit) openEdit(edit);
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
    /** "Editar sala…" (Gimenes #6163, #6166): the dialog with the name, the icon and the color, for any room. */
    askRename(id: string) {
      const room = get(personal.state).me?.books.find((room) => room.id === id);
      if (!room || !callbacks.rename) return;
      if (get(state).roomId === id) {
        openEdit(id);
        return;
      }
      editAfterOpen = id;
      state.update((s) => ({ ...s, menu: null }));
      callbacks.navigate({ roomId: id });
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
      if (typeof document !== "undefined")
        document.removeEventListener("visibilitychange", companyBack);
      companyLoad?.abort();
      stopApp();
      appLoad?.abort();
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
