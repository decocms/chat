#!/bin/sh
# Notification hook: Claude Code stopped at a permission prompt (or a question dialog) in this terminal. In a repo
# linked to a vibebook room, mark this Claude's ack there as "blocked" with the prompt, so the room shows
# "⏸ espera você no terminal" and the person sees it waits on them. No-op elsewhere; never blocks Claude.
command -v vibebook >/dev/null 2>&1 || exit 0
command -v node >/dev/null 2>&1 || exit 0
# The room of this folder: the runner names it (DECO_CHAT_ROOM or VIBEBOOK_ROOM), else `.deco-chat`, `.vibebook` or a room link at the repo root, else in
# this folder. A room folder the runner made is not a git repo, and a git-only check skipped every question there, so it
# stayed in the terminal (Gimenes #6490, #6508).
[ -n "$DECO_CHAT_ROOM" ] && VIBEBOOK_ROOM=$DECO_CHAT_ROOM
if [ -z "$VIBEBOOK_ROOM" ]; then
  root=$(git rev-parse --show-toplevel 2>/dev/null) || root=$(pwd)
  [ -f "$root/.deco-chat" ] || [ -f "$root/.vibebook" ] || grep -qsE "(chat\.decocms\.com|vibebook\.dev)/b/" "$root/README.md" "$root/AGENTS.md" "$root/CLAUDE.md" || exit 0
fi
input=$(cat)
# The CLI names its agent after CLAUDE_CODE_SESSION_ID, which a hook's environment doesn't carry: without it a hook's
# call became a second agent of the same Claude (the folder's id), listed twice in the sidebar (Gui #3181).
sid=$(printf %s "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(String(JSON.parse(d).session_id||""))}catch{}})')
[ -n "$sid" ] && [ -z "$CLAUDE_CODE_SESSION_ID" ] && export CLAUDE_CODE_SESSION_ID="$sid"
args=$(printf %s "$input" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{let j={};try{j=JSON.parse(d)}catch{};const t=String(j.notification_type||"");if(t&&!/permission|elicitation/.test(t))return;const m=String(j.message||"").slice(0,200);if(!m)return;process.stdout.write(JSON.stringify({status:"blocked",note:m}))})') || exit 0
[ -n "$args" ] || exit 0
( vibebook call ack "$args" >/dev/null 2>&1 & )
exit 0
