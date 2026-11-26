// Rooms open to your company (src/orgRooms.ts): a member opens a room to their company email domain; people with
// that domain see its cover on the home and join it at once; everyone else only asks. D1 is a bun:sqlite stand-in.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
  orgRooms,
  requestAccess,
  seeOrgRooms,
  roomOrg,
  setRoomOrg,
  type AccessPorts,
} from "../src/orgRooms";

function d1(sqlite: Database) {
  return {
    prepare(sql: string) {
      let args: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          args = values;
          return statement;
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
      return statement;
    },
  } as unknown as D1Database;
}

const ROOM = "aaaaaaaaaaaa";
const DM = "dm0123456789abcdef0123";

function world() {
  const sqlite = new Database(":memory:");
  sqlite.run(
    `CREATE TABLE users (email TEXT PRIMARY KEY, name TEXT, org_seen_at INTEGER)`,
  );
  sqlite.run(
    `CREATE TABLE books (id TEXT PRIMARY KEY, title TEXT, icon INTEGER, dm TEXT, updated_at INTEGER, org TEXT, org_by TEXT, org_at INTEGER)`,
  );
  sqlite.run(
    `CREATE TABLE members (book_id TEXT, email TEXT, PRIMARY KEY (book_id, email))`,
  );
  sqlite.run(
    `CREATE TABLE access_requests (book_id TEXT, email TEXT, ts INTEGER, denied INTEGER DEFAULT 0, PRIMARY KEY (book_id, email))`,
  );
  sqlite.run(`INSERT INTO users (email, name) VALUES ('ana@deco.cx', 'Ana')`);
  sqlite.run(
    `INSERT INTO books (id, title, updated_at) VALUES (?, 'Produto', 1)`,
    [ROOM],
  );
  sqlite.run(
    `INSERT INTO books (id, title, dm, updated_at) VALUES (?, 'DM', 'x', 1)`,
    [DM],
  );
  sqlite.run(`INSERT INTO members VALUES (?, 'ana@deco.cx')`, [ROOM]);
  sqlite.run(`INSERT INTO members VALUES (?, 'ana@deco.cx')`, [DM]);
  const db = d1(sqlite);
  const asked: string[] = [];
  const ports = (email: string): AccessPorts => ({
    db,
    isMember: async (id) =>
      !!sqlite
        .query(`SELECT 1 FROM members WHERE book_id = ? AND email = ?`)
        .get(id, email),
    join: async (id) => {
      sqlite.run(`INSERT OR IGNORE INTO members VALUES (?, ?)`, [id, email]);
    },
    allowAsk: async () => true,
    told: async (id) => {
      asked.push(`${id}:${email}`);
    },
    track: () => {},
  });
  return { sqlite, db, ports, asked };
}

test("a member opens the room to their company domain", async () => {
  const { db } = world();
  expect(await roomOrg(db, ROOM, "ana@deco.cx")).toEqual({
    domain: "deco.cx",
    org: null,
  });
  expect(await setRoomOrg(db, ROOM, "ana@deco.cx", true)).toEqual({
    org: "deco.cx",
  });
  expect((await roomOrg(db, ROOM, "ana@deco.cx")).org).toBe("deco.cx");
});

test("a same-domain non-member sees the room and joins it at once", async () => {
  const { db, ports, asked } = world();
  await setRoomOrg(db, ROOM, "ana@deco.cx", true);
  expect(await orgRooms(db, "bia@deco.cx")).toEqual({
    domain: "deco.cx",
    rooms: [
      {
        id: ROOM,
        title: "Produto",
        icon: null,
        people: 1,
        opened_by: "ana@deco.cx",
        opened_by_name: "Ana",
        opened_at: expect.any(Number),
        new: false,
      },
    ],
  });
  // A member does not see it in the list: it is already in their rooms.
  expect((await orgRooms(db, "ana@deco.cx")).rooms).toEqual([]);
  expect(await requestAccess(ports("bia@deco.cx"), ROOM, "bia@deco.cx")).toBe(
    "member",
  );
  expect(asked).toEqual([]);
  expect((await orgRooms(db, "bia@deco.cx")).rooms).toEqual([]);
  expect(await ports("bia@deco.cx").isMember(ROOM)).toBe(true);
});

test("another domain or a free provider does not see it and only asks", async () => {
  const { db, ports, asked } = world();
  await setRoomOrg(db, ROOM, "ana@deco.cx", true);
  for (const email of ["eva@other.com", "caio@gmail.com"]) {
    expect((await orgRooms(db, email)).rooms).toEqual([]);
    expect(await requestAccess(ports(email), ROOM, email)).toBe("asked");
    expect(await ports(email).isMember(ROOM)).toBe(false);
  }
  expect(asked).toEqual([`${ROOM}:eva@other.com`, `${ROOM}:caio@gmail.com`]);
  expect((await orgRooms(db, "caio@gmail.com")).domain).toBeNull();
});

