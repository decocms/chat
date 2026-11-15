import { readonly, writable } from "svelte/store";
import type { Connection, ConnectionIdentityResult } from "../../../shared/schemas";
import type { FetchLike } from "../../transport";
import { clientClock, type ClientClock } from "../../lib/client/clock";
import { AppsFailure } from "./api";
import { DirectCancelled, type ConnectionMode, type DirectSdkModule, type DirectSession } from "./directTypes";
type Credential = { url: string; identity: string; deadline: number };
type Entry = {
  connection: Connection; signature: string; controller: AbortController;
  mode?: ConnectionMode; credential?: Credential; session?: DirectSession;
  setup?: Promise<DirectSession | null>; expiry?: unknown; closed: boolean;
};
/** Race ignored third-party awaits against the owning operation's cancellation. */
function ownedAwait<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", abort);
    const abort = () => { cleanup(); reject(new DirectCancelled()); };
    signal.addEventListener("abort", abort, { once: true });
    promise.then((value) => { cleanup(); if (signal.aborted) reject(new DirectCancelled()); else resolve(value); },
      (error: unknown) => { cleanup(); reject(signal.aborted ? new DirectCancelled() : error); });
    if (signal.aborted) abort();
  });
}
/** One RoomScope owns metadata, modes and private short-lived credentials.
 * Only initialized sessions are reused; no tool failure is ever replayed. */
