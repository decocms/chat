// Folders on the rail (like Discord's server folders), per person: the rail as items (a room alone, or a folder with
// its rooms) and the changes a drop or a menu item makes. Pure: the rail draws a layout, a change gives the next
// one, and POST /api/rail saves it (src/railFolders.ts).
import type { MeFolder, RailItem } from "../../../shared/schemas";
import {
  orderedRooms,
  roomsOnly,
  unread,
  type RoomSummary,
  type Wait,
} from "../home/model";
import { waitCount } from "../waits/model";

export type RailFolder = MeFolder;
export type RailEntry =
  | { kind: "room"; room: RoomSummary }
  | { kind: "folder"; folder: RailFolder; rooms: RoomSummary[] };
/** The rail by ids: a room id, or a folder id with its room ids. What a change works on. */
export type RailShape = (
  { room: string } | { folder: string; rooms: string[] }
)[];

/** Your rail: rooms (not DMs) and folders by position; a folder's rooms in their own order, right inside it. A room
 *  whose folder is gone (another device deleted it) stands alone. */
export function railEntries(
  books: readonly RoomSummary[],
  folders: readonly RailFolder[] = [],
): RailEntry[] {
  const known = new Map(folders.map((folder) => [folder.id, folder]));
  const rooms = orderedRooms(roomsOnly(books));
  const inside = new Map<string, RoomSummary[]>();
  const entries: { at: number; entry: RailEntry }[] = [];
  for (const room of rooms) {
    const folder = room.rail_folder ? known.get(room.rail_folder) : undefined;
    if (!folder) {
      entries.push({ at: room.position ?? 1e9, entry: { kind: "room", room } });
      continue;
    }
    const list = inside.get(folder.id) ?? [];
    list.push(room);
    inside.set(folder.id, list);
  }
  for (const folder of folders) {
    const list = inside.get(folder.id);
    if (list?.length)
      entries.push({
        at: folder.position ?? list[0]!.position ?? 1e9,
        entry: { kind: "folder", folder, rooms: list },
      });
  }
  // Stable: rooms already came in rail order, ties keep it.
  return entries
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map((item) => item.entry);
}

export const shapeOf = (entries: readonly RailEntry[]): RailShape =>
  entries.map((entry) =>
    entry.kind === "room"
      ? { room: entry.room.id }
      : { folder: entry.folder.id, rooms: entry.rooms.map((room) => room.id) },
  );

/** What POST /api/rail takes. */
export const railItems = (shape: RailShape): RailItem[] =>
  shape.map((item) =>
    "room" in item
      ? { room: item.room }
      : { folder: item.folder, rooms: [...item.rooms] },
  );

/** The id of a root item: the room's, or the folder's. */
export const itemId = (item: RailShape[number]) =>
  "room" in item ? item.room : item.folder;

/** Every room of the rail in its order (a folder's rooms where the folder is): the flat order other lists use. */
export const flatRooms = (shape: RailShape) =>
  shape.flatMap((item) => ("room" in item ? [item.room] : item.rooms));

/** The folder a room is in, if any. */
export const folderOf = (shape: RailShape, room: string) => {
  const item = shape.find(
    (item) => "folder" in item && item.rooms.includes(room),
  );
  return item && "folder" in item ? item.folder : null;
};

/** A new folder's id (the browser makes it; POST /api/rail checks its form). */
export const newFolderId = (random: () => number = Math.random) =>
  "f" +
  Array.from(
    { length: 11 },
    () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(random() * 36)],
  ).join("");

/** Takes `room` out of wherever it is. A folder left with one room dissolves (that room stands in its place); one
 *  left with none goes. */
function without(shape: RailShape, room: string): RailShape {
  return shape.flatMap((item): RailShape => {
    if ("room" in item) return item.room === room ? [] : [item];
    if (!item.rooms.includes(room)) return [item];
    const rooms = item.rooms.filter((id) => id !== room);
    if (rooms.length === 0) return [];
    if (rooms.length === 1) return [{ room: rooms[0]! }];
    return [{ folder: item.folder, rooms }];
  });
}

