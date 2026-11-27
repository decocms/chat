#!/bin/sh
# PermissionRequest hook on AskUserQuestion: in a repo linked to a vibebook room, the Claude's questions also go to the
# room as clickable choices (only the person can pick; a typed reply counts as an "other" answer). Claude Code shows its
# own question at the same time, and the first answer wins: from the room, the hook fills `answers`; from the terminal
# or the desktop app, Claude Code ends this hook and the room question closes. It was a PreToolUse hook, which held the
# app's question until the room answered (Gabriele, Circulei: "ele só aceita se eu respondo no chat"). Any question
# unanswered within VIBEBOOK_QUESTION_WAIT seconds (default 600), or anything failing: no decision.
command -v vibebook >/dev/null 2>&1 || exit 0
command -v node >/dev/null 2>&1 || exit 0
# The room of this folder: the runner names it (VIBEBOOK_ROOM), else `.vibebook` or a room link at the repo root, else in
# this folder. A room folder the runner made is not a git repo, and a git-only check skipped every question there, so it
# stayed in the terminal (Gimenes #6490, #6508).
if [ -z "$VIBEBOOK_ROOM" ]; then
  root=$(git rev-parse --show-toplevel 2>/dev/null) || root=$(pwd)
  [ -f "$root/.vibebook" ] || grep -qsE "(chat\.decocms\.com|vibebook\.dev)/b/" "$root/README.md" "$root/AGENTS.md" "$root/CLAUDE.md" || exit 0
fi
exec node -e '
const { execFileSync, execFile } = require("node:child_process");
const call = (tool, args) => { try { return JSON.parse(execFileSync("vibebook", ["call", tool, JSON.stringify(args)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 60000 })); } catch { return {}; } };
// Async for the waits, so a SIGTERM from Claude Code is handled between them (a sync loop would never yield).
const callA = (tool, args) => new Promise((r) => execFile("vibebook", ["call", tool, JSON.stringify(args)], { encoding: "utf8", timeout: 60000 }, (e, out) => { try { r(JSON.parse(out)); } catch { r({}); } }));
let d = ""; process.stdin.on("data", (c) => (d += c)).on("end", async () => {
  let j = {}; try { j = JSON.parse(d); } catch {}
  // The CLI names its agent after the Claude Code session; the env of a hook lacks it (Gui #3181: one Claude listed twice).
  if (!process.env.CLAUDE_CODE_SESSION_ID && j.session_id) process.env.CLAUDE_CODE_SESSION_ID = String(j.session_id);
  const qs = (j.tool_input?.questions || []).slice(0, 4);
  if (!qs.length) return;
  const end = Date.now() + (Number(process.env.VIBEBOOK_QUESTION_WAIT) || 600) * 1000;
  const answers = {};
  // A question left unanswered in the room went to the terminal: close it there (also when Claude Code ends this hook).
  let open = null;
  const close = () => { if (open) call("permission_close", { message_id: open }); open = null; };
  process.on("SIGTERM", () => { close(); process.exit(0); });
  // Claude Code does not end this hook when the person answers in the terminal or the app: it writes the tool_result to
  // the transcript. Watch for the result of this question (the last AskUserQuestion call there) and close the room one.
  // The call may reach the transcript after this hook starts: read from a little before the start, each time.
  const fs = require("node:fs"), tp = String(j.transcript_path || "");
  const since = (() => { try { return Math.max(0, fs.statSync(tp).size - 262144); } catch { return -1; } })();
  if (since >= 0) setInterval(() => {
    let t = ""; try { const fd = fs.openSync(tp, "r"), b = Buffer.alloc(Math.max(0, fs.fstatSync(fd).size - since)); fs.readSync(fd, b, 0, b.length, since); fs.closeSync(fd); t = b.toString("utf8"); } catch { return; }
    const ids = [...t.matchAll(/"type":"tool_use","id":"([^"]+)","name":"AskUserQuestion"/g)];
    if (ids.length && t.includes(`"tool_use_id":"${ids[ids.length - 1][1]}"`)) { close(); process.exit(0); }
  }, 2000).unref();
  for (const q of qs) {
    const opts = (q.options || []).map((o) => String(o.label ?? o).slice(0, 120)).filter(Boolean).slice(0, 8);
    const notes = (q.options || []).filter((o) => o.description).map((o) => `- **${o.label}**: ${String(o.description).slice(0, 200)}`).join("\n");
    const text = `❓ Seu Claude pergunta${q.header ? ` · **${String(q.header).slice(0, 40)}**` : ""}\n${String(q.question || "").slice(0, 600)}${notes ? `\n\n${notes}` : ""}`;
    const post = await callA("post", opts.length >= 2 ? { text, choices: opts, multi: !!q.multiSelect } : { text });
    if (!post.ok || !post.id) return;
    open = post.id;
    let answer = null;
    while (!answer && Date.now() < end) {
      const left = Math.min(45, Math.ceil((end - Date.now()) / 1000));
      if (left < 1) break;
      answer = (await callA("permission_wait", { message_id: post.id, timeout_seconds: left })).text || null;
    }
    if (!answer) return close(); // the terminal asks as usual
    open = null;
    answers[String(q.question)] = answer;
  }
  // The documented way to answer AskUserQuestion from a hook: allow, with the answers (question text to label; a typed
  // reply is the text itself) in the tool input.
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PermissionRequest",
    decision: { behavior: "allow", updatedInput: { ...j.tool_input, answers } } } }));
});'
