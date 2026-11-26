// Direct messages' pure rules, shared by the Worker (src/dm.ts) and its typed routes (src/api.ts), with no Worker types.

/** SQL for "f.a and f.b are connected" (a `friends f` row): both rows exist and neither was declined. A connection
 *  lets the two DM without sharing a room, so it takes both sides' yes. */
export const MUTUAL = `(f.declined_at IS NULL AND EXISTS (SELECT 1 FROM friends r WHERE r.a = f.b AND r.b = f.a AND r.declined_at IS NULL))`;

/** A DM room id: "dm" + 20 hex. Ordinary room ids are 12 hex, so they never start with "dm". */
export const isDmId = (id: string) => /^dm[0-9a-f]{20}$/.test(id);

/** The pair as stored on the room row: both emails, lower case, sorted, one per line (the same email twice for "Você"). */
export const pairKey = (a: string, b: string) =>
  [a.toLowerCase(), b.toLowerCase()].sort().join("\n");
