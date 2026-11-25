// Rooms open to your company: a member can open a room to their company email domain (shared/dm.ts corporateDomain).
// Then anyone signed in with that domain sees its title and people on the home ("Da sua empresa") and joins it with
// one click, like an accepted invite. A DM never opens. Only D1 here, so the rules run in bun tests.
import { corporateDomain, isDmId } from "../shared/dm";
import type { OrgDirectoryRoom, OrgRoom } from "../shared/schemas";

/** The room is open to your domain, and is not a DM: asking to join it makes you a member at once. */
export async function openToMe(db: D1Database, roomId: string, email: string) {
  const domain = corporateDomain(email);
  if (!domain || isDmId(roomId)) return false;
  return !!(await db
    .prepare(`SELECT 1 FROM books WHERE id = ? AND org = ? AND dm IS NULL`)
    .bind(roomId, domain)
    .first());
}

/** Your company domain (null for a free provider) and the domain the room is open to (null = private). */
export async function roomOrg(db: D1Database, roomId: string, email: string) {
  const row = await db
    .prepare(`SELECT org FROM books WHERE id = ?`)
    .bind(roomId)
    .first<{ org: string | null }>();
  return { domain: corporateDomain(email), org: row?.org ?? null };
}

/** Opens the room to your domain, or closes it. People who joined stay members. The caller checks membership. */
export async function setRoomOrg(
  db: D1Database,
  roomId: string,
  email: string,
  open: boolean,
): Promise<"dm" | "no_domain" | { org: string | null }> {
  if (isDmId(roomId)) return "dm";
  const domain = corporateDomain(email);
  if (open && !domain) return "no_domain";
  await db
    .prepare(`UPDATE books SET org = ?, org_by = ? WHERE id = ? AND dm IS NULL`)
    .bind(open ? domain : null, open ? email : null, roomId)
    .run();
  return { org: open ? domain : null };
}

/** The rooms open to your domain where you are not a member yet, newest first: only their cover, never content. */
export async function orgRooms(
  db: D1Database,
  email: string,
): Promise<{ domain: string | null; rooms: OrgRoom[] }> {
  const domain = corporateDomain(email);
  if (!domain) return { domain, rooms: [] };
  const rooms = (
    await db
      .prepare(
        `SELECT b.id, b.title, b.icon, b.org_by AS opened_by, u.name AS opened_by_name,
                (SELECT count(*) FROM members m WHERE m.book_id = b.id) AS people
           FROM books b LEFT JOIN users u ON u.email = b.org_by
          WHERE b.org = ?1 AND b.dm IS NULL
            AND NOT EXISTS (SELECT 1 FROM members m WHERE m.book_id = b.id AND m.email = ?2)
          ORDER BY b.updated_at DESC LIMIT 50`,
      )
      .bind(domain, email)
      .all<OrgRoom>()
  ).results;
  return { domain, rooms };
}

/** Every room open to your domain, the ones you are in too (`member`), by title: the rail's "Salas da empresa".
 *  Only covers, never content; a room open to another domain, a private room or a DM never shows. */
export async function orgDirectory(
  db: D1Database,
  email: string,
): Promise<{ domain: string | null; rooms: OrgDirectoryRoom[] }> {
  const domain = corporateDomain(email);
  if (!domain) return { domain, rooms: [] };
  const rows = (
    await db
      .prepare(
        `SELECT b.id, b.title, b.icon,
                (SELECT count(*) FROM members m WHERE m.book_id = b.id) AS people,
                EXISTS (SELECT 1 FROM members m WHERE m.book_id = b.id AND m.email = ?2) AS member
           FROM books b
          WHERE b.org = ?1 AND b.dm IS NULL
          ORDER BY b.title COLLATE NOCASE LIMIT 200`,
      )
      .bind(domain, email)
      .all<Omit<OrgDirectoryRoom, "member"> & { member: number }>()
  ).results;
  return {
    domain,
    rooms: rows.map((row) => ({ ...row, member: !!row.member })),
  };
}

/** What `requestAccess` needs from the Worker, so the rule runs without its bindings. */
export type AccessPorts = {
  db: D1Database;
  isMember(roomId: string): Promise<boolean>;
  /** Puts you in the room (src/rooms.ts joinRoom). */
  join(roomId: string): Promise<void>;
  /** Per-person rate limit for asking: false = over it. */
  allowAsk(): Promise<boolean>;
  /** Tells the room's members once that you asked. */
  told(roomId: string): Promise<void>;
  track(name: "access_requested" | "org_room_joined", roomId: string): void;
};

/** Ask to join a room: unknown room, already a member, over the rate limit, or asked (the members are told once).
 *  A room open to your company domain lets you in at once. */
export async function requestAccess(
  p: AccessPorts,
  roomId: string,
  email: string,
): Promise<"not_found" | "member" | "limited" | "asked"> {
  // A DM can't be asked into (src/dm.ts): to anyone outside it, it doesn't exist.
  if (
    isDmId(roomId) ||
    !(await p.db
      .prepare(`SELECT 1 FROM books WHERE id = ?`)
      .bind(roomId)
      .first())
  )
    return "not_found";
  if (await p.isMember(roomId)) return "member";
  if (await openToMe(p.db, roomId, email)) {
    await p.join(roomId);
    p.track("org_room_joined", roomId);
    return "member";
  }
  if (!(await p.allowAsk())) return "limited";
  const r = await p.db
    .prepare(
      `INSERT OR IGNORE INTO access_requests (book_id, email, ts) VALUES (?, ?, ?)`,
    )
    .bind(roomId, email, Date.now())
    .run();
  if (r.meta.changes) {
    await p.told(roomId);
    p.track("access_requested", roomId);
  }
  return "asked";
}
