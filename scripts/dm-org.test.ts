import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { Glob } from "bun";
import { canDm } from "../src/dm";
import { corporateDomain, isFreeEmailDomain } from "../shared/org";
import { FREE_EMAIL_DOMAINS_VERSION } from "../shared/free-email-domains";

// The list of free providers (shared/free-email-domains.ts, copied from the npm package free-email-domains) and the
// exact-domain rule of shared/org.ts. scripts/dm-colleagues.test.ts and scripts/org-rooms.test.ts cover the features.
function d1(db: Database) {
  return {
    prepare: (sql: string) => {
      let args: unknown[] = [];
      const st = {
        bind: (...a: unknown[]) => ((args = a), st),
        first: async () => db.query(sql).get(...(args as never[])) ?? null,
        all: async () => ({ results: db.query(sql).all(...(args as never[])) }),
      };
      return st;
    },
  } as unknown as D1Database;
}

// Main's first list (#451): each of these stays a free provider.
const FIRST_LIST = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.net",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "bol.com.br",
  "uol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "r7.com",
  "hey.com",
  "fastmail.com",
];

test("the provider list is the copied npm package, and it keeps every provider of the first list", () => {
  expect(FREE_EMAIL_DOMAINS_VERSION).toMatch(
    /^free-email-domains@\d+\.\d+\.\d+$/,
  );
  for (const d of FIRST_LIST) expect(isFreeEmailDomain(d)).toBe(true);
  // Only in the copied list: the first list let these people see each other.
  for (const d of ["web.de", "mail.ru", "qq.com", "gmx.de"])
    expect(isFreeEmailDomain(d)).toBe(true);
  for (const d of ["deco.cx", "decocms.com", "pmenos.com.br"])
    expect(isFreeEmailDomain(d)).toBe(false);
});

test("corporateDomain: the exact domain; a subdomain or a look-alike is another domain", () => {
  expect(corporateDomain("Joao@PMenos.com.br")).toBe("pmenos.com.br");
  expect(corporateDomain("eve@evil.pmenos.com.br")).toBe("evil.pmenos.com.br");
  expect(corporateDomain("eve@pmenos.com.br.evil.com")).toBe(
    "pmenos.com.br.evil.com",
  );
  for (const e of [
    "a@web.de",
    "c@Outlook.com",
    "x@globo.com",
    "x@a'b.com",
    "x@%.com",
  ])
    expect(corporateDomain(e)).toBeNull();
});

test("canDm: a provider of the copied list is not a company; a subdomain or a look-alike is not a colleague", async () => {
  const db = new Database(":memory:");
  db.run(`CREATE TABLE users (email TEXT PRIMARY KEY)`);
  db.run(`CREATE TABLE friends (a TEXT, b TEXT, declined_at INTEGER)`);
  db.run(`CREATE TABLE members (book_id TEXT, email TEXT)`);
  db.run(`CREATE TABLE books (id TEXT, dm TEXT)`);
  for (const e of [
    "joao@pmenos.com.br",
    "maria@pmenos.com.br",
    "eve@evil.pmenos.com.br",
    "eve@notpmenos.com.br",
    "a@web.de",
    "b@web.de",
  ])
    db.run(`INSERT INTO users (email) VALUES (?)`, [e]);
  const D = d1(db);
  expect(await canDm(D, "joao@pmenos.com.br", "maria@pmenos.com.br")).toBe(
    true,
  );
  expect(await canDm(D, "eve@evil.pmenos.com.br", "joao@pmenos.com.br")).toBe(
    false,
  );
  expect(await canDm(D, "eve@notpmenos.com.br", "joao@pmenos.com.br")).toBe(
    false,
  );
  expect(await canDm(D, "a@web.de", "b@web.de")).toBe(false);
});

test("the browser never imports the provider list (it is about 600 KB)", async () => {
  const offenders: string[] = [];
  for await (const file of new Glob("web/**/*.{ts,svelte}").scan(".")) {
    const text = await Bun.file(file).text();
    if (/shared\/(org|free-email-domains)["']/.test(text)) offenders.push(file);
  }
  expect(offenders).toEqual([]);
});
