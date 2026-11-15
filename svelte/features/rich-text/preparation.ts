import { writable, type Readable } from "svelte/store";
import {
  prepareRichSource,
  parsePreparedRichSource,
  type ParsedRichSource,
  type PreparedRichSource,
} from "./project";
import type { HtmlTreeFactory } from "./markdownTree";
import type { RichMode, RichPolicy } from "./types";
export type RichInput = {
  source: string;
  mode: RichMode;
  policy?: RichPolicy;
  /** Exact mounted account/room/document identity, never a source-text cache key. */
  scope: string;
};
export type RichPreparationState =
  | { phase: "ready"; parsed: ParsedRichSource }
  | { phase: "loading" | "error" | "cancelled" };
export type HtmlTreeLoader = (signal: AbortSignal) => Promise<HtmlTreeFactory>;
export const loadHtmlTree: HtmlTreeLoader = async () =>
  (await import("./htmlTree")).createHtmlTree;
const equal = (a: RichInput, b: RichInput) =>
  a.source === b.source &&
  a.mode === b.mode &&
  a.policy === b.policy &&
  a.scope === b.scope;
/** An owned asynchronous gate. Parsing/projection after acquisition remain synchronous.
 * Dynamic import itself cannot be cancelled; abort/deadline revoke every late continuation.
 * Only immutable module code is reused locally; no global source/account/room cache exists. */
export function createRichPreparation(options: {
  current(input: RichInput): boolean;
  load?: HtmlTreeLoader;
  deadline?: number;
}) {
  const deadline = options.deadline ?? 15000;
  let check: typeof options.current | undefined = options.current,
    loader: HtmlTreeLoader | undefined = options.load;
  let active = true,
    factory: HtmlTreeFactory | undefined;
  let owner:
    | {
        input: RichInput;
        store: ReturnType<typeof writable<RichPreparationState>>;
        abort: AbortController;
        timer?: ReturnType<typeof setTimeout>;
        prepared?: PreparedRichSource;
        supplied?: PreparedRichSource;
        ready: boolean;
      }
    | undefined;
  function cleanup(previous: typeof owner, notify = false) {
    if (!previous) return;
    if (previous.timer !== undefined) clearTimeout(previous.timer);
    previous.abort.abort();
    previous.prepared = undefined;
    previous.supplied = undefined;
    previous.input = { source: "", mode: "inline", scope: "" };
    if (notify) previous.store.set({ phase: "cancelled" });
  }
  function release(notify = false) {
    const previous = owner;
    owner = undefined;
    cleanup(previous, notify);
  }
  function read(
    input: RichInput,
    retry = false,
    supplied?: PreparedRichSource,
  ): Readable<RichPreparationState> {
    if (!active) return writable({ phase: "cancelled" });
    if (
      !retry &&
      owner &&
      equal(owner.input, input) &&
      (owner.ready || owner.supplied === supplied)
    )
      return owner.store;
    const previous = owner,
      store =
        retry && previous
          ? previous.store
          : writable<RichPreparationState>({ phase: "loading" }),
      next = {
        input: { ...input },
        store,
        abort: new AbortController(),
        timer: undefined as ReturnType<typeof setTimeout> | undefined,
        prepared: undefined as PreparedRichSource | undefined,
        supplied,
        ready: false,
      };
    // Install the ticket before abort/publication: either can synchronously reenter.
    owner = next;
    const current = () => {
      if (!active || owner !== next || next.abort.signal.aborted) return false;
      const valid = check?.(next.input) === true;
      return valid && active && owner === next && !next.abort.signal.aborted;
    };
    cleanup(previous);
    if (!current()) {
      if (owner === next) release(true);
      return next.store;
    }
    next.store.set({ phase: "loading" });
    if (!current()) {
      if (owner === next) release(true);
      return next.store;
    }
    const prepared =
      supplied ?? prepareRichSource(input.source, input.mode, input.policy);
    if (!prepared.tokens?.html || factory) {
      const parsed = parsePreparedRichSource(prepared, factory);
      if (current()) {
        next.ready = true;
        next.supplied = undefined;
        next.store.set({ phase: "ready", parsed });
      }
      return next.store;
    }
    next.prepared = prepared;
    const fail = () => {
      if (owner !== next) return;
      if (next.timer !== undefined) clearTimeout(next.timer);
      next.timer = undefined;
      const valid = current();
      next.prepared = undefined;
      next.abort.abort();
      if (owner !== next || !active) return;
      const authorized = valid && check?.(next.input) === true;
      if (owner === next && active)
        next.store.set({ phase: authorized ? "error" : "cancelled" });
    };
    next.timer = setTimeout(fail, deadline);
    // Resolve an injected synchronous throw through the same owned failure path.
    void Promise.resolve()
      .then(() => {
        if (!current()) throw Error("Rich source no longer current");
        return (loader ?? loadHtmlTree)(next.abort.signal);
      })
      .then((loaded) => {
        if (!current()) {
          if (owner === next && !next.abort.signal.aborted) release(true);
          return;
        }
        if (next.timer !== undefined) clearTimeout(next.timer);
        next.timer = undefined;
        const parsed = parsePreparedRichSource(next.prepared!, loaded);
        next.prepared = undefined;
        if (current()) {
          factory = loaded;
          next.ready = true;
          next.supplied = undefined;
          next.store.set({ phase: "ready", parsed });
        }
      })
      .catch(fail);
    return next.store;
  }
  return {
    read,
    readPrepared(input: RichInput, prepared: PreparedRichSource) {
      return read(input, false, prepared);
    },
    retry() {
      const previous = owner;
      if (
        previous &&
        !previous.ready &&
        active &&
        check?.(previous.input) &&
        active &&
        owner === previous
      ) {
        read(previous.input, true, previous.supplied);
      }
    },
    dispose() {
      active = false;
      check = undefined;
      loader = undefined;
      factory = undefined;
      release(true);
    },
  };
}

/** Bounded module acquisition for callers that already own an asynchronous render boundary. */
export function acquireHtmlTree(
  load: HtmlTreeLoader = loadHtmlTree,
  signal?: AbortSignal,
  deadline = 15000,
): Promise<HtmlTreeFactory> {
  return new Promise((resolve, reject) => {
    const abort = new AbortController();
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (factory?: HtmlTreeFactory) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", cancelled);
      abort.abort();
      if (factory) resolve(factory);
      else reject(Error("HTML parser unavailable"));
    };
    const cancelled = () => finish();
    if (signal?.aborted) {
      finish();
      return;
    }
    signal?.addEventListener("abort", cancelled, { once: true });
    timer = setTimeout(() => finish(), deadline);
    void Promise.resolve()
      .then(() => {
        if (settled) throw Error("HTML parser unavailable");
        return load(abort.signal);
      })
      .then(
        (factory) => finish(factory),
        () => finish(),
      );
  });
}
