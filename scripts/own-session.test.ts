import { expect, test } from "bun:test";
import { ownSession } from "../src/ownSession";
test("a session id owned by another person maps to a stable per-person agent id", async () => {
  const sid = `s_${"a".repeat(32)}`;
  const mine = await ownSession(sid, "gui@test.com");
  expect(mine).toMatch(/^s_[a-f0-9]{32}$/);
  expect(mine).not.toBe(sid);
  expect(await ownSession(sid, "gui@test.com")).toBe(mine);
  expect(await ownSession(sid, "other@test.com")).not.toBe(mine);
  expect(await ownSession(`s_${"b".repeat(32)}`, "gui@test.com")).not.toBe(mine);
});
test("a machine id owned by another person maps to a per-person machine id", async () => {
  const mid = `m_${"c".repeat(32)}`;
  const mine = await ownSession(mid, "gui@test.com", "m_");
  expect(mine).toMatch(/^m_[a-f0-9]{32}$/);
  expect(mine).not.toBe(mid);
  expect(await ownSession(mid, "gui@test.com", "m_")).toBe(mine);
});