/** Where a root item is now. */
const rootIndex = (shape: RailShape, id: string) =>
  shape.findIndex((item) => itemId(item) === id);

/**
 * A room dropped on another room or on a folder (Discord's "drop a server on a server"). On a room: a new folder with
 * both, in the target's place, the target first. On a folder: the room joins it, last. Dropped on itself, or on the
 * folder it is in: nothing changes.
 */
export function combine(
  shape: RailShape,
  room: string,
  target: string,
  folderId: string,
): RailShape {
  if (room === target) return shape;
  const into = shape.find((item) => "folder" in item && item.folder === target);
  if (into && "folder" in into && into.rooms.includes(room)) return shape;
  const rest = without(shape, room);
  // The target itself may have been a folder that just dissolved, or a room now standing alone.
  const at = rootIndex(rest, target);
  if (at >= 0) {
    const item = rest[at]!;
    const next = [...rest];
    next[at] =
      "folder" in item
        ? { folder: item.folder, rooms: [...item.rooms, room] }
        : { folder: folderId, rooms: [item.room, room] };
    return next;
  }
  // The target is a room inside a folder: the dropped room joins that folder, right after it.
  return rest.map((item) =>
    "folder" in item && item.rooms.includes(target)
      ? {
          folder: item.folder,
          rooms: item.rooms.flatMap((id) =>
            id === target ? [id, room] : [id],
          ),
        }
      : item,
  );
}

/** "Mover ▸ <pasta>": the room joins that folder, last. */
export const moveToFolder = (shape: RailShape, room: string, folder: string) =>
  combine(shape, room, folder, folder);

/** "Mover ▸ Nova pasta": a folder with just this room, in its place (more rooms join by a drop or this menu). */
export function newFolder(
  shape: RailShape,
  room: string,
  folderId: string,
): RailShape {
  const inFolder = folderOf(shape, room);
  if (!inFolder)
    return shape.map((item) =>
      "room" in item && item.room === room
        ? { folder: folderId, rooms: [room] }
        : item,
    );
  const rest = without(shape, room);
  return [
    ...rest.slice(0, after(shape, rest, inFolder)),
    { folder: folderId, rooms: [room] },
    ...rest.slice(after(shape, rest, inFolder)),
  ];
}

/** Right after `folder` once a room left it: where it was, plus one, unless it went away with that room. */
const after = (shape: RailShape, rest: RailShape, folder: string) => {
  const at = rootIndex(shape, folder);
  return rest.length < shape.length ? at : at + 1;
};

/** A room out of its folder (dragged out, or "Tirar da pasta"): it stands alone at root index `to` (default: right
 *  after the folder). */
export function takeOut(
  shape: RailShape,
  room: string,
  to?: number,
): RailShape {
  const folder = folderOf(shape, room);
  if (!folder) return shape;
  const rest = without(shape, room);
  const at = Math.max(
    0,
    Math.min(to ?? after(shape, rest, folder), rest.length),
  );
  return [...rest.slice(0, at), { room }, ...rest.slice(at)];
}

/** A root item (a room or a folder) to a new root index. */
export function moveRoot(shape: RailShape, id: string, to: number): RailShape {
  const from = rootIndex(shape, id);
  if (from < 0) return shape;
  const next = [...shape];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item!);
  return next;
}

/** A room inside its folder to a new index there. */
export function moveInFolder(
  shape: RailShape,
  room: string,
  to: number,
): RailShape {
  return shape.map((item) => {
    if (!("folder" in item) || !item.rooms.includes(room)) return item;
    const rooms = item.rooms.filter((id) => id !== room);
    rooms.splice(Math.max(0, Math.min(to, rooms.length)), 0, room);
    return { folder: item.folder, rooms };
  });
}

/** One step up or down ("Mover ▸ Para cima / Para baixo"): inside its folder for a room in one, else on the rail. */
export function step(shape: RailShape, id: string, delta: -1 | 1): RailShape {
  const folder = folderOf(shape, id);
  if (folder) {
    const item = shape.find(
      (item) => "folder" in item && item.folder === folder,
    );
    const at = item && "folder" in item ? item.rooms.indexOf(id) : -1;
    return moveInFolder(shape, id, at + delta);
  }
  const at = rootIndex(shape, id);
  return at < 0 ? shape : moveRoot(shape, id, at + delta);
}

