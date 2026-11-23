import { get, writable } from "svelte/store";
import type { BrowserApplicationServices } from "./browser";
import type { ApplicationRoomScope } from "./types";
import type { Wait, InboxMention, InboxTask } from "../../app/types";
import type { InboxResult } from "../../../shared/schemas";
import { HomeFailure } from "../home/api";
import { messageIdentity } from "../home/model";
import { AUTH_REQUEST_TIMEOUT, type AuthClock } from "../auth/owner";
import { createAgentLease } from "../agents/lease";
import { clientClock } from "../../lib/client/clock";
export type InboxBinding = {
  account: string;
  revision: number;
  generation: number;
  roomId: string | null;
  navigationRevision: number;
  roomScope?: ApplicationRoomScope;
  trigger?: HTMLElement;
};
export type InboxSnapshot = {
  binding: InboxBinding | null;
  all: boolean;
  data: InboxResult;
  phase: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /** Asks resolved in the app but not yet sent (the Undo window): `${book_id}/${ref}`. */
  hidden: string[];
  /** How many asks the Undo toast offers back; 0 = no toast. */
  undo: number;
};
/** How long "Resolve" waits before it calls the server, so Undo only puts the rows back. */
export const INBOX_UNDO_MS = 5000;
/** Global Inbox presentation owns no canonical waits. Every callback belongs to
 * one account/opening, including the interval before outgoing DOM is flushed. */
