// The room's change log (Gimenes #6112, #6148): one row per changed thing, with the newest `rev` (a counter that only
// grows). SQLite triggers write it, so no write path can forget it. A room open sends the current `rev`; a reconnect
// sends it back and gets the messages changed since then from this log, not from the edited/deleted clocks.
//
// One row per thing (UNIQUE kind, ref; a change deletes its row and inserts a new rev), not one row per change: the log is at most
// as long as the room has things, so it needs no pruning, and any old rev still finds every change after it.

/** A kind of thing in the log. `ref` is its id (an epic's tasks log as their epic). */
export type ChangeKind =
  | "message"
  | "ack"
  | "epic"
  | "file"
  | "pin"
  | "reminder"
  | "poll"
  | "decision"
  | "doc";

/** Milliseconds now, in SQLite (unixepoch('subsec') needs 3.42; julianday works everywhere). */
const NOW_MS = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";

// Delete, then insert: inside a trigger the outer statement's conflict policy replaces the trigger's own (SQLite
// "lang_conflict"), so an INSERT OR REPLACE here aborted under an upsert of meta (call.test caught it).
const log = (kind: ChangeKind, ref: string) =>
  `DELETE FROM changes WHERE kind = '${kind}' AND ref = ${ref}; INSERT INTO changes (kind, ref, ts) VALUES ('${kind}', ${ref}, ${NOW_MS});`;

/** One AFTER trigger per table and event. `ref` is an SQL expression on NEW (or OLD for a delete). */
function triggers(
  table: string,
  kind: ChangeKind,
  ref: (row: "NEW" | "OLD") => string,
  when?: (row: "NEW" | "OLD") => string,
) {
  return (["INSERT", "UPDATE", "DELETE"] as const)
    .map((event) => {
      const row = event === "DELETE" ? "OLD" : "NEW";
      const name = `changes_${table}_${event[0].toLowerCase()}`;
      return `CREATE TRIGGER IF NOT EXISTS ${name} AFTER ${event} ON ${table}${when ? ` WHEN ${when(row)}` : ""} BEGIN ${log(kind, ref(row))} END;`;
    })
    .join("\n");
}

/** A doc lives in meta: the room's under `doc`, an epic's under `doc:<epic id>`. Other meta keys are not logged. */
const isDoc = (row: "NEW" | "OLD") =>
  `(${row}.k = 'doc' OR ${row}.k LIKE 'doc:%')`;

/** The log and its triggers. Run after the tables exist; every statement is IF NOT EXISTS. */
export const CHANGES_SQL = [
  `CREATE TABLE IF NOT EXISTS changes (rev INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, ref TEXT NOT NULL, ts INTEGER, UNIQUE (kind, ref));`,
  triggers("messages", "message", (r) => `${r}.id`),
  triggers("acks", "ack", (r) => `${r}.msg_id`),
  triggers("epics", "epic", (r) => `${r}.id`),
  triggers("tasks", "epic", (r) => `${r}.epic_id`),
  triggers("files", "file", (r) => `${r}.id`),
  triggers("pins", "pin", (r) => `${r}.id`),
  triggers("reminders", "reminder", (r) => `${r}.id`),
  triggers("polls", "poll", (r) => `${r}.id`),
  triggers("votes", "poll", (r) => `${r}.poll_id`),
  triggers("decisions", "decision", (r) => `${r}.id`),
  triggers("meta", "doc", (r) => `${r}.k`, isDoc),
].join("\n");

/** The newest rev of the room (0 before the first change). */
export const CURRENT_REV_SQL = `SELECT coalesce(max(rev), 0) AS rev FROM changes`;

/** The ids of the messages changed after a rev (new, edited, deleted, reacted to). */
export const MESSAGES_SINCE_REV_SQL = `SELECT CAST(ref AS INTEGER) FROM changes WHERE kind = 'message' AND rev > ?`;

/** The other things changed after a rev: their kinds, and which docs (`doc`, `doc:<epic id>`). */
export const CHANGED_SINCE_REV_SQL = `SELECT DISTINCT kind, CASE WHEN kind = 'doc' THEN ref ELSE '' END AS ref FROM changes WHERE rev > ? AND kind NOT IN ('message', 'ack')`;

/** What changed after the app's rev (Gimenes #6240): a resume leaves out every list with no change, and the app keeps
 *  its own (web/app/roomStore.ts merges a resume over the room it has). */
export function changedSince(rows: readonly { kind: string; ref: string }[]) {
  const kinds = new Set(rows.map((r) => r.kind)),
    docs = new Set(rows.filter((r) => r.kind === "doc").map((r) => r.ref));
  return {
    has: (kind: ChangeKind) => kinds.has(kind),
    doc: (key: string) => docs.has(key),
  };
}
export type ChangedSince = ReturnType<typeof changedSince>;

/** A rev from a client that this room can answer: a whole number, not above the newest one (a higher one is from a
 *  room this Book does not have, e.g. after a restore). */
export function validRev(raw: string | null, current: number): number | null {
  if (raw === null || raw === "") return null;
  const rev = Number(raw);
  return Number.isSafeInteger(rev) && rev >= 0 && rev <= current ? rev : null;
}
