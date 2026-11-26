// Delivery (Nov 2026): whether an agent wakes for a room's messages. An agent opened by a machine follows that
// machine's switch in the room (machine_rooms; none = the person's members.claude_on, a sandbox = on); a one-off agent
// (no machine) has its own (agent_rooms; none = on). Off = listening skips the room for it; reading and posting still
// work. The SQL needs `ag` (agents), `m` (the agent's person's members row) and the room id expression.

/** LEFT JOINs that DELIVERS reads, for the room id expression `book` (e.g. `b.id`, `?1`). */
export const deliveryJoins = (book: string) =>
  `LEFT JOIN machine_rooms mr ON mr.machine_id = ag.machine_id AND mr.book_id = ${book}
   LEFT JOIN agent_rooms dr ON dr.agent = ag.id AND dr.book_id = ${book}`;

/** 1 = deliver, 0 = muted. */
export const DELIVERS = `(CASE WHEN ag.machine_id LIKE 'sb!_%' ESCAPE '!' THEN coalesce(mr.on_, 1)
  WHEN ag.machine_id IS NOT NULL THEN coalesce(mr.on_, m.claude_on, 1)
  ELSE coalesce(dr.delivery, 1) END)`;

/** Machine ids the CLI makes (`m_` + 32 hex, ~/.vibebook/machine.json) and sandboxes (`sb_<sandbox id>`). */
export const MACHINE_ID = /^m_[a-f0-9]{32}$/;
export const sandboxMachine = (sandboxId: string) => `sb_${sandboxId}`;
/** A machine that checked in within this long is online. The runner asks claude_rooms at least every 5 min. */
export const MACHINE_FRESH = 7 * 60_000;

/** The menu bar app counts as installed while one of the person's "app" machines (its runner sends kind app) was seen
 *  within this long (Gimenes #5843). */
export const APP_FRESH = 30 * 864e5;
/** Binds (email, the oldest seen_at that counts). */
export const APP_SQL = `SELECT 1 AS x FROM machines WHERE email = ? AND kind = 'app' AND seen_at > ? LIMIT 1`;
const appSeen = new Map<string, { at: number; app: boolean }>();
/** True when this person runs the deco.chat menu bar app on a computer. Cached per isolate for 10 min. */
/** The part of D1 that hasApp uses (this file is also type-checked without the Workers types). */
type FirstDb = { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null> } } };
export async function hasApp(db: FirstDb, email: string): Promise<boolean> {
  const hit = appSeen.get(email);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.app;
  const row = await db
    .prepare(APP_SQL)
    .bind(email, Date.now() - APP_FRESH)
    .first<{ x: number }>();
  if (appSeen.size > 20_000) appSeen.clear();
  appSeen.set(email, { at: Date.now(), app: !!row });
  return !!row;
}
/** A runner in the app just checked in: this isolate stops answering from an old "no app". */
export const appCheckedIn = (email: string) => appSeen.set(email, { at: Date.now(), app: true });
