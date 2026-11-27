// Stop hook: a Claude that listens to a room must not end its turn with the listen stopped (Gui #5522). The listen
// is one-shot: it exits when the room has news, and the Claude has to read the room and start it again. Agents forgot
// the restart and then ignored their human for hours (missed_message, 25/11). When the newest listen of this session
// is no longer running, the hook keeps the turn going with that instruction. A session that never ran listen is left
// alone, and a second stop in a row (stop_hook_active) is never blocked, so it cannot loop.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** The CLI's agent id for a Claude Code session (cli/vibebook.ts agentId). */
export const agentOf = (session) =>
  `s_${createHash("sha256").update(`claude-code:${session}`).digest("hex").slice(0, 32)}`;

/** A pid that is a running vibebook listen (a reused pid of another program does not count). */
function listening(pid) {
  if (!(pid > 1)) return false;
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  try {
    return /vibebook.*listen|cli\.mjs.*listen/.test(execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }));
  } catch {
    return false;
  }
}

/** The room whose listen this session left stopped, or null. `alive` is injectable for the test. */
export function stoppedRoom(home, session, alive = listening) {
  const prefix = `listen-${agentOf(session)}-`;
  let files;
  try {
    files = readdirSync(home).filter((f) => f.startsWith(prefix) && f.endsWith(".pid"));
  } catch {
    return null;
  }
  if (!files.length) return null;
  // Only the newest one: a session that moved to another room left the old room's file behind on purpose.
  const newest = files
    .map((f) => ({ f, at: (() => { try { return statSync(join(home, f)).mtimeMs; } catch { return 0; } })() }))
    .sort((a, b) => b.at - a.at)[0].f;
  // Older than a day: that session is not listening any more, nothing to keep alive.
  try {
    if (Date.now() - statSync(join(home, newest)).mtimeMs > 864e5) return null;
  } catch {
    return null;
  }
  let pid = 0;
  try {
    pid = Number(readFileSync(join(home, newest), "utf8"));
  } catch {}
  if (alive(pid)) return null;
  return newest.slice(prefix.length, -".pid".length);
}

export const reason = (room) =>
  `vibebook: o seu \`vibebook listen\` ${room === "all" ? "" : `da sala ${room} `}acordou e não foi reiniciado, então você não está ouvindo a sala. Antes de parar: rode \`vibebook call read_room\`${room === "all" ? "" : ` (room_id ${room})`}, aja nas mensagens from_your_human, e rode \`vibebook listen\` de novo com run_in_background (o mesmo comando de antes, com --model). Não mencione o reinício.`;

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  let d = "";
  process.stdin.on("data", (c) => (d += c)).on("end", async () => {
    let j = {};
    try { j = JSON.parse(d); } catch {}
    if (j.stop_hook_active || typeof j.session_id !== "string") return;
    const home = process.env.DECO_CHAT_HOME || process.env.VIBEBOOK_HOME || (existsSync(join(homedir(), ".deco-chat")) ? join(homedir(), ".deco-chat") : join(homedir(), ".vibebook"));
    // A listen started in this same turn may not have written its pid yet: look again a moment later before blocking.
    if (!stoppedRoom(home, j.session_id)) return;
    await new Promise((r) => setTimeout(r, 1500));
    const room = stoppedRoom(home, j.session_id);
    if (room) process.stdout.write(JSON.stringify({ decision: "block", reason: reason(room) }));
  });
}
