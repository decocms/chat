// Which of your rail folders are open, on this device, per person (localStorage "vb_rail_open:<email>"). The folders
// themselves are on the server (src/railFolders.ts); open or closed is how you left this screen.
import { writable } from "svelte/store";

const key = (email: string) => `vb_rail_open:${email}`;

function load(email: string | null): ReadonlySet<string> {
  if (!email) return new Set();
  try {
    const list: unknown = JSON.parse(localStorage.getItem(key(email)) ?? "[]");
    return new Set(
      Array.isArray(list)
        ? list
            .filter((id): id is string => typeof id === "string")
            .slice(0, 300)
        : [],
    );
  } catch {
    return new Set();
  }
}

export function createOpenFolders(email: () => string | null) {
  let owner = email();
  const store = writable<ReadonlySet<string>>(load(owner));
  // Another person signed in on this tab: their own open folders.
  const current = () => {
    const now = email();
    if (now !== owner) {
      owner = now;
      store.set(load(owner));
    }
  };
  const save = (next: ReadonlySet<string>) => {
    store.set(next);
    if (!owner) return;
    try {
      localStorage.setItem(key(owner), JSON.stringify([...next]));
    } catch {}
  };
  let value: ReadonlySet<string> = new Set();
  const stop = store.subscribe((next) => (value = next));
  return {
    subscribe(run: (value: ReadonlySet<string>) => void) {
      current();
      return store.subscribe(run);
    },
    toggle(id: string) {
      current();
      const next = new Set(value);
      if (!next.delete(id)) next.add(id);
      save(next);
    },
    open(id: string) {
      current();
      if (!value.has(id)) save(new Set([...value, id]));
    },
    closeAll() {
      current();
      if (value.size) save(new Set());
    },
    /** The signed-in person may have changed (or just loaded): their own open folders. */
    sync: current,
    dispose: stop,
  };
}