export function createApplicationInbox(
  services: Pick<
    BrowserApplicationServices,
    | "active"
    | "state"
    | "personal"
    | "actions"
    | "rootRoom"
    | "roomScope"
    | "ownsRoom"
  >,
  clock?: AuthClock,
) {
  const reuse = <T>(
    previous: readonly T[],
    next: readonly T[],
    key: (row: T) => string,
  ): T[] => {
    const before = new Map(previous.map((row) => [key(row), row]));
    return next.map((row) => {
      const old = before.get(key(row));
      return old && JSON.stringify(old) === JSON.stringify(row) ? old : row;
    });
  };
  const waitsKey = (wait: Wait) => `${wait.book_id}/${wait.ref}`;
  const empty = (): InboxResult => ({ waits: [], mentions: [], tasks: [] });
  const state = writable<InboxSnapshot>({
    binding: null,
    // One Inbox for all rooms: no "this room" scope (Gimenes #3814).
    all: true,
    data: empty(),
    phase: "idle",
    error: null,
    hidden: [],
    undo: 0,
  });
  const timers = clock ?? clientClock;
  // The Undo window: asks the person resolved, sent when it closes (or at once when the Inbox closes).
  let later: { waits: Wait[]; timer: unknown } | null = null;
  async function send(waits: Wait[]) {
    try {
      await (waits.length === 1
        ? services.personal.api.resolve(waits[0]!.book_id, waits[0]!.ref)
        : services.personal.api.resolveMany(
            waits.map((wait) => ({ book_id: wait.book_id, ref: wait.ref })),
          ));
    } catch (error) {
      if (error instanceof HomeFailure && error.status === 401)
        services.actions.sessionLost();
      const keys = new Set(waits.map(waitsKey));
      state.update((value) => ({
        ...value,
        hidden: value.hidden.filter((key) => !keys.has(key)),
        error: value.binding ? "resolve" : value.error,
      }));
      return;
    }
    if (!active) return;
    services.personal.invalidate();
    await services.personal.refresh();
    const keys = new Set(waits.map(waitsKey));
    state.update((value) => ({
      ...value,
      hidden: value.hidden.filter((key) => !keys.has(key)),
    }));
  }
  /** Close the Undo window now: the resolved asks go to the server. */
  function flush() {
    if (!later) return;
    const { waits, timer } = later;
    later = null;
    timers.cancel(timer);
    state.update((value) => ({ ...value, undo: 0 }));
    void send(waits);
  }
  let active = true,
    generation = 0,
    pending = false,
    readRevision = 0;
  const writer = createAgentLease(
    clock ? { ...clock, now: () => Date.now() } : undefined,
  );
  const reader = createAgentLease(
    clock ? { ...clock, now: () => Date.now() } : undefined,
  );
  const sameScope = (binding: InboxBinding) => {
    const account = get(services.personal.state);
    const route = get(services.state);
    return (
      active &&
      services.active() &&
      (!binding.roomScope || services.ownsRoom(binding.roomScope)) &&
      route.navigationGeneration === binding.navigationRevision &&
      (route.route.kind === "room" ? route.route.target.roomId : null) ===
        binding.roomId &&
      account.identityRevision === binding.revision &&
      account.me?.email === binding.account
    );
  };
  const owns = (binding: InboxBinding) =>
    get(state).binding === binding && sameScope(binding);
  function close(expected?: InboxBinding) {
    if (expected && get(state).binding !== expected) return;
    flush();
    generation++;
    readRevision++;
    writer.cancel();
    reader.cancel();
    pending = false;
    state.update((value) => ({
      ...value,
      binding: null,
      data: empty(),
      phase: "idle",
      error: null,
      undo: 0,
    }));
  }
  let lastWaits = services.personal.peek()?.waits;
  const stopPersonal = services.personal.state.subscribe((value) => {
    const nextWaits = value.me?.waits;
    const changed = nextWaits !== lastWaits;
    lastWaits = nextWaits;
    const binding = get(state).binding;
    if (
      binding &&
      (value.identityRevision !== binding.revision ||
        value.me?.email !== binding.account)
    )
      close(binding);
    else if (binding && changed && owns(binding))
      state.update((current) => ({
        ...current,
        data: {
          ...current.data,
          waits: reuse(current.data.waits, nextWaits ?? [], waitsKey),
        },
      }));
  });
  let navigation = get(services.state).navigationGeneration;
  const stopRoute = services.state.subscribe((value) => {
    if (
      navigation !== value.navigationGeneration ||
      value.sessionDenied ||
      value.lifecycle === "disposed"
    )
      close();
    navigation = value.navigationGeneration;
  });
  const stopRoom = services.rootRoom.state.subscribe(() => {
    const binding = get(state).binding;
    if (binding?.roomScope && !services.ownsRoom(binding.roomScope))
      close(binding);
  });
  const canonical = (wait: Wait) =>
    services.personal
      .peek()
      ?.waits.some(
        (value) =>
          value.book_id === wait.book_id &&
          value.ref === wait.ref &&
          value.thread === wait.thread &&
          value.author === wait.author,
      );
  async function refresh(binding: InboxBinding) {
    if (!owns(binding)) return;
    const ticket = ++readRevision;
    state.update((value) => ({ ...value, phase: "loading", error: null }));
    if (!owns(binding) || ticket !== readRevision) return;
    const beforeWaits = services.personal.peek()?.waits;
    try {
      const data = await reader.run(
        (signal) => services.personal.api.inbox(signal),
        AUTH_REQUEST_TIMEOUT,
      );
      if (owns(binding) && ticket === readRevision) {
        const nowWaits = services.personal.peek()?.waits;
        state.update((value) => ({
          ...value,
          data: {
            waits: reuse(
              value.data.waits,
              nowWaits !== beforeWaits ? (nowWaits ?? []) : data.waits,
              waitsKey,
            ),
            mentions: reuse(
              value.data.mentions,
              data.mentions,
              (row) => `${row.book_id}/${row.msg_id}`,
            ),
            tasks: reuse(
              value.data.tasks,
              data.tasks,
              (row) => `${row.book_id}/${row.task_id}`,
            ),
          },
          phase: "ready",
          error: null,
        }));
        if (!owns(binding) || ticket !== readRevision) return;
        const canonical = services.personal.peek()?.waits ?? [];
        if (
          canonical.length !== data.waits.length ||
          data.waits.some(
            (wait) =>
              !canonical.some(
                (row) =>
                  row.book_id === wait.book_id &&
                  row.ref === wait.ref &&
                  row.thread === wait.thread &&
                  row.author === wait.author,
              ),
          )
        ) {
          services.personal.invalidate();
          if (owns(binding)) void services.personal.refresh();
        }
      }
    } catch (error) {
      if (!owns(binding) || ticket !== readRevision) return;
      if (error instanceof HomeFailure && error.status === 401)
        services.actions.sessionLost();
      else
        state.update((value) => ({
          ...value,
          phase: "error",
          error:
            error instanceof Error && error.message === "timeout"
              ? "timeout"
              : "read",
        }));
    }
  }
  function navigate(
    binding: InboxBinding,
    roomId: string,
    thread: string,
    messageId?: number,
  ) {
    if (!owns(binding)) return;
    const departure = generation + 1;
    close(binding);
    if (generation !== departure || get(state).binding || !sameScope(binding))
      return;
    services.actions.navigate({ roomId, thread, messageId });
  }
  return {
    state,
    owns,
    refresh,
    open(trigger?: HTMLElement) {
      if (!active || !services.active()) return;
      const data = get(services.personal.state);
      const person = data.me;
      if (!person) return;
      const before = get(services.state);
      const context: InboxBinding = {
        account: person.email,
        revision: data.identityRevision,
        generation: 0,
        roomId:
          before.route.kind === "room" ? before.route.target.roomId : null,
        navigationRevision: before.navigationGeneration,
        trigger,
        roomScope:
          before.route.kind === "room"
            ? (services.roomScope() ?? undefined)
            : undefined,
      };
      const departure = generation + 1;
      close();
      if (generation !== departure || get(state).binding || !sameScope(context))
        return;
      const binding: InboxBinding = {
        ...context,
        generation: ++generation,
      };
      state.update((value) => ({
        ...value,
        binding,
        data: {
          waits:
            before.route.kind === "room" && !binding.roomScope
              ? []
              : person.waits,
          mentions: [],
          tasks: [],
        },
        phase: "idle",
        error: null,
      }));
      if (owns(binding)) void refresh(binding);
    },
    close,
    restoreFocus(binding: InboxBinding) {
      const trigger = binding.trigger;
      if (
        generation === binding.generation + 1 &&
        !get(state).binding &&
        sameScope(binding) &&
        trigger?.isConnected &&
        trigger.getClientRects().length
      )
        trigger.focus();
    },
    openMention(binding: InboxBinding, mention: InboxMention) {
      if (owns(binding) && get(state).data.mentions.includes(mention))
        navigate(binding, mention.book_id, mention.thread, mention.msg_id);
    },
    openTask(binding: InboxBinding, task: InboxTask) {
      if (owns(binding) && get(state).data.tasks.includes(task))
        navigate(binding, task.book_id, task.epic_id);
    },
    tab(binding: InboxBinding, all: boolean) {
      if (owns(binding)) state.update((value) => ({ ...value, all }));
    },
    openWait(binding: InboxBinding, wait: Wait) {
      if (
        !owns(binding) ||
        !get(state).data.waits.includes(wait) ||
        !canonical(wait)
      )
        return;
      navigate(
        binding,
        wait.book_id,
        wait.thread,
        /^[mab]/.test(wait.ref)
          ? messageIdentity(wait.ref.slice(1))
          : undefined,
      );
    },
    /** "Resolve" with Undo: the asks leave the list now and go to the server after INBOX_UNDO_MS. */
    resolveLater(binding: InboxBinding, waits: readonly Wait[]) {
      if (!owns(binding)) return;
      const data = get(state).data.waits,
        hidden = new Set(get(state).hidden);
      const picked = waits.filter(
        (wait) =>
          wait.ref.startsWith("m") &&
          data.includes(wait) &&
          canonical(wait) &&
          !hidden.has(waitsKey(wait)),
      );
      if (!picked.length) return;
      flush();
      later = {
        waits: picked,
        timer: timers.schedule(flush, INBOX_UNDO_MS),
      };
      state.update((value) => ({
        ...value,
        hidden: [...value.hidden, ...picked.map(waitsKey)],
        undo: picked.length,
        error: null,
      }));
    },
    undo(binding: InboxBinding) {
      if (!owns(binding) || !later) return;
      const keys = new Set(later.waits.map(waitsKey));
      timers.cancel(later.timer);
      later = null;
      state.update((value) => ({
        ...value,
        hidden: value.hidden.filter((key) => !keys.has(key)),
        undo: 0,
      }));
    },
    flush,
    /** Reply in the item's thread. A reply answers the asks before it there (the server clears them). */
    async reply(
      binding: InboxBinding,
      item: { book: string; thread: string },
      text: string,
    ) {
      const body = text.trim();
      if (!owns(binding) || !body) return false;
      try {
        await services.personal.api.post(
          item.book,
          body,
          item.thread,
          crypto.randomUUID(),
        );
      } catch (error) {
        if (error instanceof HomeFailure && error.status === 401)
          services.actions.sessionLost();
        return false;
      }
      if (!owns(binding)) return true;
      services.personal.invalidate();
      void services.personal.refresh();
      void refresh(binding);
      return true;
    },
    async resolve(binding: InboxBinding, wait: Wait) {
      if (
        !owns(binding) ||
        pending ||
        !get(state).data.waits.includes(wait) ||
        !canonical(wait) ||
        !wait.ref.startsWith("m")
      )
        return;
      pending = true;
      try {
        await writer.run(
          (signal) =>
            services.personal.api.resolve(wait.book_id, wait.ref, signal),
          AUTH_REQUEST_TIMEOUT,
        );
        if (!owns(binding)) return;
        services.personal.invalidate();
        void services.personal.refresh();
        void refresh(binding);
      } catch (error) {
        if (!owns(binding)) return;
        if (error instanceof HomeFailure && error.status === 401)
          services.actions.sessionLost();
        else throw error;
      } finally {
        if (owns(binding)) pending = false;
      }
    },
    dispose() {
      if (!active) return;
      flush();
      active = false;
      readRevision++;
      stopPersonal();
      stopRoute();
      stopRoom();
      writer.cancel();
      reader.cancel();
      pending = false;
      state.update((value) => ({
        ...value,
        binding: null,
        data: empty(),
        phase: "idle",
        error: null,
      }));
    },
  };
}
export type ApplicationInbox = ReturnType<typeof createApplicationInbox>;