/** Whether `step` can move it that way. */
export function canStep(shape: RailShape, id: string, delta: -1 | 1) {
  const folder = folderOf(shape, id);
  const list = folder
    ? (() => {
        const item = shape.find(
          (item) => "folder" in item && item.folder === folder,
        );
        return item && "folder" in item ? item.rooms : [];
      })()
    : shape.map(itemId);
  const at = list.indexOf(id);
  return at >= 0 && at + delta >= 0 && at + delta < list.length;
}

export const sameShape = (a: RailShape, b: RailShape) =>
  JSON.stringify(a) === JSON.stringify(b);

/** A closed folder's signals: the red number is what waits on you in all its rooms (each room's WaitBadge, summed),
 *  the edge dot says new messages in any (a person wrote: strong; only agents: muted). */
export function folderSignals(
  rooms: readonly RoomSummary[],
  seen: Readonly<Record<string, number>>,
  waits: readonly Wait[],
) {
  const ids = new Set(rooms.map((room) => room.id));
  const count = waitCount(waits.filter((wait) => ids.has(wait.book_id)));
  let news: "human" | "agent" | null = null;
  for (const room of rooms) {
    const kind = unread(room, seen[room.id] ?? 0);
    if (kind === "human") {
      news = "human";
      break;
    }
    if (kind === "agent") news = "agent";
  }
  return { count, unread: news };
}

/** The root item a folder left behind: the folder, or the room standing in its place once it dissolved. */
function anchorIn(shape: RailShape, rest: RailShape, id: string | null) {
  if (id === null || rootIndex(rest, id) >= 0) return id;
  const gone = shape.find((item) => "folder" in item && item.folder === id);
  return gone && "folder" in gone
    ? (gone.rooms.find((room) => rootIndex(rest, room) >= 0) ?? null)
    : null;
}

/** A room or a folder onto the rail itself, before `before` (null = at the end). A room in a folder comes out of it. */
export function placeRoot(
  shape: RailShape,
  id: string,
  before: string | null,
): RailShape {
  const at = rootIndex(shape, id);
  const item = at >= 0 ? shape[at]! : { room: id };
  const rest =
    at >= 0 ? shape.filter((_, index) => index !== at) : without(shape, id);
  const anchor = anchorIn(shape, rest, before);
  const to = anchor === null ? rest.length : rootIndex(rest, anchor);
  const place = to < 0 ? rest.length : to;
  return [...rest.slice(0, place), item, ...rest.slice(place)];
}

/** A room into a folder, before `before` (null = last): from the rail, from another folder, or within its own. */
export function placeInFolder(
  shape: RailShape,
  room: string,
  folder: string,
  before: string | null,
): RailShape {
  const target = shape.find(
    (item) => "folder" in item && item.folder === folder,
  );
  if (!target || !("folder" in target)) return shape;
  const rest = target.rooms.includes(room)
    ? shape.map((item) =>
        "folder" in item && item.folder === folder
          ? { folder, rooms: item.rooms.filter((id) => id !== room) }
          : item,
      )
    : without(shape, room);
  return rest.map((item) => {
    if (!("folder" in item) || item.folder !== folder) return item;
    const rooms = [...item.rooms];
    const at = before === null ? -1 : rooms.indexOf(before);
    rooms.splice(at < 0 ? rooms.length : at, 0, room);
    return { folder, rooms };
  });
}

/** What the rail knows of one tile while something is dragged: its id, what it is, the folder it sits in (null = the
 *  rail), and its vertical extent. An open folder also gives its header tile. */
export type RailHit = {
  id: string;
  kind: "room" | "folder";
  in: string | null;
  top: number;
  bottom: number;
  /** An open folder's header tile (a closed folder is all tile). */
  head?: { top: number; bottom: number };
};
/** What a drop there does: a room on a room or a folder makes or joins a folder; else a place on the rail or in a
 *  folder, before an item (null = at the end). */
