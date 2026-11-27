// Agents as people (Gimenes #6283, #6327, Nov 2026): an agent is a record of its person (agent_personas): a name (its
// @ in every room), the machine that runs it and its kind (claude, codex…). Each has its own switch in each room
// (persona_rooms). A process that runs it (agents.persona_id) wakes only where that switch is on (src/delivery.ts).
//
// Migration: a machine's runner that checks in with no agent yet gets one (`claude`, or the kind it runs), marked
// `main`. A main agent follows the room's old switches: its rows are copied from machine_rooms, and a room with no row
// follows members.claude_on ("Ligar Claude"), as the machine did. An agent the person adds has explicit rows only
// (no row = off).

import {
  AGENT_KINDS,
  type AgentKind,
  machineKinds,
} from "../shared/agentKinds";
import { freeName } from "../shared/agentNames";
import { PERSONA_ON } from "./delivery";

/** The part of D1 this file uses (it is also type-checked without the Workers types, for its tests). */
type Stmt = {
  bind(...values: unknown[]): Stmt;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
};
type Db = {
  prepare(sql: string): Stmt;
  batch(statements: Stmt[]): Promise<unknown>;
};

export const PERSONA_ID = /^p_[a-f0-9]{32}$/;
/** An agent's name: its @ in rooms. Lowercase, starts with a letter, up to 24 characters. */
export const PERSONA_NAME = /^[a-z][a-z0-9-]{0,23}$/;

export type Persona = {
  id: string;
  email: string;
  name: string;
  machine_id: string;
  kind: AgentKind;
  main: number;
  created_at: number;
};

const newId = () =>
  `p_${[...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
export const isKind = (k: unknown): k is AgentKind =>
  typeof k === "string" && (AGENT_KINDS as readonly string[]).includes(k);

/** The person's agents. */
export const personasOf = async (db: Db, email: string) =>
  (
    await db
      .prepare(
        `SELECT * FROM agent_personas WHERE email = ? ORDER BY created_at`,
      )
      .bind(email)
      .all<Persona>()
  ).results;

/** A machine whose runner opens `kind` and has no agent of that kind gets its main one (see the top of this file).
 *  Returns the machine's agents. */
export async function ensurePersonas(
  db: Db,
  email: string,
  machine: string,
  kind: AgentKind,
): Promise<Persona[]> {
  const mine = await personasOf(db, email);
  const here = mine.filter((p) => p.machine_id === machine);
  if (here.some((p) => p.kind === kind)) return here;
  const p: Persona = {
    id: newId(),
    email,
    name: freeName(
      kind,
      mine.map((x) => x.name),
    ),
    machine_id: machine,
    kind,
    main: 1,
    created_at: Date.now(),
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO agent_personas (id, email, name, machine_id, kind, main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(p.id, p.email, p.name, p.machine_id, p.kind, p.main, p.created_at),
    db
      .prepare(
        `INSERT OR IGNORE INTO persona_rooms (persona_id, book_id, on_) SELECT ?, book_id, on_ FROM machine_rooms WHERE machine_id = ?`,
      )
      .bind(p.id, machine),
  ]);
  // Two check-ins at once: the unique name made one of them a no-op. Read what is there.
  return (await personasOf(db, email)).filter((x) => x.machine_id === machine);
}

/** A runner's rooms (claude_rooms): each room is on when one of the machine's agents is on there: the one the runner
 *  runs (?4 persona), else the ones of its kind (?5), else all of them (an older runner). listening: that agent, or
 *  any of the person's agents, waited on the room since ?1. Binds (since, email, machine, persona or '', kind or ''). */
export const MACHINE_ROOMS_SQL = `SELECT b.id, b.title,
    EXISTS (SELECT 1 FROM agent_personas p LEFT JOIN persona_rooms pr ON pr.persona_id = p.id AND pr.book_id = b.id
      WHERE p.machine_id = ?3 AND (?4 = '' OR p.id = ?4) AND (?5 = '' OR p.kind = ?5) AND ${PERSONA_ON} = 1) AS claude_on,
    EXISTS (SELECT 1 FROM agents a WHERE a.email = m.email AND a.listening_at > ?1 AND (a.listen_room = b.id OR a.listen_room IS NULL)
      AND (?4 = '' OR a.persona_id = ?4)) AS listening
  FROM members m JOIN books b ON b.id = m.book_id
  WHERE m.email = ?2 AND m.archived_at IS NULL AND (m.claude_on IS NOT NULL
    OR EXISTS (SELECT 1 FROM persona_rooms pr JOIN agent_personas p ON p.id = pr.persona_id WHERE p.machine_id = ?3 AND pr.book_id = b.id))
  ORDER BY m.position IS NULL, m.position, b.created_at`;

export type PersonaError = { error: string; status: 400 | 404 | 409 };

/** Add an agent: a machine of the person, a kind that machine has (machines.kinds; an older CLI sent none, then only
 *  claude), and a free name. On in `book` when given. */
export async function createPersona(
  db: Db,
  email: string,
  input: { machine: string; kind: string; name?: string; book?: string },
): Promise<Persona | PersonaError> {
  const m = await db
    .prepare(`SELECT kinds FROM machines WHERE id = ? AND email = ?`)
    .bind(input.machine, email)
    .first<{ kinds: string | null }>();
  if (!m) return { error: "not your machine", status: 404 };
  if (!isKind(input.kind)) return { error: "unknown kind", status: 400 };
  let kinds: ReturnType<typeof machineKinds> = null;
  try {
    kinds = m.kinds ? machineKinds(JSON.parse(m.kinds)) : null;
  } catch {}
  if (!(kinds ? input.kind in kinds : input.kind === "claude"))
    return { error: "that machine does not have this agent", status: 400 };
  const mine = await personasOf(db, email);
  const name =
    (input.name ?? "").trim().toLowerCase() ||
    freeName(
      input.kind,
      mine.map((x) => x.name),
    );
  if (!PERSONA_NAME.test(name))
    return { error: "a name is lowercase letters, digits and -", status: 400 };
  if (mine.some((x) => x.name === name))
    return { error: "you already have an agent with this name", status: 409 };
  const p: Persona = {
    id: newId(),
    email,
    name,
    machine_id: input.machine,
    kind: input.kind,
    main: 0,
    created_at: Date.now(),
  };
  await db
    .prepare(
      `INSERT INTO agent_personas (id, email, name, machine_id, kind, main, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(p.id, p.email, p.name, p.machine_id, p.kind, p.main, p.created_at)
    .run();
  if (input.book) await setPersonaRoom(db, p.id, input.book, true);
  return p;
}

