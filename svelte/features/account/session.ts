import { get, writable } from "svelte/store";
import type { MeResult, LoginsResult } from "../../../shared/schemas";
import type { PersonalSession } from "../home/personal";
import { createAuthOwner, authClock, type AuthClock } from "../auth/owner";
import { AccountFailure, type AccountApi } from "./api";
export type AccountBinding = {
  account: string;
  revision: number;
  generation: number;
};
export type AccountState = {
  binding: AccountBinding | null;
  open: boolean;
  presentation: "page" | "inline";
  me: MeResult | null;
  phase: "idle" | "pending" | "confirming" | "unconfirmed" | "error";
  error: string;
  logins: LoginsResult | null;
  loginsLoading: boolean;
  loginsError: string;
};
type Change =
  { kind: "name"; name: string } | { kind: "avatar"; avatar: number };
export function createAccountSession(
  personal: PersonalSession,
  api: AccountApi,
  clock: AuthClock = authClock,
) {
  const state = writable<AccountState>({
    binding: null,
    open: false,
    presentation: "page",
    me: null,
    phase: "idle",
    error: "",
    logins: null,
    loginsLoading: false,
    loginsError: "",
  });
  const reads = createAuthOwner(clock),
    writes = createAuthOwner(clock);
  let active = true,
    account = "",
    identity = get(personal.state).identityRevision,
    sequence = 0,
    pageEpoch = 0,
    timer: unknown | null = null;
  let operation: { ticket: number; ack: boolean; change?: Change } | null =
    null;
  const cancel = () => {
    sequence++;
    writes.cancel();
    if (timer !== null) clock.cancel(timer);
    timer = null;
    operation = null;
  };
  const owns = (ticket: number) =>
    active &&
    get(state).binding !== null &&
    ticket === sequence &&
    get(personal.state).identityRevision === identity &&
    personal.peek()?.email === account;
  function matches(change: Change, me: MeResult) {
    if (change.kind === "name") return me.name === change.name;
    return me.avatar === change.avatar;
  }
  function settle() {
    const current = operation,
      me = get(state).me;
    if (
      !current?.ack ||
      !current.change ||
      !me ||
      !owns(current.ticket) ||
      !matches(current.change, me)
    )
      return;
    cancel();
    state.update((s) => ({ ...s, phase: "idle", error: "" }));
  }
  const unsubscribe = personal.state.subscribe((next) => {
    if (!active) return;
    if (
      next.identityRevision !== identity ||
      (account && next.me && next.me.email !== account)
    ) {
      pageEpoch++;
      cancel();
      reads.cancel();
      account = "";
      identity = next.identityRevision;
      state.set({
        binding: null,
        open: false,
        presentation: "page",
        me: null,
        phase: "idle",
        error: "",
        logins: null,
        loginsLoading: false,
        loginsError: "",
      });
      return;
    }
    if (next.me && next.me.email === account) {
      state.update((s) => ({ ...s, me: next.me }));
      settle();
    }
  });
  function logins() {
    if (!active || !get(state).open) return;
    reads.cancel();
    const page = pageEpoch;
    const current = () =>
      active &&
      get(state).open &&
      pageEpoch === page &&
      get(personal.state).identityRevision === identity &&
      personal.peek()?.email === account;
    state.update((s) => ({ ...s, loginsLoading: true, loginsError: "" }));
    void reads.run(
      (signal) => api.logins(signal),
      (value) => {
        if (current())
          state.update((s) => ({ ...s, logins: value, loginsLoading: false }));
      },
      (error) => {
        if (current())
          state.update((s) => ({
            ...s,
            loginsLoading: false,
            loginsError: error instanceof Error ? error.message : "failed",
          }));
      },
    );
  }
  function change<T>(
    run: (signal: AbortSignal, current: () => boolean) => Promise<T>,
    canonical: (value: T) => Change,
  ) {
    if (
      !active ||
      !get(state).binding ||
      operation ||
      !account ||
      personal.peek()?.email !== account
    )
      return;
    const ticket = ++sequence;
    operation = { ticket, ack: false };
    state.update((s) => ({ ...s, phase: "pending", error: "" }));
    void writes.run(
      (signal) => run(signal, () => owns(ticket)),
      (value) => {
        if (!owns(ticket) || !operation) return;
        operation.ack = true;
        operation.change = canonical(value);
        state.update((s) => ({ ...s, phase: "confirming", error: "" }));
        settle();
        if (!operation) return;
        timer = clock.schedule(() => {
          if (owns(ticket))
            state.update((s) => ({
              ...s,
              phase: "unconfirmed",
              error: "unconfirmed",
            }));
        }, 10_000);
        personal.invalidate();
        void personal.refresh();
      },
      (error) => {
        if (!owns(ticket)) return;
        sequence++;
        const rejected =
          error instanceof AccountFailure &&
          [400, 401, 403, 413, 415, 429].includes(error.status);
        if (rejected) operation = null;
        state.update((s) => ({
          ...s,
          phase: rejected ? "error" : "unconfirmed",
          error: error instanceof Error ? error.message : "failed",
        }));
        if (error instanceof AccountFailure && error.status === 401) {
          personal.invalidate();
          void personal.refresh();
        }
      },
    );
  }
  function activate(presentation: "page" | "inline") {
    if (!active) return;
    const me = personal.peek();
    if (!me) return;
    pageEpoch++;
    cancel();
    reads.cancel();
    account = me.email;
    identity = get(personal.state).identityRevision;
    state.set({
      binding: { account, revision: identity, generation: pageEpoch },
      open: presentation === "page",
      presentation,
      me,
      phase: "idle",
      error: "",
      logins: null,
      loginsLoading: false,
      loginsError: "",
    });
    if (presentation === "page") logins();
    return get(state).binding;
  }
  return {
    state,
    /** The settings page is showing (AppShell opens it on /settings, closes it when you leave). */
    open() {
      activate("page");
    },
    openInline() {
      if (get(state).open) return null;
      return activate("inline") ?? null;
    },
    close(expected?: AccountBinding) {
      if (expected && get(state).binding !== expected) return;
      pageEpoch++;
      cancel();
      reads.cancel();
      state.update((s) => ({
        ...s,
        binding: null,
        open: false,
        presentation: "page",
        logins: null,
        loginsLoading: false,
      }));
    },
    owns: (binding: AccountBinding) =>
      active &&
      get(state).binding !== null &&
      get(state).binding === binding &&
      binding.account === account &&
      binding.revision === identity &&
      binding.generation === pageEpoch &&
      get(personal.state).identityRevision === identity &&
      personal.peek()?.email === account,
    current: () =>
      active &&
      get(state).binding !== null &&
      get(personal.state).identityRevision === identity &&
      personal.peek()?.email === account,
    rename: (name: string) =>
      change(
        (signal) => api.name(name, signal),
        (value) => ({ kind: "name", name: value.name }),
      ),
    photo: (convert: (current: () => boolean) => Promise<Blob>) =>
      change(
        async (signal, current) => {
          const blob = await convert(current);
          if (!current() || signal.aborted) throw Error("cancelled");
          return api.avatar(blob, signal);
        },
        (value) => ({ kind: "avatar", avatar: value.avatar }),
      ),
    refresh() {
      if (!active || !get(state).binding) return;
      personal.invalidate();
      void personal.refresh();
      if (!get(state).loginsLoading) logins();
    },
    logins,
    review() {
      if (get(state).phase !== "unconfirmed") return;
      cancel();
      state.update((s) => ({ ...s, phase: "idle", error: "" }));
    },
    dispose() {
      active = false;
      cancel();
      reads.dispose();
      writes.dispose();
      unsubscribe();
      account = "";
      state.set({
        binding: null,
        open: false,
        presentation: "page",
        me: null,
        phase: "idle",
        error: "",
        logins: null,
        loginsLoading: false,
        loginsError: "",
      });
    },
  };
}
export type AccountSession = ReturnType<typeof createAccountSession>;
