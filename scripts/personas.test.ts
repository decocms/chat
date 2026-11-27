// Agents as people (src/personas.ts, Gimenes #6283, #6327): the migration of a machine to its main agent, each
// agent's switch per room in DELIVERS (src/delivery.ts), and the agent's name in the room (src/agentNames.ts).
// D1 is a bun:sqlite stand-in.
import { Database } from "bun:sqlite";
import { expect, mock, test } from "bun:test";
import { DELIVERS, deliveryJoins } from "../src/delivery";
import {
  createPersona,
  deletePersona,
  ensurePersonas,
  MACHINE_ROOMS_SQL,
  renamePersona,
  setPersonaRoom,
} from "../src/personas";

// src/agentNames.ts reads LISTEN_FRESH from src/person.ts, which imports the Workers runtime.
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { selfIn } = await import("../src/agentNames");

function d1(sqlite: Database) {
  const prep = (sql: string) => {
    let args: unknown[] = [];
    const st = {
      bind(...values: unknown[]) {
        args = values;
        return st;
      },
      async first() {
        return sqlite.query(sql).get(...(args as never[])) ?? null;
      },
      async all() {
        return { results: sqlite.query(sql).all(...(args as never[])) };
      },
      async run() {
        const r = sqlite.query(sql).run(...(args as never[]));
        return { meta: { changes: r.changes } };
      },
    };
    return st;
  };
  return {
    prepare: prep,
    async batch(sts: { run(): Promise<unknown> }[]) {
      for (const s of sts) await s.run();
    },
  } as unknown as D1Database;
}

const ME = "me@test.local";
const MAC = `m_${"a".repeat(32)}`;
const PC = `m_${"b".repeat(32)}`;
const ROOM_A = "roomaaaaaaaa",
  ROOM_B = "roombbbbbbbb";

