/**
 * The text of each composer draft (and the message it replies to) kept in the browser, so leaving a room or a
 * thread, reloading, or closing the app brings it back (Gimenes #4172). Only text and reply: files and polls stay
 * in memory. Keyed by account, room and thread; at most MAX_STORED drafts, the oldest go first.
 */
export type StoredDraft = { text: string; replyId?: number; at: number };
export type DraftStore = {
  read(key: string): StoredDraft | undefined;
  write(key: string, draft: { text: string; replyId?: number }): void;
  remove(key: string): void;
  /** Removes every stored draft (sign-out). */
  clear(): void;
};
const PREFIX = "vb:draft:";
export const MAX_STORED = 64;

/** A draft store over a Storage (localStorage in the app); every access is guarded, so a blocked storage only loses persistence. */
export function storageDrafts(
  storage: Storage | undefined,
  now = () => Date.now(),
): DraftStore {
  const keys = () => {
    const out: string[] = [];
    try {
      for (let i = 0; storage && i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith(PREFIX)) out.push(k);
      }
    } catch {}
    return out;
  };
  const parse = (raw: string | null): StoredDraft | undefined => {
    if (!raw) return;
    try {
      const value = JSON.parse(raw) as Partial<StoredDraft>;
      if (typeof value.text !== "string") return;
      return {
        text: value.text,
        replyId:
          typeof value.replyId === "number" && Number.isInteger(value.replyId)
            ? value.replyId
            : undefined,
        at: typeof value.at === "number" ? value.at : 0,
      };
    } catch {
      return;
    }
  };
  return {
    read(key) {
      try {
        return parse(storage?.getItem(PREFIX + key) ?? null);
      } catch {
        return;
      }
    },
    write(key, draft) {
      try {
        if (!storage) return;
        storage.setItem(
          PREFIX + key,
          JSON.stringify({
            text: draft.text,
            replyId: draft.replyId,
            at: now(),
          }),
        );
        const all = keys();
        if (all.length <= MAX_STORED) return;
        all
          .map((k) => ({ k, at: parse(storage.getItem(k))?.at ?? 0 }))
          .sort((a, b) => a.at - b.at)
          .slice(0, all.length - MAX_STORED)
          .forEach(({ k }) => storage.removeItem(k));
      } catch {}
    },
    remove(key) {
      try {
        storage?.removeItem(PREFIX + key);
      } catch {}
    },
    clear() {
      for (const k of keys())
        try {
          storage?.removeItem(k);
        } catch {}
    },
  };
}

/** The app's store: localStorage when the browser allows it. */
export function browserDrafts(): DraftStore {
  let storage: Storage | undefined;
  try {
    storage = globalThis.localStorage;
  } catch {
    storage = undefined;
  }
  return storageDrafts(storage);
}
