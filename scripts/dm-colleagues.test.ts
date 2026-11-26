// Colleagues (Gimenes #5006): people with your company email domain find each other in "Nova mensagem" and DM without
// a message request. Free providers (gmail.com…) never count. D1 is a bun:sqlite stand-in with the tables canDm reads.
import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { corporateDomain } from "../shared/org";
import { canDm } from "../src/dm";
import { contacts } from "../web/features/app-navigation/contacts";
import type { MeResult } from "../shared/schemas";

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
      };
      return statement;
    },
  } as unknown as D1Database;
}

function world() {
  const sqlite = new Database(":memory:");
  sqlite.run(
    `CREATE TABLE users (email TEXT PRIMARY KEY, name TEXT, avatar INTEGER)`,
  );
  sqlite.run(
    `CREATE TABLE friends (a TEXT, b TEXT, created_at INTEGER, msg TEXT, declined_at INTEGER)`,
  );
  sqlite.run(`CREATE TABLE members (book_id TEXT, email TEXT)`);
  sqlite.run(`CREATE TABLE books (id TEXT, dm TEXT)`);
  for (const email of [
    "ana@deco.cx",
    "bia@deco.cx",
    "caio@gmail.com",
    "dani@gmail.com",
    "eva@other.com",
  ])
    sqlite.run(`INSERT INTO users (email) VALUES (?)`, [email]);
  return d1(sqlite);
}

test("the company domain of an email, and none for a free provider", () => {
  expect(corporateDomain("Gimenes@Deco.CX")).toBe("deco.cx");
  expect(corporateDomain("ana@mail.empresa.com.br")).toBe(
    "mail.empresa.com.br",
  );
  expect(corporateDomain("caio@gmail.com")).toBeNull();
  expect(corporateDomain("x@hotmail.com.br")).toBeNull();
  expect(corporateDomain("no-domain")).toBeNull();
  expect(corporateDomain("x@localhost")).toBeNull();
});

test("a colleague with an account can be DMed without a request", async () => {
  const db = world();
  expect(await canDm(db, "ana@deco.cx", "bia@deco.cx")).toBe(true);
  expect(await canDm(db, "ana@deco.cx", "BIA@deco.cx")).toBe(true);
});

test("a colleague with no account, another company or the same free provider still needs a request", async () => {
  const db = world();
  expect(await canDm(db, "ana@deco.cx", "zoe@deco.cx")).toBe(false);
  expect(await canDm(db, "ana@deco.cx", "eva@other.com")).toBe(false);
  expect(await canDm(db, "caio@gmail.com", "dani@gmail.com")).toBe(false);
});

test("the picker lists colleagues after the people from your rooms, once", () => {
  const me = {
    email: "ana@deco.cx",
    friends: [],
    people: [
      { email: "eva@other.com", name: "Eva", avatar: null, rooms: ["Produto"] },
      {
        email: "bia@deco.cx",
        name: "Bia",
        avatar: null,
        rooms: [],
        domain: true,
      },
    ],
  } as unknown as MeResult;
  expect(
    contacts(me).map((person) => [person.email, person.domain ?? false]),
  ).toEqual([
    ["eva@other.com", false],
    ["bia@deco.cx", true],
  ]);
});
