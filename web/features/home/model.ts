import type {
  ArchivedResult,
  MeResult,
  RouteResult,
  SearchResult,
} from "../../../shared/schemas";
import { appRouteHash, type AppRouteTarget } from "../apps/model";
import { waitCount, waitText, type WaitReference } from "../waits/model";
import { createApplicationCopy } from "../application/copy";
import { homeText, type HomeLanguage } from "./copy";
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
/** Your rooms without the DMs (those are listed with your DMs, `dmEntries`). */
export const roomsOnly = (books: readonly RoomSummary[]) =>
  books.filter((room) => !room.dm);
/** One DM in your list: whom it's with, and its room (a stand-in with the same id until someone writes). */
export type DmEntry = {
  /** The other person's email; yours for "Você". */
  email: string;
  /** Their name (or email); for "Você" the view writes its own label. */
  name: string;
  /** Their picture's version (PersonAvatar); yours is `me.avatar`. */
  version?: number | null;
  room: RoomSummary;
  self: boolean;
};
const standIn = (id: string, members: string[]): RoomSummary => ({
  id,
  title: null,
  folder: null,
  summary: null,
  updated_at: null,
  created_at: null,
  icon: null,
  busy_until: null,
  position: null,
  tint: null,
  opened_at: null,
  last_human_id: 0,
  last_agent_id: 0,
  read_id: 0,
  sandboxes_running: 0,
  members: members.join(","),
  dm: 1,
});
/**
 * Your DMs (src/dm.ts): "Você" (your own) and every conversation you've had,
 * newest first. A DM is listed by the server only once someone wrote in it;
 * "Você" carries a stand-in with the same id until then, so opening it works
 * the same. New conversations start from the "+" (people from your rooms).
 */
export function dmEntries(me: MeResult | null) {
  if (!me) return null;
  const made = new Map(
    me.books.filter((room) => room.dm).map((room) => [room.id, room]),
  );
  const entry = (email: string, id: string): DmEntry => ({
    email,
    name: personName(me, email),
    version: personVersion(me, email),
    room: made.get(id) ?? standIn(id, [...new Set([me.email, email])]),
    self: email === me.email,
  });
  const talked = [...made.values()]
    .filter((room) => room.id !== me.dm)
    .map((room) =>
      entry(
        roomMembers(room).find((value) => value !== me.email) ?? me.email,
        room.id,
      ),
    )
    .filter((dm) => !dm.self)
    .sort((a, b) => (b.room.updated_at ?? 0) - (a.room.updated_at ?? 0));
  return { self: entry(me.email, me.dm), talked };
}
/**
 * Your own DM ("Você") read in the language the app shows. The server titles
 * it in the room's language (src/dm.ts `dmTitle`: its owner's saved one), so an
 * English app opened on a Portuguese account would show "Você". Same object
 * when nothing changes, so stores don't redraw.
 */
export function titleOwnDm<
  R extends {
    me: string;
    members: readonly string[];
    book: { title: string; dm?: boolean | null };
  },
>(room: R, lang: HomeLanguage): R {
  if (!room.book.dm || room.members.some((email) => email !== room.me))
    return room;
  const title = homeText(lang, "you");
  return room.book.title === title
    ? room
    : { ...room, book: { ...room.book, title } };
}
/** The DMs a room switcher lists: "Você" and the ones you've talked in. */
export function switcherDms(me: MeResult | null) {
  const dms = dmEntries(me);
  return dms ? [dms.self, ...dms.talked] : [];
}
/** The DM this room id is, when it's one of yours: whom it's with (its face and name stand for it). */
export const dmEntry = (me: MeResult | null, roomId: string) =>
  switcherDms(me).find((entry) => entry.room.id === roomId);
/** A room's name in a list across rooms (waits, the inbox's All tab): a DM is named after the other person ("Você"
 *  for your own, in the app's language), not with the pair title its row keeps (src/dm.ts). */