function world() {
  const sqlite = new Database(":memory:");
  for (const q of [
    `CREATE TABLE agents (id TEXT PRIMARY KEY, email TEXT, client TEXT, role TEXT, machine_id TEXT, persona_id TEXT, listening_at INTEGER, listen_room TEXT, seen_at INTEGER)`,
    `CREATE TABLE members (book_id TEXT, email TEXT, claude_on INTEGER, archived_at INTEGER, position INTEGER)`,
    `CREATE TABLE books (id TEXT PRIMARY KEY, title TEXT, created_at INTEGER)`,
    `CREATE TABLE machines (id TEXT PRIMARY KEY, email TEXT, name TEXT, kind TEXT, kinds TEXT, seen_at INTEGER, created_at INTEGER)`,
    `CREATE TABLE machine_rooms (machine_id TEXT, book_id TEXT, on_ INTEGER, PRIMARY KEY (machine_id, book_id))`,
    `CREATE TABLE agent_rooms (agent TEXT, book_id TEXT, delivery INTEGER, name TEXT, PRIMARY KEY (agent, book_id))`,
    `CREATE TABLE agent_personas (id TEXT PRIMARY KEY, email TEXT, name TEXT, machine_id TEXT, kind TEXT, main INTEGER, created_at INTEGER)`,
    `CREATE UNIQUE INDEX agent_personas_name ON agent_personas (email, name)`,
    `CREATE TABLE persona_rooms (persona_id TEXT, book_id TEXT, on_ INTEGER, PRIMARY KEY (persona_id, book_id))`,
  ])
    sqlite.run(q);
  sqlite.run(
    `INSERT INTO members (book_id, email, claude_on) VALUES (?, ?, 1), (?, ?, NULL)`,
    [ROOM_A, ME, ROOM_B, ME],
  );
  sqlite.run(`INSERT INTO books VALUES (?, 'A', 1), (?, 'B', 2)`, [
    ROOM_A,
    ROOM_B,
  ]);
  sqlite.run(
    `INSERT INTO machines VALUES (?, ?, 'mac', 'app', ?, 1, 1), (?, ?, 'pc', 'herdr', NULL, 1, 1)`,
    [MAC, ME, JSON.stringify({ claude: "2.1.332", codex: "0.170.0" }), PC, ME],
  );
  const delivers = (agent: string, book: string) =>
    (
      sqlite
        .query(
          `SELECT ${DELIVERS} AS d FROM agents ag JOIN members m ON m.email = ag.email AND m.book_id = ?1 ${deliveryJoins("?1")} WHERE ag.id = ?2`,
        )
        .get(book, agent) as { d: number }
    ).d;
  const agent = (
    id: string,
    client: string,
    machine: string | null,
    persona: string | null = null,
  ) =>
    sqlite.run(
      `INSERT INTO agents (id, email, client, machine_id, persona_id, seen_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, ME, client, machine, persona, Date.now()],
    );
  return { sqlite, db: d1(sqlite), delivers, agent };
}

test("a machine's first check-in makes its main agent, with the machine's switches", async () => {
  const w = world();
  w.sqlite.run(`INSERT INTO machine_rooms VALUES (?, ?, 0)`, [MAC, ROOM_A]);
  const [p] = await ensurePersonas(w.db, ME, MAC, "claude");
  expect(p).toMatchObject({
    name: "claude",
    kind: "claude",
    main: 1,
    machine_id: MAC,
  });
  // Again: no second one.
  expect(await ensurePersonas(w.db, ME, MAC, "claude")).toHaveLength(1);
  // A second machine of the same person: claude-2.
  const [q] = await ensurePersonas(w.db, ME, PC, "claude");
  expect(q.name).toBe("claude-2");
  // A codex runner on the Mac: its own agent.
  const both = await ensurePersonas(w.db, ME, MAC, "codex");
  expect(both.map((x) => x.name).sort()).toEqual(["claude", "codex"]);

  w.agent("s_1", "claude-code", MAC, p.id);
  // Room A: the machine was off there (copied row). Room B: no row, claude_on NULL → on (as the machine was).
  expect(w.delivers("s_1", ROOM_A)).toBe(0);
  expect(w.delivers("s_1", ROOM_B)).toBe(1);
  await setPersonaRoom(w.db, p.id, ROOM_A, true);
  expect(w.delivers("s_1", ROOM_A)).toBe(1);
});

test("an agent the person adds is off where it has no row, and on where they turn it on", async () => {
  const w = world();
  const r = await createPersona(w.db, ME, {
    machine: MAC,
    kind: "codex",
    name: "Reviewer",
    book: ROOM_A,
  });
  if ("error" in r) throw new Error(r.error);
  expect(r.name).toBe("reviewer");
  w.agent("s_2", "codex", MAC, r.id);
  expect(w.delivers("s_2", ROOM_A)).toBe(1);
  expect(w.delivers("s_2", ROOM_B)).toBe(0);
});

test("adding an agent checks the machine, the kind and the name", async () => {
  const w = world();
  expect(
    await createPersona(w.db, "other@test.local", {
      machine: MAC,
      kind: "claude",
    }),
  ).toMatchObject({ status: 404 });
  expect(
    await createPersona(w.db, ME, { machine: MAC, kind: "vim" }),
  ).toMatchObject({ status: 400 });
  // The Mac has claude and codex, not agy.
  expect(
    await createPersona(w.db, ME, { machine: MAC, kind: "agy" }),
  ).toMatchObject({ status: 400 });
  // The PC sent no kinds (an older CLI): claude only.
  expect(
    await createPersona(w.db, ME, { machine: PC, kind: "codex" }),
  ).toMatchObject({ status: 400 });
  expect(
    await createPersona(w.db, ME, { machine: PC, kind: "claude" }),
  ).toMatchObject({ name: "claude" });
  expect(
    await createPersona(w.db, ME, { machine: MAC, kind: "claude" }),
  ).toMatchObject({ name: "claude-2" });
  expect(
    await createPersona(w.db, ME, {
      machine: MAC,
      kind: "claude",
      name: "claude",
    }),
  ).toMatchObject({ status: 409 });
  expect(
    await createPersona(w.db, ME, {
      machine: MAC,
      kind: "claude",
      name: "9 bad",
    }),
  ).toMatchObject({ status: 400 });
});

test("rename and remove: only your own; a removed agent's process falls back to its machine", async () => {
  const w = world();
  const [p] = await ensurePersonas(w.db, ME, MAC, "claude");
  const r = await createPersona(w.db, ME, { machine: MAC, kind: "codex" });
  if ("error" in r) throw new Error(r.error);
  expect(await renamePersona(w.db, ME, p.id, "codex")).toMatchObject({
    status: 409,
  });
  expect(
    await renamePersona(w.db, "other@test.local", p.id, "x"),
  ).toMatchObject({ status: 404 });
  expect(await renamePersona(w.db, ME, p.id, "boss")).toEqual({ ok: true });
  w.agent("s_3", "codex", MAC, r.id);
  expect(w.delivers("s_3", ROOM_B)).toBe(0);
  expect(await deletePersona(w.db, ME, r.id)).toEqual({ ok: true });
  // No agent now: the machine's switch (no row, claude_on NULL → on).
  expect(w.delivers("s_3", ROOM_B)).toBe(1);
  expect(await deletePersona(w.db, ME, r.id)).toMatchObject({ status: 404 });
});

test("a process of an agent takes its name in the room; another process does not take it", async () => {
  const w = world();
  const [p] = await ensurePersonas(w.db, ME, MAC, "claude");
  await renamePersona(w.db, ME, p.id, "boss");
  w.agent("s_4", "claude-code", MAC, p.id);
  expect(
    (
      await selfIn(
        w.db,
        { agent: "s_4", email: ME, client: "claude-code" },
        ROOM_A,
      )
    ).name,
  ).toBe("boss");
  // A Claude of the person opened by hand (no agent): `claude` is free, `boss` is taken.
  w.agent("s_5", "claude-code", null);
  const own = await selfIn(
    w.db,
    { agent: "s_5", email: ME, client: "claude-code" },
    ROOM_A,
  );
  expect(own.name).toBe("claude");
  expect(own.others).toContain("boss");
  // An agent named claude: the hand-opened one moves to claude-2 at its next call.
  const r = await createPersona(w.db, ME, { machine: MAC, kind: "claude" });
  if ("error" in r) throw new Error(r.error);
  expect(r.name).toBe("claude");
  expect(
    (
      await selfIn(
        w.db,
        { agent: "s_5", email: ME, client: "claude-code" },
        ROOM_A,
      )
    ).name,
  ).toBe("claude-2");
});

test("a runner's rooms: its agent's switch, else its kind's, else any agent of the machine", async () => {
  const w = world();
  const [claude] = await ensurePersonas(w.db, ME, MAC, "claude");
  const codex = await createPersona(w.db, ME, {
    machine: MAC,
    kind: "codex",
    book: ROOM_B,
  });
  if ("error" in codex) throw new Error(codex.error);
  await setPersonaRoom(w.db, claude.id, ROOM_A, false);
  const rooms = (persona: string, kind: string, main = 0) =>
    Object.fromEntries(
      (
        w.sqlite
          .query(MACHINE_ROOMS_SQL)
          .all(0, ME, MAC, persona, kind, main) as {
          id: string;
          claude_on: number;
        }[]
      ).map((r) => [r.id, r.claude_on]),
    );
  // Room A: claude off, codex no row. Room B: claude no row with claude_on NULL (main, so on), codex on.
  expect(rooms(claude.id, "")).toEqual({ [ROOM_A]: 0, [ROOM_B]: 1 });
  expect(rooms(codex.id, "")).toEqual({ [ROOM_A]: 0, [ROOM_B]: 1 });
  expect(rooms("", "codex")).toEqual({ [ROOM_A]: 0, [ROOM_B]: 1 });
  await setPersonaRoom(w.db, codex.id, ROOM_A, true);
  expect(rooms("", "codex")[ROOM_A]).toBe(1);
  expect(rooms("", "claude")[ROOM_A]).toBe(0);
  // An older runner (no persona, no kind): any agent of the machine.
  expect(rooms("", "")[ROOM_A]).toBe(1);
  // The main runner of kind codex: the codex agent is not main (it has its own runner), so nothing here.
  expect(rooms("", "codex", 1)).toEqual({ [ROOM_A]: 0, [ROOM_B]: 0 });
  // The main runner of kind claude: only the main claude agent.
  expect(rooms("", "claude", 1)).toEqual({ [ROOM_A]: 0, [ROOM_B]: 1 });
});

test("a session opened by hand on a computer follows its own switch when it has one, else the machine's (Gimenes #6453)", () => {
  const w = world();
  w.agent("s_hand", "claude-code", MAC);
  w.sqlite.run(`INSERT INTO machine_rooms VALUES (?, ?, 1)`, [MAC, ROOM_A]);
  expect(w.delivers("s_hand", ROOM_A)).toBe(1);
  // A name row (src/agentNames.ts) has no delivery: still the machine's switch.
  w.sqlite.run(
    `INSERT INTO agent_rooms (agent, book_id, name) VALUES (?, ?, 'claude-3')`,
    ["s_hand", ROOM_A],
  );
  expect(w.delivers("s_hand", ROOM_A)).toBe(1);
  // Its own switch off: off, with the machine on.
  w.sqlite.run(
    `UPDATE agent_rooms SET delivery = 0 WHERE agent = ? AND book_id = ?`,
    ["s_hand", ROOM_A],
  );
  expect(w.delivers("s_hand", ROOM_A)).toBe(0);
});
