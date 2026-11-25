// The plugin's Stop hook (claude-plugin/hooks/stop-listen.mjs): a Claude whose listen woke and was not restarted
// cannot end its turn (Gui #5522); anyone else can.
import { expect, test } from "bun:test";
import { mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  agentOf,
  reason,
  stoppedRoom,
} from "../claude-plugin/hooks/stop-listen.mjs";

const session = "11111111-2222-3333-4444-555555555555";
const home = () => mkdtempSync(join(tmpdir(), "vb-stop-"));
const pid = (
  dir: string,
  room: string,
  value: number,
  ageMs = 0,
  who = session,
) => {
  const f = join(dir, `listen-${agentOf(who)}-${room}.pid`);
  writeFileSync(f, String(value));
  const t = (Date.now() - ageMs) / 1000;
  utimesSync(f, t, t);
};

test("the agent id is the CLI's: sha256 of claude-code:<session>, 32 hex", () => {
  expect(agentOf(session)).toMatch(/^s_[0-9a-f]{32}$/);
});

test("a session that never listened, or whose listen runs, may stop", () => {
  const dir = home();
  expect(stoppedRoom(dir, session, () => false)).toBeNull();
  pid(dir, "f94aedb83899", 4242);
  expect(stoppedRoom(dir, session, (p) => p === 4242)).toBeNull();
});

test("a listen that woke and was not restarted blocks the stop, with its room", () => {
  const dir = home();
  pid(dir, "f94aedb83899", 4242);
  expect(stoppedRoom(dir, session, () => false)).toBe("f94aedb83899");
  expect(reason("f94aedb83899")).toContain("vibebook listen");
});

test("only the newest room of the session counts, another session's file never does, and a day-old file is over", () => {
  const dir = home();
  pid(dir, "aaaaaaaaaaaa", 1, 60_000);
  pid(dir, "bbbbbbbbbbbb", 2);
  expect(stoppedRoom(dir, session, (p) => p === 2)).toBeNull();
  const other = home();
  pid(other, "f94aedb83899", 7, 0, "another-session");
  expect(stoppedRoom(other, session, () => false)).toBeNull();
  const old = home();
  pid(old, "f94aedb83899", 7, 2 * 864e5);
  expect(stoppedRoom(old, session, () => false)).toBeNull();
});
