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
