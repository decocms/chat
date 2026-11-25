import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanTranscripts } from "../cli/backfill";

const line = (ts: string, id: string, u: Record<string, number>) =>
  JSON.stringify({ timestamp: ts, message: { id, usage: u } });

test("backfill sums each model call once, by UTC day, and skips live sessions", async () => {
  const root = mkdtempSync(join(tmpdir(), "bf-"));
  mkdirSync(join(root, "proj"));
  writeFileSync(
    join(root, "proj", "aaaaaaaa-1111.jsonl"),
    [
      line("2026-11-18T23:59:00Z", "m1", {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 1,
      }),
      line("2026-11-18T23:59:01Z", "m1", {
        input_tokens: 10,
        output_tokens: 5,
      }), // same call split over lines: once
      '{"type":"user","message":{"content":"hi"}}',
      'not json with "usage"',
      line("2026-11-19T00:00:01Z", "m2", { input_tokens: 7 }),
    ].join("\n") + "\n",
  );
  writeFileSync(
    join(root, "proj", "bbbbbbbb-2222.jsonl"),
    line("2026-11-19T10:00:00Z", "x", { input_tokens: 999 }) + "\n",
  );
  const scan = await scanTranscripts(root, (sid) => sid === "bbbbbbbb-2222");
  expect(Object.fromEntries(scan.days)).toEqual({
    "2026-11-18": 116,
    "2026-11-19": 7,
  });
  expect(scan.sessions.map((s) => s.sid)).toEqual(["aaaaaaaa-1111"]);
  expect(scan.sessions[0]!.last).toBe("m2");
  expect(
    (await scanTranscripts(join(root, "missing"), () => false)).days.size,
  ).toBe(0);
});

test("backfill counts the subagents a session ran", async () => {
  const root = mkdtempSync(join(tmpdir(), "bf-"));
  mkdirSync(join(root, "proj", "cccccccc-3333", "subagents"), {
    recursive: true,
  });
  writeFileSync(
    join(root, "proj", "cccccccc-3333.jsonl"),
    line("2026-11-19T10:00:00Z", "a", { input_tokens: 1 }) + "\n",
  );
  writeFileSync(
    join(root, "proj", "cccccccc-3333", "subagents", "agent-a1b2c3d4.jsonl"),
    line("2026-11-19T11:00:00Z", "b", { output_tokens: 2 }) + "\n",
  );
  const scan = await scanTranscripts(root, () => false);
  expect(scan.days.get("2026-11-19")).toBe(3);
  expect(scan.sessions.length).toBe(2);
});

test("server keeps each backfilled day at its largest value and drops bad days", async () => {
  const { Database } = await import("bun:sqlite");
  const { recordBackfill } = await import("../src/profile");
  const sql = new Database(":memory:");
  sql.run(
    `CREATE TABLE usage_backfill (email TEXT, machine TEXT, day TEXT, tokens INTEGER, PRIMARY KEY (email, machine, day))`,
  );
  const db = {
    prepare: (q: string) => ({
      bind: (...v: unknown[]) => ({
        run: () => sql.query(q).run(...(v as never[])),
      }),
    }),
    batch: async (list: { run(): unknown }[]) => list.map((x) => x.run()),
  } as unknown as D1Database;
  const today = new Date().toISOString().slice(0, 10);
  const m = `m_${"a".repeat(32)}`;
  expect(
    await recordBackfill(db, "a@b.co", m, [
      { day: today, tokens: 100 },
      { day: "2001-01-01", tokens: 5 },
      { day: today, tokens: 1e12 },
      { day: "x", tokens: 1 },
    ]),
  ).toBe(1);
  await recordBackfill(db, "a@b.co", m, [{ day: today, tokens: 40 }]); // a smaller rerun doesn't lower it
  await recordBackfill(db, "a@b.co", m, [{ day: today, tokens: 100 }]); // the same again doesn't add
  expect(
    sql.query(`SELECT sum(tokens) AS t FROM usage_backfill`).get(),
  ).toEqual({ t: 100 });
  await expect(recordBackfill(db, "a@b.co", m, "nope")).rejects.toThrow();
});
