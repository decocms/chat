import type {
  ArchivedResult,
  MeResult,
  RouteResult,
  SearchResult,
} from "../../../shared/schemas";
import { appRouteHash, type AppRouteTarget } from "../apps/model";
export type RoomSummary = MeResult["books"][number];
export type Wait = MeResult["waits"][number];
export type ArchivedRoom = ArchivedResult["books"][number];
export type Destination =
  | NonNullable<RouteResult["pick"]>
  | { book_id: null; epic_id: null; book_title: string; epic_title: null };
export type RoomTarget = {
  roomId: string;
  thread?: string;
  messageId?: number;
  fileId?: string;
  document?: boolean;
  app?: AppRouteTarget;
};
export const copyRoomTarget = (target: RoomTarget): RoomTarget => ({
  ...target,
  ...(target.app ? { app: { ...target.app } } : {}),
});
export const orderedRooms = (books: readonly RoomSummary[]) =>
  [...books].sort(
    (a, b) =>
      (a.position ?? 1e9) - (b.position ?? 1e9) ||
      (a.created_at ?? 0) - (b.created_at ?? 0),
  );
export const recentRooms = (books: readonly RoomSummary[]) =>
  [...books].sort(
    (a, b) =>
      (b.opened_at ?? 0) - (a.opened_at ?? 0) ||
      (b.updated_at ?? 0) - (a.updated_at ?? 0),
  );
export const unread = (room: RoomSummary, seen = 0) =>
  room.last_human_id > Math.max(room.read_id, seen)
    ? "human"
    : room.last_agent_id > Math.max(room.read_id, seen)
      ? "agent"
      : null;
export function personAvatar(me: MeResult | null, email: string) {
  const version =
    me?.email === email
      ? me.avatar
      : me?.friends.find((friend) => friend.email === email)?.avatar;
  return version
    ? `/api/avatar/${encodeURIComponent(email)}?v=${version}`
    : undefined;
}
export const roomMembers = (room: RoomSummary) =>
  (room.members ?? "").split(",").filter(Boolean);
export const roomIcon = (room: RoomSummary) =>
  room.icon
    ? `/api/books/${encodeURIComponent(room.id)}/icon?v=${room.icon}`
    : undefined;
// Same stop words as vanilla initials(), so a room shows the same mark in both UIs.
const INITIALS_STOP = new Set(
  "e de do da dos das o a os as em no na para pra com por the and of".split(
    " ",
  ),
);
export const roomInitials = (title: string | null) => {
  const words = (title ?? "")
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const main = words.filter((word) => !INITIALS_STOP.has(word.toLowerCase()));
  return (
    (main.length ? main : words)
      .slice(0, 2)
      .map((word) => Array.from(word)[0])
      .join("") || "◆"
  ).toUpperCase();
};
// Vanilla COVERS, in order: a room without an icon gets the same cover in both UIs.
export const ROOM_COVERS = [
  "oklch(0.5 0.17 248)",
  "oklch(0.58 0.17 35)",
  "oklch(0.52 0.11 175)",
  "oklch(0.47 0.15 315)",
  "oklch(0.6 0.13 75)",
  "oklch(0.45 0.1 145)",
  "oklch(0.36 0.06 255)",
  "oklch(0.55 0.16 10)",
] as const;
// Literal classes (Tailwind scans source); index i paints --vb-room-cover-i = ROOM_COVERS[i].
const roomCoverClasses = [
  "tw:bg-room-cover-0",
  "tw:bg-room-cover-1",
  "tw:bg-room-cover-2",
  "tw:bg-room-cover-3",
  "tw:bg-room-cover-4",
  "tw:bg-room-cover-5",
  "tw:bg-room-cover-6",
  "tw:bg-room-cover-7",
] as const;
export const roomCoverIndex = (title: string | null) =>
  [...String(title)].reduce(
    (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
    7,
  ) % ROOM_COVERS.length;
export const roomCoverColor = (title: string | null) =>
  ROOM_COVERS[roomCoverIndex(title)];
export const roomCover = (title: string | null) =>
  `${roomCoverClasses[roomCoverIndex(title)]} tw:text-room-cover-foreground`;
export const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
export const roomMatches = (books: readonly RoomSummary[], query: string) =>
  orderedRooms(books)
    .filter(
      (room) =>
        !query ||
        fold(room.title ?? "").includes(fold(query)) ||
        fold(room.folder ?? "").includes(fold(query)),
    )
    .slice(0, 12);
export const messageIdentity = (value: string | number | undefined) => {
  if (value === undefined) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
};
export function targetHref(target: RoomTarget) {
  const query = new URLSearchParams({ ui: "svelte" });
  if (target.thread && target.thread !== "main") query.set("t", target.thread);
  return `/b/${encodeURIComponent(target.roomId)}?${query}${target.fileId ? "#f" + encodeURIComponent(target.fileId) : target.messageId ? "#m" + target.messageId : target.document ? "#doc" : target.app ? (appRouteHash(target.app) ?? "") : ""}`;
}
export function waitTarget(wait: Wait): RoomTarget {
  const id = /^[mab](\d+)$/.exec(wait.ref)?.[1];
  return {
    roomId: wait.book_id,
    thread: wait.thread,
    messageId: messageIdentity(id),
  };
}
export const messageTarget = (
  message: SearchResult["messages"][number],
): RoomTarget => ({
  roomId: message.room_id,
  thread: message.thread,
  messageId: messageIdentity(message.id),
});
export const epicTarget = (
  epic: SearchResult["epics"][number],
): RoomTarget => ({ roomId: epic.room_id, thread: epic.id });
export function destinations(result: RouteResult): Destination[] {
  return [
    ...(result.pick ? [result.pick] : []),
    ...result.alternatives,
    {
      book_id: null,
      epic_id: null,
      book_title: result.new_room_title,
      epic_title: null,
    },
  ];
}
export const tintClasses = {
  blue: "tw:bg-primary/15 tw:text-primary",
  green: "tw:bg-success/15 tw:text-foreground",
  yellow: "tw:bg-warning/15 tw:text-foreground",
  orange: "tw:bg-warning/25 tw:text-foreground",
  pink: "tw:bg-destructive/15 tw:text-foreground",
  purple: "tw:bg-secondary tw:text-secondary-foreground",
  none: "tw:bg-muted tw:text-foreground",
} as const;
// Vanilla shows a room's tint as a tinted backdrop around its rail tile
// (.sw-group[data-tint], 22% of the tint), not on the tile itself.
const roomRailTintClasses = {
  blue: "tw:bg-room-tint-blue/22",
  green: "tw:bg-room-tint-green/22",
  yellow: "tw:bg-room-tint-yellow/22",
  orange: "tw:bg-room-tint-orange/22",
  pink: "tw:bg-room-tint-pink/22",
  purple: "tw:bg-room-tint-purple/22",
} as const;
export const roomRailTint = (room: RoomSummary) =>
  room.tint && Object.hasOwn(roomRailTintClasses, room.tint)
    ? roomRailTintClasses[room.tint as keyof typeof roomRailTintClasses]
    : undefined;
export const roomTint = (room: RoomSummary) =>
  tintClasses[
    room.tint && Object.hasOwn(tintClasses, room.tint)
      ? (room.tint as keyof typeof tintClasses)
      : "none"
  ];
