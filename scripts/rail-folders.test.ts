// Folders on the rail (src/railFolders.ts): per person, like Discord's server folders. A folder and its rooms are
// yours only: another member of the same rooms keeps their own rail. D1 is a bun:sqlite stand-in.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
  folderName,
  railFolders,
  saveRail,
  setRailFolder,
} from "../src/railFolders";

function d1(sqlite: Database) {
  // D1's bind gives a new statement each time (a batch binds one statement many times).
  const bound = (sql: string, args: unknown[]) => ({
    bind: (...values: unknown[]) => bound(sql, values),
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
  });
  const prepare = (sql: string) => bound(sql, []);
  return {
    prepare,
    async batch(statements: { run(): Promise<unknown> }[]) {
      sqlite.run("BEGIN");
      try {
        for (const statement of statements) await statement.run();
        sqlite.run("COMMIT");
      } catch (error) {
        sqlite.run("ROLLBACK");
        throw error;
      }
    },
  } as unknown as D1Database;
}

const ANA = "ana@deco.cx",
  BIA = "bia@deco.cx";
const ROOMS = ["r1", "r2", "r3", "r4"];

function world() {
  const sqlite = new Database(":memory:");
  sqlite.run(`CREATE TABLE books (id TEXT PRIMARY KEY, title TEXT, dm TEXT)`);
  sqlite.run(
    `CREATE TABLE members (book_id TEXT, email TEXT, archived_at INTEGER, position INTEGER, rail_folder TEXT, PRIMARY KEY (book_id, email))`,
  );
  sqlite.run(
    `CREATE TABLE rail_folders (email TEXT, id TEXT, name TEXT, tint TEXT, position INTEGER, created_at INTEGER, PRIMARY KEY (email, id))`,
  );
  for (const [index, id] of ROOMS.entries()) {
    sqlite.run(`INSERT INTO books (id, title) VALUES (?, ?)`, [id, id]);
    for (const email of [ANA, BIA])
      sqlite.run(
        `INSERT INTO members (book_id, email, position) VALUES (?, ?, ?)`,
        [id, email, index],
      );
  }
  sqlite.run(`INSERT INTO books (id, title, dm) VALUES ('dm1', 'DM', 'x')`);
  sqlite.run(`INSERT INTO members (book_id, email) VALUES ('dm1', ?)`, [ANA]);
  sqlite.run(`INSERT INTO books (id, title) VALUES ('other', 'Not Ana''s')`);
  sqlite.run(`INSERT INTO members (book_id, email) VALUES ('other', ?)`, [BIA]);
  return { sqlite, db: d1(sqlite) };
}

const rail = (sqlite: Database, email: string) =>
  sqlite
    .query(
      `SELECT book_id AS id, position, rail_folder AS folder FROM members WHERE email = ? AND book_id IN ('r1','r2','r3','r4') ORDER BY position`,
    )
    .all(email);