/** Rename one of the person's agents. Its processes take the new @ at their next call (src/agentNames.ts). */
export async function renamePersona(
  db: Db,
  email: string,
  id: string,
  raw: string,
): Promise<{ ok: true } | PersonaError> {
  const name = raw.trim().toLowerCase();
  if (!PERSONA_NAME.test(name))
    return { error: "a name is lowercase letters, digits and -", status: 400 };
  const mine = await personasOf(db, email);
  if (!mine.some((x) => x.id === id))
    return { error: "not your agent", status: 404 };
  if (mine.some((x) => x.name === name && x.id !== id))
    return { error: "you already have an agent with this name", status: 409 };
  await db
    .prepare(`UPDATE agent_personas SET name = ? WHERE id = ? AND email = ?`)
    .bind(name, id, email)
    .run();
  return { ok: true };
}

/** Remove one of the person's agents and its switches. Its processes stop waking (they fall back to no agent). */
export async function deletePersona(
  db: Db,
  email: string,
  id: string,
): Promise<{ ok: true } | PersonaError> {
  const r = await db
    .prepare(`DELETE FROM agent_personas WHERE id = ? AND email = ?`)
    .bind(id, email)
    .run();
  if (!r.meta.changes) return { error: "not your agent", status: 404 };
  await db.batch([
    db.prepare(`DELETE FROM persona_rooms WHERE persona_id = ?`).bind(id),
    db
      .prepare(`UPDATE agents SET persona_id = NULL WHERE persona_id = ?`)
      .bind(id),
  ]);
  return { ok: true };
}

/** One agent's switch in one room. */
export const setPersonaRoom = (
  db: Db,
  persona: string,
  book: string,
  on: boolean,
) =>
  db
    .prepare(
      `INSERT OR REPLACE INTO persona_rooms (persona_id, book_id, on_) VALUES (?, ?, ?)`,
    )
    .bind(persona, book, on ? 1 : 0)
    .run();
