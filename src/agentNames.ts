// Agent names (Gimenes #5472, #5506, Nov 2026): every agent that listens in a room has an @name there, so its human
// can call one of their agents when they have two. Without a role it is its client (`claude`, `codex`); the second of
// the same person in the room is `claude-2`, then `claude-3`. With `--role reviewer` it is `reviewer`. Names are per
// person: `@claude` in Viktor's message is Viktor's Claude, never yours. A name is kept per agent and room
// (agent_rooms.name), so a Claude that restarts comes back as itself; one quiet for days frees its name.
//
// One Primary per person and room: the active agent without a role with the lowest name (`claude` before `claude-2`,
// `claude` before `codex`). Only the Primary gets what its human writes without an @; the others wake for their
// @name (shared/roles.ts wakes).

import { LISTEN_FRESH } from "./person";
import { NAME_KEEP, baseName, byName, freeName } from "../shared/agentNames";

export type Self = {
  /** This agent's @name in the room. */
  name: string;
  /** It gets its human's messages that name no agent. */
  primary: boolean;
  /** The @names of its human's other agents in the room (to leave their messages to them). */
  others: string[];
};

type Row = { agent: string; name: string | null; role: string | null; listening_at: number | null; listen_room: string | null; seen_at: number | null };

/** This agent's name in the room (given on first use and kept), whether it is its human's Primary there, and the
 *  names of the human's other agents there. Two D1 reads; a write only the first time. */
export async function selfIn(
  db: D1Database,
  me: { agent: string; email: string; role?: string | null; client?: string | null },
  book: string,
  now = Date.now(),
): Promise<Self> {
  const rows = (
    await db
      .prepare(
        `SELECT a.id AS agent, ar.name, a.role, a.listening_at, a.listen_room, a.seen_at FROM agents a JOIN agent_rooms ar ON ar.agent = a.id AND ar.book_id = ?
         WHERE a.email = ? AND ar.name IS NOT NULL`,
      )
      .bind(book, me.email)
      .all<Row>()
  ).results;
  const kept = rows.filter((r) => r.agent !== me.agent && now - (r.seen_at ?? r.listening_at ?? 0) < NAME_KEEP);
  let name = me.role || rows.find((r) => r.agent === me.agent)?.name || null;
  // A role is its name; a kept name a newer agent took meanwhile (it was quiet for days) is given again.
  if (!me.role && (!name || kept.some((r) => r.name === name))) name = freeName(baseName(me.client), kept.map((r) => r.name!));
  if (rows.find((r) => r.agent === me.agent)?.name !== name)
    await db
      .prepare(`INSERT INTO agent_rooms (agent, book_id, name) VALUES (?, ?, ?) ON CONFLICT(agent, book_id) DO UPDATE SET name = excluded.name`)
      .bind(me.agent, book, name)
      .run();
  // Listening now, to this room or to all of theirs.
  const active = kept.filter((r) => r.listening_at && now - r.listening_at < LISTEN_FRESH && (!r.listen_room || r.listen_room === book));
  // The caller is active (it is calling). A role agent is never the Primary.
  const primary = !me.role && !active.some((r) => !r.role && byName(r.name!, name!) < 0);
  return { name: name!, primary, others: [...new Set(kept.map((r) => r.name!))] };
}
