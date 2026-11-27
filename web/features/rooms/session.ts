import { get, writable } from "svelte/store";
import type { CommandOutcome } from "../../../shared/commands";
import type { MeResult } from "../../../shared/schemas";
import type { RoomTint } from "../home/api";
import type { PersonalSession } from "../home/personal";
import { orderedRooms, roomsOnly } from "../home/model";
import {
  railEntries,
  railItems,
  sameShape,
  shapeOf,
  type RailShape,
} from "../app-navigation/railFolders";
import { authClock, createAuthOwner, type AuthClock } from "../auth/owner";
export function createRoomsSession(
  personal: PersonalSession,
  clock: AuthClock = authClock,
) {
  const state = writable({
    pending: {} as Record<string, boolean>,
    issues: {} as Record<string, string>,
  });
  let active = true,
    sequence = 0;
  type Operation = {
    ticket: number;
    ack: boolean;
    matches: (me: MeResult) => boolean;
    owner: ReturnType<typeof createAuthOwner>;
    timers: unknown[];
    roomId?: string;
  };
  const operations = new Map<string, Operation>();
  function finish(key: string, error?: string) {
    const op = operations.get(key);
    if (op) {
      op.owner.dispose();
      for (const handle of op.timers) clock.cancel(handle);
    }
    operations.delete(key);
    state.update((s) => {
      const pending = { ...s.pending },
        issues = { ...s.issues };
      delete pending[key];
      if (error) issues[key] = error;
      else delete issues[key];
      return { pending, issues };
    });
  }
  const stop = personal.state.subscribe(({ me }) => {
    if (!active || !me) return;
    for (const [key, op] of operations)
      if (op.ack && op.matches(me)) finish(key);
      else if (op.roomId && !me.books.some((room) => room.id === op.roomId))
        finish(key);
  });
  function run<T>(
    key: string,
    operation: (signal: AbortSignal) => Promise<T>,
    matches: (me: MeResult, result: T) => boolean,
    roomId?: string,
  ) {
    const me = get(personal.state).me;
    if (
      !active ||
      !me ||
      operations.has(key) ||
      (roomId && !me.books.some((room) => room.id === roomId))
    )
      return;
    const ticket = ++sequence,
      owner = createAuthOwner(clock);
    const op: Operation = {
      ticket,
      owner,
      ack: false,
      matches: () => false,
      timers: [],
      roomId,
    };
    operations.set(key, op);
    state.update((s) => {
      const issues = { ...s.issues };
      delete issues[key];
      return { pending: { ...s.pending, [key]: true }, issues };
    });
    const owns = () => active && operations.get(key)?.ticket === ticket;
    return owner.run(
      operation,
      (result) => {
        if (!owns()) return;
        op.ack = true;
        op.matches = (me) => matches(me, result);
        const current = get(personal.state).me;
        if (current && op.matches(current)) {
          finish(key);
          return;
        }
        personal.invalidate();
        void personal.refresh();
        for (const delay of [1000, 3000, 6000])
          op.timers.push(
            clock.schedule(() => {
              if (owns()) void personal.refresh();
            }, delay),
          );
        op.timers.push(
          clock.schedule(() => {
            if (owns()) finish(key, "unconfirmed");
          }, 10_000),
        );
      },
      (error) => {
        if (owns())
          finish(key, error instanceof Error ? error.message : "network");
      },
    );
  }
  return {
    state,
    rename(id: string, title: string, request: () => Promise<CommandOutcome>) {
      return run(
        `rename:${id}`,
        async () => {
          const result = await request();
          if (!result.ok) throw Error(result.error);
          return result;
        },
        (me) => me.books.find((room) => room.id === id)?.title === title,
        id,
      );
    },
    archive(id: string) {
      return run(
        `archive:${id}`,
        (signal) => personal.api.archive(id, true, signal),
        (me) => !me.books.some((room) => room.id === id),
        id,
      );
    },
    /** "Sair da sala": the room leaves your list once the server takes you out. */
    leave(id: string) {
      return run(
        `leave:${id}`,
        (signal) => personal.api.leave(id, signal),
        (me) => !me.books.some((room) => room.id === id),
        id,
      );
    },
    /** Marks everything in the room as read: the dot goes at once, the server keeps it for your other devices. */
    read(id: string) {
      const room = get(personal.state).me?.books.find((room) => room.id === id);
      if (!room) return;
      const upto = Math.max(room.last_human_id, room.last_agent_id);
      personal.seen(id, upto);
      return run(
        `read:${id}`,
        (signal) => personal.api.read(id, signal),
        (me) =>
          (me.books.find((room) => room.id === id)?.read_id ?? upto) >= upto &&
          !me.waits.some((wait) => wait.book_id === id),
        id,
      );
    },
    tint(id: string, tint: RoomTint) {
      return run(
        `tint:${id}`,
        (signal) => personal.api.tint(id, tint, signal),
        (me) => me.books.find((room) => room.id === id)?.tint === tint,
        id,
      );
    },
    icon(id: string, bytes: Blob | null) {
      return run(
        `icon:${id}`,
        (signal) => personal.api.icon(id, bytes, signal),
        (me, result) =>
          me.books.find((room) => room.id === id)?.icon === result.icon,
        id,
      );
    },
    /** The rail's rooms in a new order. Your DMs are not on the rail, so they are not in `ids` (Gimenes #4234). */
    order(ids: string[]) {
      const me = get(personal.state).me;
      const rail = me ? roomsOnly(me.books) : [];
      if (
        !me ||
        ids.length !== rail.length ||
        new Set(ids).size !== ids.length ||
        ids.some((id) => !rail.some((room) => room.id === id))
      )
        return;
      const submitted = ids.slice(0, 300);
      return run(
        "order",
        (signal) => personal.api.order(submitted, signal),
        (me) =>
          orderedRooms(me.books)
            .filter((room) => submitted.includes(room.id))
            .map((room) => room.id)
            .join("\0") === submitted.join("\0"),
      );
    },
    /** Your rail with its folders in a new shape (a drop, a new folder, a room out of one): saved whole. */
    rail(shape: RailShape) {
      const me = get(personal.state).me;
      if (!me) return;
      const submitted = shape.map((item) =>
        "room" in item ? item : { folder: item.folder, rooms: [...item.rooms] },
      );
      return run(
        "rail",
        (signal) => personal.api.rail(railItems(submitted), signal),
        (me) =>
          sameShape(
            shapeOf(railEntries(me.books, me.folders ?? [])).filter(
              (item) => "room" in item || item.rooms.length > 0,
            ),
            submitted.filter((item) => "room" in item || item.rooms.length > 0),
          ),
      );
    },
    /** "Configurações da pasta": a folder's name and color. */
    folder(id: string, patch: { name: string | null; tint: RoomTint }) {
      return run(
        `folder:${id}`,
        (signal) => personal.api.railFolder(id, patch, signal),
        (me) => {
          const folder = me.folders?.find((folder) => folder.id === id);
          return (
            !folder ||
            ((folder.tint ?? null) === patch.tint &&
              (folder.name ?? null) === (patch.name?.trim() || null))
          );
        },
      );
    },
    resolve(bookId: string, ref: string) {
      if (
        !ref.startsWith("m") ||
        !get(personal.state).me?.waits.some(
          (wait) => wait.book_id === bookId && wait.ref === ref,
        )
      )
        return;
      return run(
        `wait:${bookId}:${ref}`,
        (signal) => personal.api.resolve(bookId, ref, signal),
        (me) =>
          !me.waits.some((wait) => wait.book_id === bookId && wait.ref === ref),
      );
    },
    reset() {
      for (const key of [...operations.keys()]) finish(key);
      state.set({ pending: {}, issues: {} });
    },
    dispose() {
      active = false;
      stop();
      for (const key of [...operations.keys()]) finish(key);
    },
  };
}
export type RoomsSession = ReturnType<typeof createRoomsSession>;
