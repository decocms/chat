import {
  targetHref,
  messageIdentity,
  copyRoomTarget,
  type RoomTarget,
} from "../home/model";
import { appRouteTarget } from "../apps/model";
export type ApplicationRoute =
  | { kind: "home" }
  | { kind: "archived" }
  /** Your account, agents, cloud agents and this device; `#profile`, `#cloud`… scroll to a section. */
  | { kind: "settings" }
  | { kind: "room"; target: RoomTarget }
  | { kind: "document"; url: string };
export const roomIdFromPath = (pathname: string) =>
  pathname.match(/^\/b\/([a-z0-9]{6,40})\/?$/)?.[1] ?? null;
/** Opening another room or DM, or moving between the home and one: the room is
 * rebuilt, so the app animates it (a view transition, browser.viewTransition).
 * A thread inside the same room isn't a switch. */
export function roomTransition(from: ApplicationRoute, to: ApplicationRoute) {
  if (from.kind === "room" && to.kind === "room")
    return from.target.roomId !== to.target.roomId;
  return (
    (from.kind === "home" && to.kind === "room") ||
    (from.kind === "room" && to.kind === "home")
  );
}
/** Local presentation only; reloading the serialized URL returns to main. */
export type PresentationThread = `pre:${number}`;
export function applicationRoute(href: string): ApplicationRoute {
  const url = new URL(href),
    roomId = roomIdFromPath(url.pathname);
  if (url.pathname === "/") return { kind: "home" };
  if (url.pathname === "/archived") return { kind: "archived" };
  if (url.pathname === "/settings") return { kind: "settings" };
  if (roomId) {
    const mid = /^#m(\d+)$/.exec(url.hash)?.[1],
      file = /^#f([a-z0-9]+)$/.exec(url.hash)?.[1],
      document = /^#doc(?::([\w-]+))?$/.exec(url.hash),
      epic = /^#e([\w-]+)$/.exec(url.hash)?.[1],
      app = appRouteTarget(url.hash);
    return {
      kind: "room",
      target: {
        roomId,
        thread: url.searchParams.get("t") ?? epic ?? document?.[1] ?? "main",
        messageId: messageIdentity(mid),
        fileId: file,
        document: !!document,
        ...(app ? { app } : {}),
      },
    };
  }
  return { kind: "document", url: href };
}
/** URL/history only. Room/editor/viewer internals remain explicit lifecycle callbacks during their migration. */
export function createApplicationRouter(options: {
  current: () => string;
  history: Pick<History, "pushState" | "replaceState">;
  activate: (route: ApplicationRoute) => void;
  beforeChange: () => void;
  sameRoom: (target: RoomTarget) => boolean;
  consumePop: () => boolean;
  document: (href: string) => void;
  deferNavigation?: (callback: () => void) => boolean;
}) {
  let generation = 0,
    active = true;
  function go(
    value: string | RoomTarget,
    replace = false,
    presentationThread?: PresentationThread,
  ) {
    if (!active) return;
    const intent = typeof value === "string" ? value : copyRoomTarget(value);
    if (
      options.deferNavigation?.(() => go(intent, replace, presentationThread))
    )
      return;
    const target = typeof intent === "string" ? intent : targetHref(intent),
      url = new URL(target, options.current());
    if (url.origin !== new URL(options.current()).origin) {
      options.document(url.href);
      return;
    }
    const selected = url.pathname + url.search + url.hash,
      serializedRoute = applicationRoute(
        new URL(selected, options.current()).href,
      ),
      route: ApplicationRoute =
        serializedRoute.kind === "room" && presentationThread
          ? {
              ...serializedRoute,
              target: { ...serializedRoute.target, thread: presentationThread },
            }
          : serializedRoute;
    generation++;
    if (route.kind === "document") {
      options.document(selected);
      return;
    }
    options.beforeChange();
    options.history[replace ? "replaceState" : "pushState"](null, "", selected);
    if (route.kind === "room" && options.sameRoom(route.target)) return;
    options.activate(route);
  }
  return {
    go,
    /** Only after canonical room validation. Carry a thread in the hash over to
     * the query before another feature (notably Viewer) owns the hash. */
    canonicalizeHashThread(roomId: string, thread: string) {
      if (!active) return false;
      const url = new URL(options.current());
      if (roomIdFromPath(url.pathname) !== roomId || url.searchParams.has("t"))
        return false;
      const epic = /^#e([\w-]+)$/.exec(url.hash)?.[1],
        doc = /^#doc:([\w-]+)$/.exec(url.hash)?.[1];
      if ((epic ?? doc) !== thread) return false;
      if (thread !== "main") url.searchParams.set("t", thread);
      url.hash = doc ? "#doc" : "";
      options.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
      return true;
    },
    pop() {
      if (!active || options.consumePop()) return;
      generation++;
      options.beforeChange();
      const route = applicationRoute(options.current());
      if (route.kind === "room" && options.sameRoom(route.target)) return;
      options.activate(route);
    },
    generation: () => generation,
    dispose() {
      active = false;
      generation++;
    },
  };
}
