/** A send's client_id (docs/architecture.md, "One send, one message"), kept until that send succeeds: a second
 *  attempt of the same send (the same key) reuses it, so the room answers with the first message if it got there. */
export function createSendIds(max = 50) {
  const ids = new Map<string, string>();
  return {
    take(key: string) {
      const kept = ids.get(key);
      if (kept) return kept;
      const id = crypto.randomUUID();
      // Bounded: the oldest unfinished send goes first.
      if (ids.size >= max) ids.delete(ids.keys().next().value ?? "");
      ids.set(key, id);
      return id;
    },
    done(key: string) {
      ids.delete(key);
    },
  };
}
export type SendIds = ReturnType<typeof createSendIds>;