export function createDirectMcp(options: {
  current(): boolean;
  identity(cid: string, signal: AbortSignal): Promise<ConnectionIdentityResult>;
  proxy(cid: string, name: string, args: unknown, signal: AbortSignal): Promise<{ result: unknown }>;
  fetcher: FetchLike;
  clock?: ClientClock; now?: () => number;
  load?: () => Promise<DirectSdkModule>;
}) {
  const state = writable<ReadonlyMap<string, ConnectionMode>>(new Map());
  const clock = options.clock ?? clientClock, now = options.now ?? Date.now,
    load = options.load ?? (() => import("./directSdk"));
  let active = true;
  let revision = 0;
  const catalog = new Map<string, Connection>(), entries = new Map<string, Entry>();
  const owns = (entry: Entry) => active && !entry.closed && options.current() && entries.get(entry.connection.id) === entry && catalog.get(entry.connection.id) === entry.connection;
  const check = (entry: Entry, signal: AbortSignal) => {
    if (!owns(entry) || signal.aborted) throw new DirectCancelled();
  };
  function resetSession(entry: Entry) {
    if (entry.expiry !== undefined) clock.cancel(entry.expiry);
    entry.expiry = undefined;
    entry.credential = undefined;
    const session = entry.session;
    entry.session = undefined;
    session?.dispose();
  }
  function close(entry: Entry) {
    if (entry.closed) return;
    entry.closed = true;
    if (entries.get(entry.connection.id) === entry) entries.delete(entry.connection.id);
    resetSession(entry);
    entry.controller.abort();
  }
  function mode(entry: Entry, value: ConnectionMode) {
    if (!owns(entry)) throw new DirectCancelled();
    entry.mode = value;
    const next = new Map(stateValue()); next.set(entry.connection.id, value); state.set(next);
  }
  let modes: ReadonlyMap<string, ConnectionMode> = new Map();
  const stopModes = state.subscribe((value) => { modes = value; });
  const stateValue = () => modes;
  const signature = (connection: Connection) => JSON.stringify(connection);
  function invalidate(cid: string) {
    const ticket = ++revision;
    catalog.delete(cid);
    const entry = entries.get(cid); if (entry) close(entry);
    if (!active || revision !== ticket) return;
    const next = new Map(stateValue()); next.delete(cid); state.set(next);
  }
  function dispose() {
    if (!active) return;
    active = false;
    revision++;
    for (const entry of [...entries.values()]) close(entry);
    catalog.clear(); state.set(new Map()); stopModes();
  }
  async function ensure(entry: Entry, signal: AbortSignal): Promise<DirectSession | null> {
    check(entry, signal);
    if (entry.credential && entry.credential.deadline > now() + 30_000 && entry.session) return entry.session;
    if (entry.setup) return entry.setup;
    const started = now(), setupSignal = AbortSignal.any([signal, entry.controller.signal]);
    const setup = (async () => {
      const proof = await ownedAwait(options.identity(entry.connection.id, setupSignal), setupSignal);
      check(entry, setupSignal);
      if (!proof.direct) { resetSession(entry); mode(entry, "proxy"); return null; }
      const url = new URL(proof.url);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash || !proof.identity || started + proof.expires_in * 1000 <= now() + 30_000) throw Error("Direct MCP setup unavailable");
      const previousUrl = entry.credential?.url;
      if (previousUrl !== proof.url) resetSession(entry);
      if (entry.expiry !== undefined) clock.cancel(entry.expiry);
      entry.credential = { url: proof.url, identity: proof.identity, deadline: started + proof.expires_in * 1000 };
      entry.expiry = clock.schedule(() => { if (owns(entry)) resetSession(entry); }, Math.max(0, entry.credential.deadline - now()));
      if (!entry.session) {
        const sdk = await ownedAwait(load(), setupSignal); check(entry, setupSignal);
        const connecting = sdk.connectDirectSdk({
          url: proof.url, signal: setupSignal, fetcher: options.fetcher,
          current: () => owns(entry),
          identity: () => owns(entry) && entry.credential && entry.credential.deadline > now() ? entry.credential.identity : null,
        });
        void connecting.then((created) => { if (!owns(entry) || setupSignal.aborted) created.dispose(); }, () => {});
        const created = await ownedAwait(connecting, setupSignal);
        if (!owns(entry) || setupSignal.aborted) { created.dispose(); throw new DirectCancelled(); }
        entry.session = created;
      }
      mode(entry, "direct"); check(entry, setupSignal);
      return entry.session;
    })().catch((error: unknown) => {
      if (!owns(entry) || setupSignal.aborted) throw new DirectCancelled();
      throw error;
    });
    entry.setup = setup;
    try { return await setup; } finally { if (entry.setup === setup) entry.setup = undefined; }
  }
  return {
    state: readonly(state),
    sync(connections: readonly Connection[]) {
      if (!active) return;
      if (!options.current()) { dispose(); return; }
      const next = new Map(connections.map((connection) => [connection.id, connection]));
      const ticket = ++revision, nextModes = new Map(stateValue());
      for (const [id, entry] of [...entries]) {
        const connection = next.get(id);
        if (!connection || signature(connection) !== entry.signature) { close(entry); nextModes.delete(id); }
        else entry.connection = connection;
        if (!active || revision !== ticket) return;
        if (!options.current()) { dispose(); return; }
      }
      catalog.clear(); for (const [id, connection] of next) catalog.set(id, connection);
      state.set(nextModes);
    },
    invalidate, dispose,
    async call(cid: string, name: string, args: unknown, signal: AbortSignal): Promise<{ result: unknown }> {
      if (!active || !options.current() || signal.aborted) throw new DirectCancelled();
      // Room Apps keep their existing path; no identity or remote SDK bootstrap.
      if (cid === "room") {
        const result = await options.proxy(cid, name, args, signal);
        if (!active || !options.current() || signal.aborted) throw new DirectCancelled();
        return result;
      }
      const connection = catalog.get(cid);
      if (!connection) throw new DirectCancelled();
      let entry = entries.get(cid);
      if (!entry) {
        entry = { connection, signature: signature(connection), controller: new AbortController(), closed: false };
        entries.set(cid, entry);
      }
      const owned = entry, operationSignal = AbortSignal.any([signal, owned.controller.signal]);
      const proxy = async () => {
        check(owned, operationSignal);
        const result = await options.proxy(cid, name, args, operationSignal);
        check(owned, operationSignal); return result;
      };
      if (owned.mode === "proxy") return proxy();
      if (connection.auth !== "identity" || connection.signed_in) {
        mode(owned, "proxy"); return proxy();
      }
      let session: DirectSession | null;
      try { session = await ensure(owned, operationSignal); }
      catch (error) {
        check(owned, operationSignal);
        if (error instanceof DirectCancelled || (error instanceof AppsFailure && error.accessDenied)) throw error;
        resetSession(owned); mode(owned, "proxy"); return proxy();
      }
      check(owned, operationSignal);
      if (!session) return proxy();
      // Everything below is a tool-call attempt. No catch may route to proxy.
      const result = await session.call(name, args, operationSignal);
      check(owned, operationSignal);
      if (owned.session !== session) throw new DirectCancelled();
      return { result };
    },
  };
}
export type DirectMcp = ReturnType<typeof createDirectMcp>;
