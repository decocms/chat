#!/bin/sh
# deco.chat CLI installer: curl -fsSL https://chat.decocms.com/install.sh | sh
# Puts the CLI in ~/.vibebook and the commands `deco-chat` and `vibebook` (the same CLI) in ~/.vibebook/bin (linked into
# ~/.local/bin when it is on PATH).
set -e
ORIGIN="${VIBEBOOK_ORIGIN:-https://chat.decocms.com}"
DIR="${VIBEBOOK_HOME:-$HOME/.vibebook}"
if command -v node >/dev/null 2>&1; then RUN=node; elif command -v bun >/dev/null 2>&1; then RUN=bun; else
  echo "deco.chat needs Node.js 18+ or Bun. Install one (https://bun.com) and run this again." >&2; exit 1; fi
mkdir -p "$DIR/bin"
curl -fsSL "$ORIGIN/cli.mjs" -o "$DIR/cli.mjs"
for name in deco-chat vibebook; do
  cat > "$DIR/bin/$name" <<SH
#!/bin/sh
exec $RUN "$DIR/cli.mjs" "\$@"
SH
  chmod +x "$DIR/bin/$name"
done
case ":$PATH:" in
  *":$HOME/.local/bin:"*) mkdir -p "$HOME/.local/bin"
    for name in deco-chat vibebook; do ln -sf "$DIR/bin/$name" "$HOME/.local/bin/$name"; done
    echo "deco.chat installed: $(command -v deco-chat || echo "$HOME/.local/bin/deco-chat") (also as vibebook)";;
  *) echo "deco.chat installed at $DIR/bin/deco-chat, also as vibebook (add $DIR/bin to your PATH, or call it by that path)";;
esac
echo "Next: deco-chat login"
