// A link to this app in a message (a room, a thread or a message): the chat draws it as a chip (AppLinkChip.svelte).
// Links on the production host and on the page's own origin (a preview, localhost) count; every other link stays a link.
export const APP_ORIGINS: readonly string[] = ["https://chat.decocms.com"];

export type AppLink = {
  room: string;
  /** A thread other than main: ?t=, #e<id> or #doc:<id> (the forms the app's own links use). */
  thread?: string;
  /** #m<id>. */
  message?: number;
  /** The same place on this origin, for in-app navigation. */
  path: string;
};

const ROOM = /^\/b\/([a-z0-9]{6,40})\/?$/;
const THREAD = /^[\w-]{1,64}$/;

export function appLink(href: string, pageUrl: string): AppLink | null {
  let url: URL, page: URL;
  try {
    page = new URL(pageUrl);
    url = new URL(href, page);
  } catch {
    return null;
  }
  if (url.origin !== page.origin && !APP_ORIGINS.includes(url.origin))
    return null;
  const room = ROOM.exec(url.pathname)?.[1];
  if (!room) return null;
  const hash = url.hash,
    message = /^#m(\d+)$/.exec(hash)?.[1],
    epic = /^#e([\w-]+)$/.exec(hash)?.[1],
    doc = /^#doc:([\w-]+)$/.exec(hash)?.[1];
  // A file (#f), an app or the doc pane is not a place the chip names: those links stay as they are.
  if (hash && hash !== "#" && !message && !epic && !doc) return null;
  const queried = url.searchParams.get("t") ?? undefined,
    thread = queried ?? epic ?? doc;
  if (thread !== undefined && !THREAD.test(thread)) return null;
  const id = message === undefined ? undefined : Number(message);
  if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) return null;
  const query =
    thread && thread !== "main" ? `?t=${encodeURIComponent(thread)}` : "";
  return {
    room,
    ...(thread && thread !== "main" ? { thread } : {}),
    ...(id !== undefined ? { message: id } : {}),
    path: `/b/${room}${query}${id !== undefined ? `#m${id}` : ""}`,
  };
}

/** The cache key: one answer per place, whichever origin or form the link used. */
export const appLinkKey = (link: AppLink) =>
  `${link.room}|${link.thread ?? ""}|${link.message ?? ""}`;
