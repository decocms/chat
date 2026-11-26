// "Install the app" (Gimenes #5843): a person runs the deco.chat menu bar app when one of their machines checked in
// with kind "app" (the runner inside the app) in the last 30 days. Then read_room has no app_hint and the user center
// has no "Instale o app" row. D1 is a bun:sqlite stand-in.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { APP_FRESH, appCheckedIn, hasApp } from "../src/delivery";

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
      };
      return statement;
    },
  } as unknown as D1Database;
}

function world() {
  const sqlite = new Database(":memory:");
  sqlite.run(
    `CREATE TABLE machines (id TEXT PRIMARY KEY, email TEXT, name TEXT, kind TEXT, seen_at INTEGER, created_at INTEGER)`,
  );
  const add = (id: string, email: string, kind: string, seen: number) =>
    sqlite.run(
      `INSERT INTO machines (id, email, name, kind, seen_at, created_at) VALUES (?, ?, 'mac', ?, ?, ?)`,
      [id, email, kind, seen, seen],
    );
  return { db: d1(sqlite), add };
}

test("a machine of kind app seen lately counts as the app", async () => {
  const w = world();
  w.add("m_1", "ana@x.co", "app", Date.now() - 864e5);
  expect(await hasApp(w.db, "ana@x.co")).toBe(true);
});

test("a terminal runner, a Herdr app machine or an old app machine is not the app", async () => {
  const w = world();
  w.add("m_2", "bia@x.co", "herdr", Date.now());
  w.add("m_3", "bia@x.co", "herdr-app", Date.now());
  w.add("m_4", "bia@x.co", "app", Date.now() - APP_FRESH - 1000);
  expect(await hasApp(w.db, "bia@x.co")).toBe(false);
});

test("another person's app does not count for you", async () => {
  const w = world();
  w.add("m_5", "caio@x.co", "app", Date.now());
  expect(await hasApp(w.db, "dani@x.co")).toBe(false);
});

test("a runner in the app that checks in ends a cached no at once", async () => {
  const w = world();
  expect(await hasApp(w.db, "edu@x.co")).toBe(false);
  appCheckedIn("edu@x.co");
  expect(await hasApp(w.db, "edu@x.co")).toBe(true);
});
