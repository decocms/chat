import { writable, type Readable } from "svelte/store";
import {
  prepareRichSource,
  parsePreparedRichSource,
  type ParsedRichSource,
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
  a.source === b.source && a.mode === b.mode && a.policy === b.policy && a.scope === b.scope;
/** An owned asynchronous gate. Parsing/projection after acquisition remain synchronous.
 * Dynamic import itself cannot be cancelled; abort/deadline revoke every late continuation.
 * Only immutable module code is reused locally; no global source/account/room cache exists. */
export function createRichPreparation(options: {
  current(input: RichInput): boolean;
  load?: HtmlTreeLoader;
  deadline?: number;
}) {
  let active = true,
    factory: HtmlTreeFactory | undefined;
  let owner: {
    input: RichInput;
    store: ReturnType<typeof writable<RichPreparationState>>;
    abort: AbortController;
    timer?: ReturnType<typeof setTimeout>;
  } | undefined;
  function release(notify = false) {
    const previous = owner;
    owner = undefined;
    if (!previous) return;
    if (previous.timer !== undefined) clearTimeout(previous.timer);
    previous.abort.abort();
    if (notify) previous.store.set({ phase: "cancelled" });
  }
  function read(input: RichInput, retry = false): Readable<RichPreparationState> {
    if (!active) return writable({ phase: "cancelled" });
    if (!retry && owner && equal(owner.input, input)) return owner.store;
    const store = retry && owner ? owner.store : writable<RichPreparationState>({ phase: "loading" });
    release();
    store.set({ phase: "loading" });
    const next = {
      input: { ...input },
      store,
      abort: new AbortController(),
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    owner = next;
    const current = () => active && owner === next && !next.abort.signal.aborted && options.current(next.input);
    if (!current()) { release(true); return next.store; }
    const prepared = prepareRichSource(input.source, input.mode, input.policy);
    if (!prepared.tokens?.html || factory) {
      next.store.set({ phase: "ready", parsed: parsePreparedRichSource(prepared, factory) });
      return next.store;
    }
    const fail = () => {
      if (owner !== next) return;
      if (next.timer !== undefined) clearTimeout(next.timer);
      next.timer = undefined;
      const valid = current();
      next.abort.abort();
      next.store.set({ phase: valid ? "error" : "cancelled" });
    };
    next.timer = setTimeout(fail, options.deadline ?? 15000);
    // Resolve an injected synchronous throw through the same owned failure path.
    void Promise.resolve().then(() => {
      if (!current()) throw Error("Rich source no longer current");
      return (options.load ?? loadHtmlTree)(next.abort.signal);
    }).then((loaded) => {
      if (!current()) { if (owner === next) release(true); return; }
      if (next.timer !== undefined) clearTimeout(next.timer);
      next.timer = undefined;
      factory = loaded;
      const parsed = parsePreparedRichSource(prepared, loaded);
      if (current()) next.store.set({ phase: "ready", parsed });
    }).catch(fail);
    return next.store;
  }
  return {
    read,
    retry() {
      if (owner && active && options.current(owner.input)) {
        read(owner.input, true);
      }
    },
    dispose() { active = false; factory = undefined; release(true); },
  };
}