export type RailIntent =
  | { kind: "combine"; target: string }
  | { kind: "place"; in: string | null; before: string | null };

/**
 * Where a drop at height `y` lands (like Discord): the middle half of a tile means "together" (a room on a room makes
 * a folder, on a folder joins it); its top or bottom quarter means "before" or "after" it. Inside an open folder's
 * box, a room is placed among its rooms; out of the box, it is on the rail. `hits` are in rail order, without the
 * dragged item.
 */
export function dropIntent(
  source: { id: string; kind: "room" | "folder"; in: string | null },
  y: number,
  hits: readonly RailHit[],
): RailIntent | null {
  const roots = hits.filter((hit) => hit.in === null && hit.id !== source.id);
  if (!roots.length) return null;
  const nextRoot = (id: string) =>
    roots[roots.findIndex((hit) => hit.id === id) + 1]?.id ?? null;
  const tile = (hit: RailHit, top: number, bottom: number): RailIntent => {
    const at = (y - top) / Math.max(1, bottom - top);
    if (
      source.kind === "room" &&
      at >= 0.25 &&
      at <= 0.75 &&
      !(hit.kind === "folder" && hit.id === source.in)
    )
      return { kind: "combine", target: hit.id };
    return {
      kind: "place",
      in: null,
      before: at < 0.5 ? hit.id : nextRoot(hit.id),
    };
  };
  const block = roots.find((hit) => y >= hit.top && y <= hit.bottom);
  if (!block) {
    // In a gap: beside the nearest tile.
    const nearest = roots.reduce((best, hit) =>
      Math.min(Math.abs(y - hit.top), Math.abs(y - hit.bottom)) <
      Math.min(Math.abs(y - best.top), Math.abs(y - best.bottom))
        ? hit
        : best,
    );
    return {
      kind: "place",
      in: null,
      before: y < nearest.top ? nearest.id : nextRoot(nearest.id),
    };
  }
  if (!block.head) return tile(block, block.top, block.bottom);
  if (y <= block.head.bottom) {
    // An open folder's header: the top half is "before the folder", the rest "together" or "first in it".
    const intent = tile(block, block.head.top, block.head.bottom);
    if (
      intent.kind === "place" &&
      intent.before !== block.id &&
      source.kind === "room"
    ) {
      const first = hits.find(
        (hit) => hit.in === block.id && hit.id !== source.id,
      );
      return { kind: "place", in: block.id, before: first?.id ?? null };
    }
    return intent;
  }
  if (source.kind === "folder")
    return {
      kind: "place",
      in: null,
      before:
        y < (block.top + block.bottom) / 2 ? block.id : nextRoot(block.id),
    };
  const members = hits.filter(
    (hit) => hit.in === block.id && hit.id !== source.id,
  );
  if (!members.length) return { kind: "place", in: block.id, before: null };
  const member =
    members.find((hit) => y >= hit.top && y <= hit.bottom) ??
    members.reduce((best, hit) =>
      Math.abs(y - (hit.top + hit.bottom) / 2) <
      Math.abs(y - (best.top + best.bottom) / 2)
        ? hit
        : best,
    );
  const next = members[members.indexOf(member) + 1]?.id ?? null;
  return {
    kind: "place",
    in: block.id,
    before: y < (member.top + member.bottom) / 2 ? member.id : next,
  };
}

/** The rail after a drop with this intent. A new folder takes `folderId`. */
export function applyIntent(
  shape: RailShape,
  id: string,
  intent: RailIntent,
  folderId: string,
): RailShape {
  switch (intent.kind) {
    case "combine":
      return combine(shape, id, intent.target, folderId);
    case "place":
      return intent.in === null
        ? placeRoot(shape, id, intent.before)
        : placeInFolder(shape, id, intent.in, intent.before);
    default: {
      const unknown: never = intent;
      return unknown;
    }
  }
}

/** A place in the same list the item is in already (the rail, or its own folder): shown while dragging. A combine,
 *  or a move into or out of a folder, shows on the drop. */
export const previewable = (
  shape: RailShape,
  id: string,
  intent: RailIntent | null,
) => intent?.kind === "place" && intent.in === folderOf(shape, id);
