import type { Room } from "../../../shared/room";

/** Rooms kept in IndexedDB (cache plan PR 3, Gimenes #4553): a room opened after a reload draws at once from here,
 *  and its socket resumes from it (since/at/eh, PR 2). It is a cache, never the truth: the server's answer replaces
 *  it. Only the signed-in person's rooms are kept, DMs too (a DM is a room like any other). A sign-out, another
 *  account or a room you left deletes them. */
export interface RoomCache {
  /** The saved room, or null (none, another account's, older than 7 days, or IndexedDB is not there). */
  load(account: string, roomId: string): Promise<Room | null>;
  /** Saves the room soon (batched: one write per room for each quiet second). */
  save(account: string, room: Room): void;
  drop(roomId: string): void;
  /** Deletes every saved room that is not one of these rooms of this account. */
  keep(account: string, roomIds: readonly string[]): void;
  /** Deletes everything (sign-out, another account). */
  clear(): void;
}

const DB = "deco-room-cache",
  STORE = "rooms",
  MAX_AGE_MS = 7 * 86_400_000,
  /** The newest messages a saved room keeps: older pages come from GET /messages. */
  MAX_MESSAGES = 400;
type Row = { id: string; account: string; room: Room; savedAt: number };

/** What is saved: the room without what is only true now (typing, the owner's edit history). */
export function savedRoom(room: Room): Room {
  const { typing: _typing, history: _history, ...rest } = room;
  return {
    ...rest,
    typing: {},
    messages: room.messages.slice(-MAX_MESSAGES),
  };
}

export function createRoomCache(
  idb: IDBFactory | undefined,
  options: {
    now?: () => number;
    schedule?: (fn: () => void, ms: number) => unknown;
  } = {},
): RoomCache {
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? setTimeout;
  let opening: Promise<IDBDatabase | null> | null = null;
  const open = () =>
    (opening ??= new Promise<IDBDatabase | null>((resolve) => {
      try {
        if (!idb) return resolve(null);
        const request = idb.open(DB, 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore(STORE, { keyPath: "id" });
        request.onsuccess = () => resolve(request.result);
        request.onerror = request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    }));
  const run = (
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest | void,
  ) =>
    open().then(
      (db) =>
        new Promise<unknown>((resolve) => {
          if (!db) return resolve(undefined);
          try {
            const tx = db.transaction(STORE, mode);
            const request = fn(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(request?.result);
            tx.onerror = tx.onabort = () => resolve(undefined);
          } catch {
            resolve(undefined);
          }
        }),
    );
  // Batched saves: the newest room for each id waits one quiet second, so a burst of events is one write.
  const pending = new Map<string, Row>();
  let timer: unknown = null;
  const flush = () => {
    timer = null;
    const rows = [...pending.values()];
    pending.clear();
    if (rows.length)
      void run("readwrite", (store) => {
        for (const row of rows) store.put(row);
      });
  };
  return {
    async load(account, roomId) {
      const row = (await run("readonly", (store) => store.get(roomId))) as
        Row | undefined;
      if (!row || row.account !== account || row.room.me !== account)
        return null;
      if (row.savedAt < now() - MAX_AGE_MS) {
        this.drop(roomId);
        return null;
      }
      return row.room;
    },
    save(account, room) {
      if (room.me !== account) return;
      pending.set(room.id, {
        id: room.id,
        account,
        room: savedRoom(room),
        savedAt: now(),
      });
      timer ??= schedule(flush, 1000);
    },
    drop(roomId) {
      pending.delete(roomId);
      void run("readwrite", (store) => store.delete(roomId));
    },
    keep(account, roomIds) {
      const wanted = new Set(roomIds);
      void run("readwrite", (store) => {
        const cursor = store.openCursor();
        cursor.onsuccess = () => {
          const at = cursor.result;
          if (!at) return;
          const row = at.value as Row;
          if (row.account !== account || !wanted.has(row.id)) at.delete();
          at.continue();
        };
        return cursor;
      });
    },
    clear() {
      pending.clear();
      void run("readwrite", (store) => store.clear());
    },
  };
}
