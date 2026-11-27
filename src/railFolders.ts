// Folders on the rail (like Discord's server folders), per person: rail_folders holds your folders (name, color,
// place on the rail) and members.rail_folder says which of your folders a room is in. Another member's rail never
// changes. Only D1 here, so the rules run in bun tests (scripts/rail-folders.test.ts).
import { RAIL_FOLDER_ID, TINTS, type MeFolder, type RailItem } from "../shared/schemas";

/** A folder's name: one line, no markup characters, at most 40 characters; empty = no name (the app says "Pasta"). */
export const folderName = (raw: string | null | undefined) =>
  (raw ?? "").replace(/\s+/g, " ").replace(/[<>"\p{Cc}]/gu, "").trim().slice(0, 40) || null;

/** Your folders on the rail, for /api/me. */
export async function railFolders(db: D1Database, email: string): Promise<MeFolder[]> {
  const rows = await db.prepare(`SELECT id, name, tint, position FROM rail_folders WHERE email = ? ORDER BY position`).bind(email).all<MeFolder>();
  return rows.results;
}

/**
 * Saves your whole rail in order: each room alone or in a folder. The rooms and folders get one position each, in
 * the order given (a folder's rooms follow it), so every list that sorts by position (the phone's, the room menu's
 * Move) keeps the rail's order. A folder with no rooms, or one that is not in `items`, is deleted, and its rooms
 * come out of it. Only your rows change; a room that is not yours, or a room given twice, is refused ("bad").
 */
export async function saveRail(db: D1Database, email: string, items: readonly RailItem[]): Promise<"ok" | "bad"> {
  const mine = new Set(
    (
      await db
        .prepare(`SELECT m.book_id AS id FROM members m JOIN books b ON b.id = m.book_id WHERE m.email = ? AND m.archived_at IS NULL AND b.dm IS NULL`)
        .bind(email)
        .all<{ id: string }>()
    ).results.map((row) => row.id),
  );
  const seen = new Set<string>(),
    folders = new Set<string>();
  for (const item of items) {
    const rooms = "room" in item ? [item.room] : item.rooms;
    if ("folder" in item) {
      if (!RAIL_FOLDER_ID.test(item.folder) || folders.has(item.folder)) return "bad";
      folders.add(item.folder);
    }
    for (const room of rooms) {
      if (!mine.has(room) || seen.has(room)) return "bad";
      seen.add(room);
    }
  }
  const room = db.prepare(`UPDATE members SET position = ?, rail_folder = ? WHERE book_id = ? AND email = ?`),
    folder = db.prepare(
      `INSERT INTO rail_folders (email, id, position, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (email, id) DO UPDATE SET position = excluded.position`,
    );
  const writes: D1PreparedStatement[] = [];
  const kept: string[] = [];
  let position = 0;
  for (const item of items) {
    if ("room" in item) {
      writes.push(room.bind(position++, null, item.room, email));
      continue;
    }
    if (!item.rooms.length) continue;
    kept.push(item.folder);
    writes.push(folder.bind(email, item.folder, position++, Date.now()));
    for (const id of item.rooms) writes.push(room.bind(position++, item.folder, id, email));
  }
  // Folders that are gone: their rows, and the folder on any of your rooms not listed (an archived one, say).
  const keptJson = JSON.stringify(kept);
  writes.push(
    db.prepare(`DELETE FROM rail_folders WHERE email = ? AND id NOT IN (SELECT value FROM json_each(?))`).bind(email, keptJson),
    db.prepare(`UPDATE members SET rail_folder = NULL WHERE email = ? AND rail_folder IS NOT NULL AND rail_folder NOT IN (SELECT value FROM json_each(?))`).bind(email, keptJson),
  );
  await db.batch(writes);
  return "ok";
}

/** "Configurações da pasta": its name and color. False = you have no such folder. */
export async function setRailFolder(db: D1Database, email: string, id: string, patch: { name?: string | null; tint?: string | null }) {
  const tint = (TINTS as readonly string[]).includes(patch.tint ?? "") ? patch.tint! : null;
  const r = await db.prepare(`UPDATE rail_folders SET name = ?, tint = ? WHERE email = ? AND id = ?`).bind(folderName(patch.name), tint, email, id).run();
  return (r.meta.changes ?? 0) > 0;
}
