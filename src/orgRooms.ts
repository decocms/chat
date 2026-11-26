// Rooms open to your company: a member can open a room to their company email domain (shared/dm.ts corporateDomain).
// Then anyone signed in with that domain sees its title and people on the home ("Da sua empresa") and joins it with
// one click, like an accepted invite. A DM never opens. Only D1 here, so the rules run in bun tests.
import { corporateDomain, isDmId } from "../shared/dm";
import type { OrgRoom } from "../shared/schemas";

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

/** Opens the room to your domain, or closes it. People who joined stay members. The caller checks membership.
 *  `org_at` is when it opened: the grid button marks rooms opened after you last looked as new. */
export async function setRoomOrg(
  db: D1Database,
  roomId: string,
  email: string,
  open: boolean,
  now = Date.now(),
): Promise<"dm" | "no_domain" | { org: string | null }> {
  if (isDmId(roomId)) return "dm";
  const domain = corporateDomain(email);
  if (open && !domain) return "no_domain";
  await db
    .prepare(
      `UPDATE books SET org = ?1, org_by = ?2,
              org_at = CASE WHEN ?1 IS NULL THEN NULL WHEN org IS ?1 THEN org_at ELSE ?3 END
        WHERE id = ?4 AND dm IS NULL`,
    )
    .bind(open ? domain : null, open ? email : null, now, roomId)
    .run();
  return { org: open ? domain : null };
}

/** The rooms open to your domain where you are not a member yet, unseen first, then newest: only their cover, never
 *  content. A room opened to the company after you last looked at the list (`users.org_seen_at`) is `new`. The first
 *  read starts that marker at now, so rooms opened before this shipped are never new. */
export async function orgRooms(
  db: D1Database,
  email: string,
  now = Date.now(),
): Promise<{ domain: string | null; rooms: OrgRoom[] }> {
  const domain = corporateDomain(email);
  if (!domain) return { domain, rooms: [] };
  let seen = (
    await db
      .prepare(`SELECT org_seen_at FROM users WHERE email = ?`)
      .bind(email)
      .first<{ org_seen_at: number | null }>()
  )?.org_seen_at;
  if (seen == null) {
    seen = now;
    await db
      .prepare(
        `UPDATE users SET org_seen_at = ? WHERE email = ? AND org_seen_at IS NULL`,
      )
      .bind(now, email)
      .run();
  }
  const rows = (
    await db
      .prepare(
        `SELECT b.id, b.title, b.icon, b.org_by AS opened_by, u.name AS opened_by_name, b.org_at AS opened_at,
                (SELECT count(*) FROM members m WHERE m.book_id = b.id) AS people
           FROM books b LEFT JOIN users u ON u.email = b.org_by
          WHERE b.org = ?1 AND b.dm IS NULL
            AND NOT EXISTS (SELECT 1 FROM members m WHERE m.book_id = b.id AND m.email = ?2)
          ORDER BY (COALESCE(b.org_at, 0) > ?3) DESC, b.updated_at DESC LIMIT 50`,
      )
      .bind(domain, email, seen)
      .all<Omit<OrgRoom, "new">>()
  ).results;
  const rooms = rows.map((room) => ({
    ...room,
    new: room.opened_at != null && room.opened_at > seen,
  }));
  return { domain, rooms };
}

/** You looked at the list: rooms opened up to `until` (the newest one it showed) are no longer new. Never moves back,
 *  never past now. */
export async function seeOrgRooms(
  db: D1Database,
  email: string,
  until: number,
  now = Date.now(),
) {
  await db
    .prepare(
      `UPDATE users SET org_seen_at = MAX(COALESCE(org_seen_at, 0), ?) WHERE email = ?`,
    )
    .bind(Math.min(until, now), email)
    .run();
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
