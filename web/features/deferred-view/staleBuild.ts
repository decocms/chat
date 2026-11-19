/**
 * A tab opened before a deploy asks for chunk names that the new deploy no
 * longer serves (each build hashes them). Its import() then fails, and a retry
 * asks for the same missing file. The only fix is a fresh page: reload once.
 */

/** The browsers' messages for a dynamic import whose file did not load. */
const STALE_CHUNK =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

export const isStaleChunk = (error: unknown) =>
  error instanceof Error && STALE_CHUNK.test(error.message);

/** sessionStorage key: when this tab last reloaded for a new build. */
const KEY = "vb-stale-build-reload";
/** Inside this window a second failure shows the error instead: no reload loop. */
const GUARD_MS = 60_000;

type StaleBuildWindow = {
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
  location: Pick<Location, "reload">;
};

/** Reloads the page once for a newer build. False: it already did recently, or it cannot tell. */
export function reloadForNewBuild(
  win: StaleBuildWindow | undefined = typeof window === "undefined"
    ? undefined
    : window,
  now: number = Date.now(),
): boolean {
  if (!win) return false;
  try {
    const last = Number(win.sessionStorage.getItem(KEY) ?? 0);
    if (now - last < GUARD_MS) return false;
    win.sessionStorage.setItem(KEY, String(now));
  } catch {
    // No storage (private mode, blocked): no guard against a loop, so do not reload.
    return false;
  }
  win.location.reload();
  return true;
}