test("a folder is made, renamed, reordered and dissolved on your rail only", async () => {
  const { sqlite, db } = world();
  const before = rail(sqlite, BIA);
  // Drop r3 on r1: a folder with both, in r1's place.
  expect(
    await saveRail(db, ANA, [
      { folder: "fabc1234", rooms: ["r1", "r3"] },
      { room: "r2" },
      { room: "r4" },
    ]),
  ).toBe("ok");
  expect(await railFolders(db, ANA)).toEqual([
    { id: "fabc1234", name: null, tint: null, position: 0 },
  ]);
  expect(rail(sqlite, ANA)).toEqual([
    { id: "r1", position: 1, folder: "fabc1234" },
    { id: "r3", position: 2, folder: "fabc1234" },
    { id: "r2", position: 3, folder: null },
    { id: "r4", position: 4, folder: null },
  ]);
  // Folder settings: the name is one clean line; an unknown color is none.
  expect(
    await setRailFolder(db, ANA, "fabc1234", {
      name: "  Clientes\n<b> ",
      tint: "purple",
    }),
  ).toBe(true);
  expect((await railFolders(db, ANA))[0]).toMatchObject({
    name: "Clientes b",
    tint: "purple",
  });
  expect(
    await setRailFolder(db, ANA, "fabc1234", { name: "x", tint: "red" }),
  ).toBe(true);
  expect((await railFolders(db, ANA))[0]?.tint).toBeNull();
  // Moved like a room: after r4, name and color kept.
  expect(
    await saveRail(db, ANA, [
      { room: "r2" },
      { room: "r4" },
      { folder: "fabc1234", rooms: ["r3", "r1"] },
    ]),
  ).toBe("ok");
  expect(await railFolders(db, ANA)).toEqual([
    { id: "fabc1234", name: "x", tint: null, position: 2 },
  ]);
  // A room out (the folder is not sent with one room: the app dissolves it): the folder is gone, its rooms free.
  expect(
    await saveRail(db, ANA, [
      { room: "r2" },
      { room: "r4" },
      { room: "r3" },
      { room: "r1" },
    ]),
  ).toBe("ok");
  expect(await railFolders(db, ANA)).toEqual([]);
  expect(rail(sqlite, ANA).every((row) => row.folder === null)).toBe(true);
  // Bia, in the same rooms, never saw any of it.
  expect(rail(sqlite, BIA)).toEqual(before);
  expect(await railFolders(db, BIA)).toEqual([]);
});

test("another person's folders are theirs: same ids, separate rows", async () => {
  const { sqlite, db } = world();
  await saveRail(db, ANA, [
    { folder: "fsame000", rooms: ["r1", "r2"] },
    { room: "r3" },
    { room: "r4" },
  ]);
  await saveRail(db, BIA, [
    { room: "r4" },
    { folder: "fsame000", rooms: ["r3", "other"] },
    { room: "r1" },
    { room: "r2" },
  ]);
  await setRailFolder(db, BIA, "fsame000", { name: "Bia", tint: "green" });
  expect(await railFolders(db, ANA)).toEqual([
    { id: "fsame000", name: null, tint: null, position: 0 },
  ]);
  expect(rail(sqlite, ANA).map((row) => row.folder)).toEqual([
    "fsame000",
    "fsame000",
    null,
    null,
  ]);
  // Bia's save left Ana's rail as it was, and Bia's rename is hers.
  expect(rail(sqlite, BIA)).toEqual([
    { id: "r4", position: 0, folder: null },
    { id: "r3", position: 2, folder: "fsame000" },
    { id: "r1", position: 4, folder: null },
    { id: "r2", position: 5, folder: null },
  ]);
  // Your folder can't be edited by someone else, who has none by that id.
  expect(
    await setRailFolder(db, "eve@deco.cx", "fsame000", { name: "hack" }),
  ).toBe(false);
  expect((await railFolders(db, ANA))[0]?.name).toBeNull();
});

test("a room that is not yours, a DM, a room twice or a bad folder id is refused, and nothing changes", async () => {
  const { sqlite, db } = world();
  const before = rail(sqlite, ANA);
  for (const items of [
    [{ room: "other" }],
    [{ room: "dm1" }],
    [{ room: "r1" }, { folder: "fabc1234", rooms: ["r1", "r2"] }],
    [{ folder: "NOT-OK", rooms: ["r1", "r2"] }],
    [
      { folder: "fabc1234", rooms: ["r1"] },
      { folder: "fabc1234", rooms: ["r2"] },
    ],
  ])
    expect(await saveRail(db, ANA, items)).toBe("bad");
  expect(rail(sqlite, ANA)).toEqual(before);
  expect(await railFolders(db, ANA)).toEqual([]);
});

test("an empty folder is not kept", async () => {
  const { db } = world();
  expect(
    await saveRail(db, ANA, [
      { folder: "fempty00", rooms: [] },
      { room: "r1" },
    ]),
  ).toBe("ok");
  expect(await railFolders(db, ANA)).toEqual([]);
});

test("a folder's name is one short line", () => {
  expect(folderName("   ")).toBeNull();
  expect(folderName(null)).toBeNull();
  expect(folderName("a".repeat(60))).toHaveLength(40);
});