export function roomLabel(
  me: MeResult | null,
  roomId: string,
  title: string,
  lang: HomeLanguage,
) {
  const dm = dmEntry(me, roomId);
  return dm ? (dm.self ? homeText(lang, "you") : dm.name) : title;
}
/** The DMs someone wrote in that you haven't read (not "Você", not the open one), newest first, each with about how
 *  many messages are new (message ids are per room, so the gap counts them): the rail shows them under Home. */
export function unreadDms(
  me: MeResult | null,
  seen: Readonly<Record<string, number>>,
  current: string | null,
) {
  const dms = dmEntries(me);
  if (!dms) return [];
  return dms.talked
    .filter(
      (entry) =>
        entry.room.id !== current &&
        unread(entry.room, seen[entry.room.id] ?? 0),
    )
    .map((entry) => ({
      ...entry,
      count: Math.max(
        1,
        Math.max(entry.room.last_human_id, entry.room.last_agent_id) -
          Math.max(entry.room.read_id, seen[entry.room.id] ?? 0),
      ),
    }))
    .sort((a, b) => (b.room.updated_at ?? 0) - (a.room.updated_at ?? 0));
}
/** Every DM id you have (yours and each one you've talked in): the rail's home logo is current in any of them. */
export const dmIds = (me: MeResult | null) =>
  new Set(
    me
      ? [me.dm, ...me.books.filter((room) => room.dm).map((room) => room.id)]
      : [],
  );
/** What waits on you, by room: one pass, then a lookup per row. */
export function waitsByRoom<W extends { book_id: string }>(
  waits: readonly W[],
) {
  const map = new Map<string, W[]>();
  for (const wait of waits)
    map.set(wait.book_id, [...(map.get(wait.book_id) ?? []), wait]);
  return map;
}
/**
 * A room's state in words, in the order of the avatar's three signals: what
 * waits on you (the number), who wrote since you looked (the dot), an agent
 * working (the ✻); then a cloud sandbox running, which has no mark on the
 * avatar. The rail's tooltip lists them all; a DM row shows the first.
 */
export function roomStatus(
  room: RoomSummary,
  seen: number,
  waits: readonly WaitReference[],
  now: number,
  lang: HomeLanguage,
) {
  const news = unread(room, seen),
    waiting = waitCount(waits);
  return [
    waiting ? homeText(lang, "waiting", { n: waiting }) : "",
    news ? homeText(lang, news === "human" ? "newHuman" : "newAgent") : "",
    (room.busy_until ?? 0) > now ? homeText(lang, "busy") : "",
    room.sandboxes_running ? homeText(lang, "cloud") : "",
  ].filter(Boolean);
}
export const recentRooms = (books: readonly RoomSummary[]) =>
  [...books].sort(
    (a, b) =>
      (b.opened_at ?? 0) - (a.opened_at ?? 0) ||
      (b.updated_at ?? 0) - (a.updated_at ?? 0),
  );
/** The Inbox at zero: the rooms an agent works in now, then the rooms that moved last (not those), newest first. */
export function quietRooms(
  me: MeResult | null,
  now: number,
  limit = 4,
): { working: RoomSummary[]; recent: RoomSummary[] } {
  const books = me?.books ?? [];
  const busy = (room: RoomSummary) => (room.busy_until ?? 0) > now;
  const newest = (a: RoomSummary, b: RoomSummary) =>
    (b.updated_at ?? 0) - (a.updated_at ?? 0);
  const working = books.filter(busy).sort(newest).slice(0, limit);
  const recent = books
    .filter((room) => !busy(room) && (room.updated_at ?? 0) > 0)
    .sort(newest)
    .slice(0, limit);
  return { working, recent };
}
export const unread = (room: RoomSummary, seen = 0) =>
  room.last_human_id > Math.max(room.read_id, seen)
    ? "human"
    : room.last_agent_id > Math.max(room.read_id, seen)
      ? "agent"
      : null;
/** How many messages came since you read the room, for a phone's chat row: room ids count up, so the newest
 *  person's message less the last one you read (agent lines in between count too). "dot": only an agent wrote. */
