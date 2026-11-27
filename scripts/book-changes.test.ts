// The room's change log (src/bookChanges.ts) on real SQLite: every write path gives exactly one new rev, a thing
// changed twice keeps one row with the newest rev, and a resume finds the messages changed after a rev.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import {
  CHANGES_SQL,
  CURRENT_REV_SQL,
  MESSAGES_SINCE_REV_SQL,
  validRev,
} from "../src/bookChanges";

/** The Book's tables, as far as the triggers read them. */
const TABLES = `
  CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread TEXT, author TEXT, text TEXT, ts INTEGER, reactions TEXT, deleted INTEGER);
  CREATE TABLE epics (id TEXT PRIMARY KEY, title TEXT, ts INTEGER);
  CREATE TABLE tasks (id TEXT PRIMARY KEY, epic_id TEXT, title TEXT, done INTEGER DEFAULT 0, ts INTEGER);
  CREATE TABLE meta (k TEXT PRIMARY KEY, v TEXT);
  CREATE TABLE files (id TEXT PRIMARY KEY, name TEXT, deleted INTEGER);
  CREATE TABLE reminders (id TEXT PRIMARY KEY, text TEXT);
  CREATE TABLE polls (id TEXT PRIMARY KEY, question TEXT, closed INTEGER DEFAULT 0);
  CREATE TABLE votes (poll_id TEXT, email TEXT, opt INTEGER, PRIMARY KEY (poll_id, email, opt));
  CREATE TABLE decisions (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT);
  CREATE TABLE acks (msg_id INTEGER, agent TEXT, status TEXT, PRIMARY KEY (msg_id, agent));
  CREATE TABLE pins (id TEXT PRIMARY KEY, kind TEXT, ref TEXT, UNIQUE (kind, ref));
`;

function room() {
  const db = new Database(":memory:");
  db.exec(TABLES);
  db.exec(CHANGES_SQL);
  db.exec(CHANGES_SQL); // the Book runs it on every wake: it must be idempotent
  const rev = () => (db.query(CURRENT_REV_SQL).get() as { rev: number }).rev;
  const last = () =>
    db
      .query("SELECT kind, ref FROM changes ORDER BY rev DESC LIMIT 1")
      .get() as { kind: string; ref: string };
  return { db, rev, last };
}

test("each write path gives exactly one new rev, with its kind and id", () => {
  const { db, rev, last } = room();
  expect(rev()).toBe(0);
  const writes: [string, string, string][] = [
    [
      "INSERT INTO messages (thread, text) VALUES ('main', 'oi')",
      "message",
      "1",
    ],
    ["UPDATE messages SET text = 'olá' WHERE id = 1", "message", "1"],
    [
      'UPDATE messages SET reactions = \'{"👍":["a"]}\' WHERE id = 1',
      "message",
      "1",
    ],
    ["UPDATE messages SET deleted = 1 WHERE id = 1", "message", "1"],
    [
      "INSERT INTO acks (msg_id, agent, status) VALUES (1, 'a', 'doing')",
      "ack",
      "1",
    ],
    ["DELETE FROM acks WHERE msg_id = 1", "ack", "1"],
    ["INSERT INTO epics (id, title) VALUES ('e1', 'Épico')", "epic", "e1"],
    [
      "INSERT INTO tasks (id, epic_id, title) VALUES ('t1', 'e1', 'Tarefa')",
      "epic",
      "e1",
    ],
    ["UPDATE tasks SET done = 1 WHERE id = 't1'", "epic", "e1"],
    ["INSERT INTO files (id, name) VALUES ('f1', 'a.png')", "file", "f1"],
    [
      "INSERT INTO pins (id, kind, ref) VALUES ('p1', 'file', 'f1')",
      "pin",
      "p1",
    ],
    [
      "INSERT INTO reminders (id, text) VALUES ('r1', 'lembrar')",
      "reminder",
      "r1",
    ],
    ["INSERT INTO polls (id, question) VALUES ('q1', 'qual?')", "poll", "q1"],
    [
      "INSERT INTO votes (poll_id, email, opt) VALUES ('q1', 'a@b.c', 0)",
      "poll",
      "q1",
    ],
    ["INSERT INTO decisions (text) VALUES ('fechado')", "decision", "1"],
    ["INSERT INTO meta (k, v) VALUES ('doc', '# Sala')", "doc", "doc"],
    [
      "INSERT OR REPLACE INTO meta (k, v) VALUES ('doc:e1', '# Épico')",
      "doc",
      "doc:e1",
    ],
    ["DELETE FROM epics WHERE id = 'e1'", "epic", "e1"],
  ];
  for (const [sql, kind, ref] of writes) {
    const before = rev();
    db.exec(sql);
    expect(rev()).toBeGreaterThan(before);
    expect(last()).toEqual({ kind, ref });
  }
});

test("a thing changed twice keeps one row, with the newest rev", () => {
  const { db, rev } = room();
  db.exec("INSERT INTO messages (thread, text) VALUES ('main', 'a')");
  db.exec("UPDATE messages SET text = 'b' WHERE id = 1");
  db.exec("UPDATE messages SET text = 'c' WHERE id = 1");
  const rows = db
    .query("SELECT rev FROM changes WHERE kind = 'message' AND ref = '1'")
    .all() as { rev: number }[];
  expect(rows).toHaveLength(1);
  expect(rows[0]!.rev).toBe(rev());
});

test("an upsert logs too: the outer statement's conflict policy does not break the trigger", () => {
  const { db, rev, last } = room();
  const upsert =
    "INSERT INTO meta (k, v) VALUES ('doc', ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v";
  db.query(upsert).run("# A");
  const first = rev();
  db.query(upsert).run("# B");
  expect(rev()).toBeGreaterThan(first);
  expect(last()).toEqual({ kind: "doc", ref: "doc" });
  db.exec(
    "INSERT OR IGNORE INTO votes (poll_id, email, opt) VALUES ('q1', 'a@b.c', 0)",
  );
  db.exec(
    "INSERT OR IGNORE INTO votes (poll_id, email, opt) VALUES ('q1', 'a@b.c', 1)",
  );
  expect(last()).toEqual({ kind: "poll", ref: "q1" });
});

test("meta keys that are not docs are not logged", () => {
  const { db, rev } = room();
  db.exec("INSERT INTO meta (k, v) VALUES ('size_at', '1')");
  db.exec("INSERT INTO meta (k, v) VALUES ('eh:abc', '{}')");
  expect(rev()).toBe(0);
});

test("a resume finds the messages changed after a rev, and only those", () => {
  const { db, rev } = room();
  for (const text of ["a", "b", "c"])
    db.exec(`INSERT INTO messages (thread, text) VALUES ('main', '${text}')`);
  const cursor = rev();
  db.exec("UPDATE messages SET reactions = '{}' WHERE id = 2");
  db.exec("INSERT INTO messages (thread, text) VALUES ('main', 'd')");
  const ids = (db.query(MESSAGES_SINCE_REV_SQL).values(cursor) as number[][])
    .map(([id]) => id)
    .sort();
  expect(ids).toEqual([2, 4]);
});

test("validRev takes a whole number up to the room's newest rev", () => {
  expect(validRev(null, 5)).toBeNull();
  expect(validRev("", 5)).toBeNull();
  expect(validRev("0", 5)).toBe(0);
  expect(validRev("5", 5)).toBe(5);
  expect(validRev("6", 5)).toBeNull(); // from a room this Book does not have
  expect(validRev("-1", 5)).toBeNull();
  expect(validRev("2.5", 5)).toBeNull();
  expect(validRev("x", 5)).toBeNull();
});
