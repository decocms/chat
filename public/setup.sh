#!/bin/sh
# "This computer" in one line: curl -fsSL https://chat.decocms.com/setup.sh | sh
# Everything a computer needs so "✻ Ligar Claude" in a room opens a Claude Code here, each step skipped when it's done:
# the vibebook CLI, the vibebook plugin in Claude Code, herdr (the terminal the Claudes open in, herdr.dev), the
# vibebook plugin in herdr (its tab runs `vibebook herdr`), the login, and the deco.chat menu bar app (tray/ in the
# repo; it runs herdr with no window and `vibebook herdr`, and starts at login). Then herdr opens, or the app does.
# VIBEBOOK_NO_TRAY=1 skips the app.
set -e
ORIGIN="${VIBEBOOK_ORIGIN:-https://chat.decocms.com}"
TRAY_REPO="${VIBEBOOK_TRAY_REPO:-decocms/chat}"
LOCAL="$HOME/.local/bin"
PATH_BEFORE="$PATH"
export PATH="$HOME/.vibebook/bin:$LOCAL:$PATH"
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m%s\033[0m\n' "$1" >&2; exit 1; }

# Before 1.7.0 the CLI talks to vibebook.dev, which is gone: every call gives "unreachable (410)", and its own
# `vibebook update` can't reach a server to update from (Pedro, tray beta). An older one is replaced, not kept.
MIN_CLI=1.7.0
# True when version $1 is older than $2 (x.y.z).
older() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)" = "$1" ]; }
cli_version() { vibebook --version 2>/dev/null | head -1 | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' || echo 0.0.0; }

step "1/6 vibebook CLI"
if command -v vibebook >/dev/null 2>&1; then
  V=$(cli_version)
  if older "$V" "$MIN_CLI"; then
    echo "vibebook $V at $(command -v vibebook) is too old (it talks to vibebook.dev, which is gone): updating"
    # Installed with npm: update it there, so the old one doesn't stay first in PATH. Else the standalone install.
    if command -v npm >/dev/null 2>&1 && npm ls -g vibebook.dev >/dev/null 2>&1; then
      npm i -g vibebook.dev@latest >/dev/null 2>&1 || fail "Couldn't update vibebook. Run: npm i -g vibebook.dev@latest"
    else curl -fsSL "$ORIGIN/install.sh" | sh; fi
    hash -r 2>/dev/null || true
    V=$(cli_version)
    older "$V" "$MIN_CLI" && fail "vibebook at $(command -v vibebook) is still $V. Remove it, then run this line again."
  fi
  echo "ok: $(command -v vibebook) $V"
else curl -fsSL "$ORIGIN/install.sh" | sh; fi

step "2/6 vibebook in Claude Code"
command -v claude >/dev/null 2>&1 || fail "Claude Code not found. Install it (https://claude.com/claude-code), then run this line again."
claude plugin marketplace add decocms/chat >/dev/null 2>&1 || true
claude plugin install vibebook@vibebook >/dev/null 2>&1 || fail "Couldn't install the vibebook plugin. Run: claude plugin install vibebook@vibebook"
echo "ok"

step "3/6 herdr (where your Claudes open, herdr.dev)"
if command -v herdr >/dev/null 2>&1; then echo "ok: $(command -v herdr)"
else curl -fsSL https://herdr.dev/install.sh | sh; command -v herdr >/dev/null 2>&1 || fail "herdr didn't install. See https://herdr.dev"; fi

step "4/6 vibebook in herdr"
herdr plugin install --yes decocms/chat/herdr-plugin </dev/null || fail "Couldn't add the vibebook plugin to herdr. Run: herdr plugin install decocms/chat/herdr-plugin"

step "5/6 Connect this computer"
SESSION="${VIBEBOOK_HOME:-$HOME/.vibebook}/session.json"
# A session made for another server (vibebook.dev, before CLI 1.7.0) is no connection here: set aside, log in again.
if [ -f "$SESSION" ] && grep -q "\"origin\": *\"$ORIGIN\"" "$SESSION"; then echo "ok: already connected"
else
  if [ -f "$SESSION" ]; then
    mv "$SESSION" "$SESSION.old"
    echo "The saved login is for another server (kept as $SESSION.old): logging in to $ORIGIN"
  fi
  vibebook login </dev/null || fail "Login didn't finish. Run: vibebook login"
fi

# The app from the newest tray-v* release of the repo (.github/workflows/release-tray.yml names the files).
TRAY=""
tray_mac() {
  APP="$HOME/Applications/deco.chat.app"
  PLIST="$HOME/Library/LaunchAgents/com.decochat.tray.plist"
  TMP=$(mktemp -d)
  # curl does not set the quarantine flag; xattr still clears it, in case.
  curl -fsSL "$1" -o "$TMP/app.tar.gz" || fail "Couldn't download the deco.chat app ($1). Run this line again."
  tar -xzf "$TMP/app.tar.gz" -C "$TMP" || fail "Couldn't unpack the deco.chat app. Run this line again."
  xattr -dr com.apple.quarantine "$TMP/deco.chat.app" 2>/dev/null || true
  # Replace a running copy: stop its login item, the app, its core and its runner (not herdr: the Claudes run in it),
  # and wait until they are gone (one runner per machine).
  launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
  pkill -f "$APP/Contents/MacOS/vibebook" 2>/dev/null || true
  i=0; while pgrep -f "$APP/Contents/MacOS/vibebook" >/dev/null 2>&1 && [ $i -lt 20 ]; do sleep 0.5; i=$((i + 1)); done
  # Still running after 10 s: force it. Else `open` below only brings back the old app (Gimenes #6029).
  if pgrep -f "$APP/Contents/MacOS/vibebook" >/dev/null 2>&1; then
    pkill -9 -f "$APP/Contents/MacOS/vibebook" 2>/dev/null || true
    sleep 1
  fi
  mkdir -p "$HOME/Applications" "$HOME/Library/LaunchAgents"
  rm -rf "$APP"
  mv "$TMP/deco.chat.app" "$APP"
  rm -rf "$TMP"
  # Opens the app at login. KeepAlive false: "Sair" in the menu really quits it.
  cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.decochat.tray</string>
  <key>ProgramArguments</key><array><string>/usr/bin/open</string><string>$APP</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
</dict>
</plist>
PL
  launchctl bootstrap "gui/$(id -u)" "$PLIST" || fail "Couldn't add the deco.chat app to login. Run: launchctl bootstrap gui/$(id -u) $PLIST"
  open "$APP" || fail "Couldn't open the deco.chat app. Open it from ~/Applications."
  echo "ok: $APP (opens at login)"
  TRAY=menu
}
tray_linux() {
  BIN="$LOCAL/deco.chat.AppImage"
  UNITS="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
  command -v systemctl >/dev/null 2>&1 || { echo "skipped: no systemd here. Run: vibebook watch"; return 0; }
  mkdir -p "$LOCAL" "$UNITS"
  curl -fsSL "$1" -o "$BIN.new" || fail "Couldn't download the deco.chat app ($1). Run this line again."
  chmod +x "$BIN.new"
  mv "$BIN.new" "$BIN"
  # A desktop with a tray (a StatusNotifier host) gets the app; else the service runs the same core with no menu.
  if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && busctl --user list 2>/dev/null | grep -q org.kde.StatusNotifierWatcher; then
    RUN="$BIN"; TARGET=graphical-session.target; TRAY=menu
  else
    RUN="$(command -v vibebook) watch"; TARGET=default.target; TRAY=watch
  fi
  # Without FUSE 2 an AppImage can't mount itself: it unpacks each time instead.
  FUSE=""; ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2' || FUSE="Environment=APPIMAGE_EXTRACT_AND_RUN=1"
  cat > "$UNITS/deco-chat.service" <<UNIT
[Unit]
Description=deco.chat (menu bar app, herdr and vibebook herdr)
After=$TARGET
PartOf=$TARGET

[Service]
ExecStart=$RUN
Environment=PATH=$HOME/.vibebook/bin:$LOCAL:/usr/local/bin:/usr/bin:/bin
$FUSE
# Stop only the app or vibebook watch: herdr, which it started, keeps the Claudes.
KillMode=process
Restart=on-failure
RestartSec=30

[Install]
WantedBy=$TARGET
UNIT
  systemctl --user daemon-reload
  systemctl --user enable deco-chat.service >/dev/null 2>&1 || fail "Couldn't enable deco-chat.service. Run: systemctl --user enable --now deco-chat.service"
  systemctl --user restart deco-chat.service || fail "Couldn't start deco-chat.service. See: journalctl --user -u deco-chat"
  if [ "$TRAY" = menu ]; then echo "ok: $BIN (starts at login, deco-chat.service)"
  else echo "ok: no tray on this desktop, so deco-chat.service runs \`vibebook watch\` (starts at login)"; fi
}

step "6/6 deco.chat app (menu bar)"
if [ -n "${VIBEBOOK_NO_TRAY:-}" ]; then echo "skipped (VIBEBOOK_NO_TRAY)"
else
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) ASSET=macos-aarch64.app.tar.gz;;
    Darwin-x86_64) ASSET=macos-x86_64.app.tar.gz;;
    Linux-x86_64|Linux-amd64) ASSET=linux-x86_64.AppImage;;
    *) ASSET="";;
  esac
  TAG=$(curl -fsSL "https://api.github.com/repos/$TRAY_REPO/releases?per_page=50" 2>/dev/null | sed -n 's/.*"tag_name": *"\(tray-v[^"]*\)".*/\1/p' | head -1)
  if [ -z "$ASSET" ]; then echo "skipped: no app for $(uname -s) $(uname -m) yet"
  elif [ -z "$TAG" ]; then echo "skipped: no release of the app yet"
  else
    URL="https://github.com/$TRAY_REPO/releases/download/$TAG/deco.chat-$ASSET"
    case "$ASSET" in
      macos-*) tray_mac "$URL";;
      *) tray_linux "$URL";;
    esac
  fi
fi

if [ -n "$TRAY" ]; then
  if [ "$TRAY" = menu ]; then printf '\n\033[1mDone.\033[0m The deco.chat app is in the menu bar: it keeps herdr and your Claudes running, with no window.\n'
  else printf '\n\033[1mDone.\033[0m deco-chat.service keeps herdr and your Claudes running, with no window.\n'; fi
  printf 'In any room, click "✻ Ligar Claude" and a Claude Code opens here, in the room'"'"'s folder.\n'
  printf 'To see your Claudes, run: herdr\n\n'
  exit 0
fi
printf '\n\033[1mDone.\033[0m herdr opens now with a "vibebook" tab: leave it open.\n'
printf 'In any room, click "✻ Ligar Claude" and a Claude Code opens here, in the room'"'"'s folder.\n'
case ":$PATH_BEFORE:" in
  *":$LOCAL:"*) printf 'Next time just run: herdr\n\n';;
  *) printf 'Next time just run: herdr  (add %s to your PATH first: export PATH="%s:$PATH")\n\n' "$LOCAL" "$LOCAL";;
esac
if [ -t 1 ] && [ -r /dev/tty ]; then exec herdr </dev/tty; fi
echo "Open a terminal and run: herdr"
