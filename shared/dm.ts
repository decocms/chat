// Direct messages' pure rules, shared by the Worker (src/dm.ts) and its typed routes (src/api.ts), with no Worker types.

/** SQL for "f.b is a friend of f.a" (a `friends f` row): both rows exist. A friendship opens a DM, so it takes both sides. */
export const MUTUAL = `EXISTS (SELECT 1 FROM friends r WHERE r.a = f.b AND r.b = f.a)`;

/** A DM room id: "dm" + 20 hex. Ordinary room ids are 12 hex, so they never start with "dm". */
export const isDmId = (id: string) => /^dm[0-9a-f]{20}$/.test(id);

/** The pair as stored on the room row: both emails, lower case, sorted, one per line (the same email twice for "Você"). */
export const pairKey = (a: string, b: string) =>
  [a.toLowerCase(), b.toLowerCase()].sort().join("\n");