export const unreadCount = (
  room: RoomSummary,
  seen = 0,
): number | "dot" | null => {
  const kind = unread(room, seen);
  return kind === "human"
    ? Math.max(1, room.last_human_id - Math.max(room.read_id, seen))
    : kind === "agent"
      ? "dot"
      : null;
};
/** An ask of you by a person (m<msg>): it @s you, or a person asked you something. */
export const asksYou = (wait: Wait) => wait.ref.startsWith("m");
/** What your home knows about someone: a person from your rooms, a connection, who wrote to you, or a DM's other side. */
const known = (me: MeResult | null, email: string) => [
  ...(me?.people ?? []).filter((person) => person.email === email),
  ...(me?.friends ?? []).filter((friend) => friend.email === email),
  ...(me?.requests ?? []).filter((request) => request.email === email),
  ...(me?.books ?? [])
    .filter(
      (room) =>
        room.dm && email !== me?.email && roomMembers(room).includes(email),
    )
    .map((room) => ({ name: room.peer_name, avatar: room.peer_avatar })),
];
/** The newest of picture versions (they are timestamps): every source agrees on the newest one it has seen. */
export const newestVersion = (
  versions: readonly (number | null | undefined)[],
) =>
  versions.reduce<number | null | undefined>(
    (best, v) => (v && (!best || v > best) ? v : best),
    undefined,
  );
/** The version of someone's picture your home knows (PersonAvatar draws it): yours is always `me.avatar`, anyone
 *  else's the newest any home list carries. The home half of `roomAvatarVersion`, so both agree on the same data. */
export const personVersion = (me: MeResult | null, email: string) =>
  me?.email === email
    ? me.avatar
    : newestVersion(known(me, email).map((who) => who.avatar));
/** Their name when your home knows it, else their email. */
export const personName = (me: MeResult | null, email: string) =>
  (me?.email === email
    ? me.name
    : known(me, email).find((who) => who.name)?.name) || email;
export const roomMembers = (room: RoomSummary) =>
  (room.members ?? "").split(",").filter(Boolean);
