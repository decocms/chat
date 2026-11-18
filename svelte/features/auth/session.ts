import { get, writable } from "svelte/store";
import type {
  AccessContext,
  ConsentContext,
  LoginContext,
} from "../../../shared/schemas";
import { AuthFailure, type AuthApi } from "./api";
import { authClock, createAuthOwner, type AuthClock } from "./owner";
import { consentReturn } from "./navigation";
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "network";
export function createLoginSession(
  api: AuthApi,
  search: string,
  clock: AuthClock = authClock,
) {
  const state = writable({
    context: null as LoginContext | null,
    loading: false,
    error: "",
  });
  const owner = createAuthOwner(clock);
  return {
    state,
    load() {
      if (!owner.active() || get(state).loading) return;
      state.update((s) => ({ ...s, loading: true, error: "" }));
      return owner.run(
        (signal) => api.login(search, signal),
        (context) =>
          state.update((s) => ({
            ...s,
            context,
            loading: false,
            error: context.error ?? "",
          })),
        (error) =>
          state.update((s) => ({
            ...s,
            loading: false,
            error: errorText(error),
          })),
      );
    },
    dispose() {
      owner.dispose();
    },
  };
}
export function createAccessSession(
  api: AuthApi,
  id: string,
  auto: boolean,
  navigate: (url: string) => void,
  clock: AuthClock = authClock,
  continuation?: string,
) {
  const state = writable({
    context: null as AccessContext | null,
    loading: false,
    busy: false,
    error: "",
    signedOut: false,
    declined: false,
  });
  const owner = createAuthOwner(clock);
  let active = true,
    autoUsed = false,
    poll: unknown | null = null;
  const stopPoll = () => {
    if (poll !== null) clock.cancel(poll);
    poll = null;
  };
  const target =
    continuation && /^#f[0-9a-f]{1,64}$/.test(continuation)
      ? `/b/${encodeURIComponent(id)}${continuation}`
      : `/b/${encodeURIComponent(id)}`;
  const fail = (error: unknown) => {
    const signedOut = error instanceof AuthFailure && error.status === 401;
    state.update((s) => ({
      ...s,
      loading: false,
      busy: false,
      error: errorText(error),
      signedOut,
    }));
    if (!signedOut && get(state).context?.state === "asked") schedule();
  };
  const schedule = () => {
    stopPoll();
    if (active)
      poll = clock.schedule(() => {
        poll = null;
        void load();
      }, 15_000);
  };
  function ask() {
    if (
      !active ||
      get(state).loading ||
      get(state).busy ||
      get(state).context?.state !== "ask"
    )
      return;
    state.update((s) => ({ ...s, busy: true, error: "" }));
    return owner.run(
      (signal) => api.ask(id, signal),
      () => {
        navigate(target);
      },
      fail,
    );
  }
  /** Your answer to the room's invite: yes joins and opens it, no closes the invite. */
  function answer(yes: boolean) {
    if (
      !active ||
      get(state).loading ||
      get(state).busy ||
      get(state).context?.state !== "invited"
    )
      return;
    state.update((s) => ({ ...s, busy: true, error: "" }));
    return owner.run(
      (signal) => api.answerInvite(id, yes, signal),
      () => {
        if (yes) navigate(target);
        else state.update((s) => ({ ...s, busy: false, declined: true }));
      },
      fail,
    );
  }
  function load() {
    if (!active || get(state).loading || get(state).busy) return;
    stopPoll();
    state.update((s) => ({ ...s, loading: true, error: "" }));
    return owner.run(
      (signal) => api.access(id, signal),
      (context) => {
        state.update((s) => ({
          ...s,
          context,
          loading: false,
          signedOut: context.state === "out",
        }));
        if (context.state === "member") navigate(target);
        else if (context.state === "asked") schedule();
        else if (context.state === "ask" && auto && !autoUsed) {
          autoUsed = true;
          void ask();
        }
      },
      fail,
    );
  }
  return {
    state,
    load,
    ask,
    answer,
    dispose() {
      active = false;
      stopPoll();
      owner.dispose();
    },
  };
}
export function createConsentSession(
  api: AuthApi,
  search: string,
  clock: AuthClock = authClock,
  initialFailure = false,
) {
  const state = writable({
    context: null as ConsentContext | null,
    loading: false,
    error: initialFailure ? "consent-failed" : "",
    returnTo: null as string | null,
    signedOut: false,
  });
  const owner = createAuthOwner(clock);
  return {
    state,
    load() {
      if (!owner.active() || get(state).loading) return;
      state.update((s) => ({
        ...s,
        loading: true,
        error: "",
        returnTo: null,
        signedOut: false,
      }));
      return owner.run(
        (signal) => api.consent(search, signal),
        (context) =>
          state.update((s) => ({
            ...s,
            context,
            loading: false,
            signedOut: false,
          })),
        (error) =>
          state.update((s) => ({
            ...s,
            loading: false,
            error: errorText(error),
            signedOut: error instanceof AuthFailure && error.status === 401,
            returnTo:
              error instanceof AuthFailure
                ? consentReturn(error.returnTo)
                : null,
          })),
      );
    },
    dispose() {
      owner.dispose();
    },
  };
}
