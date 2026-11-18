#!/bin/sh
# "This computer" in one line: curl -fsSL https://vibebook.dev/setup.sh | sh
# Everything a computer needs so "✻ Ligar Claude" in a room opens a Claude Code here, each step skipped when it's done:
# the vibebook CLI, the vibebook plugin in Claude Code, herdr (the terminal the Claudes open in, herdr.dev), the
# vibebook plugin in herdr (its tab runs `vibebook herdr`), the login, and then herdr opens.
set -e
ORIGIN="${VIBEBOOK_ORIGIN:-https://vibebook.dev}"
LOCAL="$HOME/.local/bin"
PATH_BEFORE="$PATH"
export PATH="$HOME/.vibebook/bin:$LOCAL:$PATH"
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

step "1/5 vibebook CLI"
if command -v vibebook >/dev/null 2>&1; then echo "ok: $(command -v vibebook)"
else curl -fsSL "$ORIGIN/install.sh" | sh; fi

step "2/5 vibebook in Claude Code"
command -v claude >/dev/null 2>&1 || fail "Claude Code not found. Install it (https://claude.com/claude-code), then run this line again."
claude plugin marketplace add decocms/chat >/dev/null 2>&1 || true
claude plugin install vibebook@vibebook >/dev/null 2>&1 || fail "Couldn't install the vibebook plugin. Run: claude plugin install vibebook@vibebook"
echo "ok"

step "3/5 herdr (where your Claudes open, herdr.dev)"
if command -v herdr >/dev/null 2>&1; then echo "ok: $(command -v herdr)"
else curl -fsSL https://herdr.dev/install.sh | sh; command -v herdr >/dev/null 2>&1 || fail "herdr didn't install. See https://herdr.dev"; fi

step "4/5 vibebook in herdr"
herdr plugin install --yes decocms/chat/herdr-plugin </dev/null || fail "Couldn't add the vibebook plugin to herdr. Run: herdr plugin install decocms/chat/herdr-plugin"

step "5/5 Connect this computer"
if [ -f "${VIBEBOOK_HOME:-$HOME/.vibebook}/session.json" ]; then echo "ok: already connected"
else vibebook login </dev/null || fail "Login didn't finish. Run: vibebook login"; fi

printf '\n\033[1mDone.\033[0m herdr opens now with a "vibebook" tab: leave it open.\n'
printf 'In any room, click "✻ Ligar Claude" and a Claude Code opens here, in the room'"'"'s folder.\n'
case ":$PATH_BEFORE:" in
  *":$LOCAL:"*) printf 'Next time just run: herdr\n\n';;
  *) printf 'Next time just run: herdr  (add %s to your PATH first: export PATH="%s:$PATH")\n\n' "$LOCAL" "$LOCAL";;
esac
if [ -t 1 ] && [ -r /dev/tty ]; then exec herdr </dev/tty; fi
echo "Open a terminal and run: herdr"