export const roomIcon = (room: RoomSummary) =>
  room.icon
    ? `/api/books/${encodeURIComponent(room.id)}/icon?v=${room.icon}`
    : undefined;
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
/** The rooms Search lists, in the order its rows (and the arrow keys) go: your rooms first, then your DMs. */
export const searchRooms = (books: readonly RoomSummary[], query: string) => {
  const found = roomMatches(books, query);
  return [
    ...found.filter((room) => !room.dm),
    ...found.filter((room) => room.dm),
  ];
};
export const messageIdentity = (value: string | number | undefined) => {
  if (value === undefined) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
};
export function targetHref(target: RoomTarget) {
  const query = new URLSearchParams();
  if (target.thread && target.thread !== "main") query.set("t", target.thread);
  return `/b/${encodeURIComponent(target.roomId)}${query.size ? `?${query}` : ""}${target.fileId ? "#f" + encodeURIComponent(target.fileId) : target.messageId ? "#m" + target.messageId : target.document ? "#doc" : target.app ? (appRouteHash(target.app) ?? "") : ""}`;
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
  blue: "bg-primary/15 text-primary",
  green: "bg-success/15 text-foreground",
  yellow: "bg-warning/15 text-foreground",
  orange: "bg-warning/25 text-foreground",
  pink: "bg-destructive/15 text-foreground",
  purple: "bg-secondary text-secondary-foreground",
  none: "bg-muted text-foreground",
} as const;
// A room's tint shows as a backdrop around its rail tile (22% of the tint),
// not on the tile itself.
const roomRailTintClasses = {
  blue: "bg-room-tint-blue/22",
  green: "bg-room-tint-green/22",
  yellow: "bg-room-tint-yellow/22",
  orange: "bg-room-tint-orange/22",
  pink: "bg-room-tint-pink/22",
  purple: "bg-room-tint-purple/22",
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
/** A wait where your own Claude is blocked on you (a permission ask or a question). */
export const claudeWait = (wait: Wait) => /^[ab]/.test(wait.ref);
/**
 * The phone home's triage: waits grouped by room. Rooms where your Claude is
 * blocked come first, then the room with the newest ask; inside a room, the
 * Claude's asks first, then newest first.
 */
export function waitGroups(waits: readonly Wait[]) {
  const groups = new Map<
    string,
    { roomId: string; title: string; waits: Wait[] }
  >();
  for (const wait of waits) {
    const group = groups.get(wait.book_id) ?? {
      roomId: wait.book_id,
      title: wait.room,
      waits: [],
    };
    group.waits.push(wait);
    groups.set(wait.book_id, group);
  }
  const byUrgency = (a: Wait, b: Wait) =>
    Number(claudeWait(b)) - Number(claudeWait(a)) || b.ts - a.ts;
  return [...groups.values()]
    .map((group) => ({
      ...group,
      waits: group.waits.sort(byUrgency),
      blocked: group.waits.some(claudeWait),
    }))
    .sort(
      (a, b) =>
        Number(b.blocked) - Number(a.blocked) ||
        (b.waits[0]?.ts ?? 0) - (a.waits[0]?.ts ?? 0),
    );
}
/** The triage filters: your Claude's asks, people's asks (and @vibe's), your tasks in review. */
export type WaitKind = "claude" | "asks" | "reviews";
export const waitKind = (wait: Wait): WaitKind =>
  claudeWait(wait) ? "claude" : /^[te]/.test(wait.ref) ? "reviews" : "asks";
/**
 * A wait's text as one plain line for the home: markdown marks out, links as
 * their text, bare URLs as host + path, the hook's ⏸/❓ opener and a leading
 * @mention dropped, whitespace collapsed.
 */
export function plainWaitText(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(
      /https?:\/\/(?:www\.)?([^\s/)]+)(\/[^\s)]*)?/g,
      (_, host: string, path = "") =>
        host +
        (path.length > 24 ? path.slice(0, 23) + "…" : path === "/" ? "" : path),
    )
    .replace(/(\*\*|__|`+|~~)/g, "")
    .replace(/^[\s>#*-]*(?:[⏸❓]️?\s*)?/u, "")
    .replace(
      /^(?:Seu Claude|Your Claude) (?:pede permissão|pergunta|quer seguir com este plano|asks? (?:for )?permission|asks|wants to go ahead with this plan):?\s*/iu,
      "",
    )
    .replace(/^@[\p{L}\p{N}._-]+[,:]?\s+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}
/** A wait's line for the home, plain: an open thread of yours reads as its state ("Pronta pra fechar · 3/3 tarefas"). */
export const homeWaitText = (wait: Wait, lang: HomeLanguage) =>
  plainWaitText(waitText(wait, createApplicationCopy(lang)));
/**
 * The phone's list of rooms, like a chat app: every room and DM you talked in,
 * the one with the newest message first. Your own DM ("Você") only once you
 * wrote there.
 */
export function chatList(me: MeResult | null) {
  if (!me) return [];
  const dms = new Map(switcherDms(me).map((entry) => [entry.room.id, entry]));
  return [...me.books]
    .filter(
      (room) =>
        !room.dm ||
        (dms.has(room.id) && (!dms.get(room.id)?.self || room.last_text)),
    )
    .sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0))
    .map((room) => ({ room, dm: dms.get(room.id) }));
}
/**
 * A room's newest message as one line under its name: "Você: …", "Ana: …",
 * "Claude: …" or "@vibe: …". A DM leaves out the other person's name (the row
 * is theirs). A room with no stored line yet shows its summary.
 */
export function lastLine(
  room: RoomSummary,
  me: MeResult | null,
  lang: HomeLanguage,
  dm?: DmEntry,
) {
  const text = plainWaitText(room.last_text ?? "");
  if (!text) return room.summary ?? "";
  const by = room.last_by ?? "";
  const who = room.last_agent
    ? "Claude"
    : by === "ai"
      ? "@vibe"
      : by && by === me?.email
        ? homeText(lang, "you")
        : dm
          ? ""
          : (room.last_by_name ?? by.split("@")[0]).split(" ")[0];
  return who ? `${who}: ${text}` : text;
}