test("a DM cannot open, and a free provider cannot open a room", async () => {
  const { db, ports } = world();
  expect(await setRoomOrg(db, DM, "ana@deco.cx", true)).toBe("dm");
  expect(await setRoomOrg(db, ROOM, "caio@gmail.com", true)).toBe("no_domain");
  expect((await orgRooms(db, "bia@deco.cx")).rooms).toEqual([]);
  expect(await requestAccess(ports("bia@deco.cx"), DM, "bia@deco.cx")).toBe(
    "not_found",
  );
});

test("switching off removes the room from the list; who joined stays", async () => {
  const { db, ports } = world();
  await setRoomOrg(db, ROOM, "ana@deco.cx", true);
  await requestAccess(ports("bia@deco.cx"), ROOM, "bia@deco.cx");
  expect(await setRoomOrg(db, ROOM, "ana@deco.cx", false)).toEqual({
    org: null,
  });
  expect((await orgRooms(db, "duda@deco.cx")).rooms).toEqual([]);
  expect(await requestAccess(ports("duda@deco.cx"), ROOM, "duda@deco.cx")).toBe(
    "asked",
  );
  expect(await ports("bia@deco.cx").isMember(ROOM)).toBe(true);
});

test("a room opened to the company after you last looked is new until you look; older ones never are", async () => {
  const { sqlite, db } = world();
  sqlite.run(`INSERT INTO users (email, name) VALUES ('bia@deco.cx', 'Bia')`);
  sqlite.run(
    `INSERT INTO books (id, title, updated_at) VALUES ('bbbbbbbbbbbb', 'Vendas', 2), ('cccccccccccc', 'Antiga', 3)`,
  );
  sqlite.run(`INSERT INTO members VALUES ('bbbbbbbbbbbb', 'ana@deco.cx')`);
  sqlite.run(`INSERT INTO members VALUES ('cccccccccccc', 'ana@deco.cx')`);
  // Opened before this shipped: no org_at, never new.
  sqlite.run(
    `UPDATE books SET org = 'deco.cx', org_by = 'ana@deco.cx' WHERE id = 'cccccccccccc'`,
  );
  // Opened before Bia's first read: her marker starts then, so it is not new.
  await setRoomOrg(db, ROOM, "ana@deco.cx", true, 1_000);
  const first = await orgRooms(db, "bia@deco.cx", 2_000);
  expect(first.rooms.map((room) => [room.id, room.new])).toEqual([
    ["cccccccccccc", false],
    [ROOM, false],
  ]);
  expect(
    sqlite
      .query(`SELECT org_seen_at FROM users WHERE email = 'bia@deco.cx'`)
      .get(),
  ).toEqual({ org_seen_at: 2_000 });
  // Opened after: new, and listed first.
  await setRoomOrg(db, "bbbbbbbbbbbb", "ana@deco.cx", true, 3_000);
  const later = await orgRooms(db, "bia@deco.cx", 4_000);
  expect(later.rooms.map((room) => [room.id, room.new])).toEqual([
    ["bbbbbbbbbbbb", true],
    ["cccccccccccc", false],
    [ROOM, false],
  ]);
  expect(later.rooms[0]!.opened_at).toBe(3_000);
  // Opening again keeps when it first opened; closing forgets it.
  await setRoomOrg(db, "bbbbbbbbbbbb", "ana@deco.cx", true, 3_500);
  expect((await orgRooms(db, "bia@deco.cx", 4_000)).rooms[0]!.opened_at).toBe(
    3_000,
  );
  // Bia looks at the list: it is seen, on every device.
  await seeOrgRooms(db, "bia@deco.cx", 3_000, 5_000);
  expect(
    (await orgRooms(db, "bia@deco.cx", 6_000)).rooms.some((room) => room.new),
  ).toBe(false);
  // The marker never moves back, nor past now.
  await seeOrgRooms(db, "bia@deco.cx", 1, 6_000);
  await seeOrgRooms(db, "bia@deco.cx", 99_999, 7_000);
  expect(
    sqlite
      .query(`SELECT org_seen_at FROM users WHERE email = 'bia@deco.cx'`)
      .get(),
  ).toEqual({ org_seen_at: 7_000 });
  // Someone else has their own marker: Duda's first read starts hers, so nothing is new for her either.
  sqlite.run(`INSERT INTO users (email, name) VALUES ('duda@deco.cx', 'Duda')`);
  expect(
    (await orgRooms(db, "duda@deco.cx", 8_000)).rooms.some((room) => room.new),
  ).toBe(false);
  await setRoomOrg(db, ROOM, "ana@deco.cx", false, 9_000);
  expect(
    sqlite.query(`SELECT org_at FROM books WHERE id = ?`).get(ROOM),
  ).toEqual({ org_at: null });
});
