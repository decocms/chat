# deco.chat menu bar app

The menu bar app (the "tray") keeps a computer connected to deco.chat with no terminal open. Its menu has four items: who is signed in, one line for updates of deco.chat itself (with its version), "Abrir o deco.chat" and "Sair". You turn the Claude of a room on or off in the web app. It runs on macOS, Windows and Linux.

## How it works

The app is a Tauri 2 shell (`src/main.rs`). It only draws the menu. The logic is in the vibebook CLI (`cli/vibebook.ts`).

1. The app starts the `vibebook` binary that is next to its executable: `vibebook watch --menu`. It sets `VIBEBOOK_HERDR_DIR` to that folder, where the app ships `hc` (herdr-core).
2. `vibebook watch` uses an installed `hc` first (the one that the Herdr app uses), else the `hc` that the app ships. It gives that path to the runner in `VIBEBOOK_HC`. If no `hc` starts, it starts `herdr server` as before, when herdr is installed.
3. `vibebook watch` runs the runner (`vibebook herdr --core`) as a child. Each room whose Claude is on gets a terminal in herdr-core, in the room's folder. When the Herdr app is open, that terminal goes in a space of the app, with the room's name. Else it is a terminal `vb-<room>` with no window, and it moves into a space when it is free and the app is open. A Claude that already runs in a terminal in that folder is adopted. A Claude from the old herdr mode is closed when it is free and opens again in herdr-core with the same conversation. To look at a Claude, run `hc attach vb-<room>`, or open the Herdr app. If the runner stops, it starts it again after 15 seconds. Only one runner runs on a computer: a second one stops at once.
4. With `--menu`, the CLI is also the core of the menu. It writes one JSON line for each menu and reads one JSON line for each click (see the comment at the top of `src/main.rs`).
5. When the core stops ("Sair", or a crash), the app stops. herdr-core continues, with the Claudes in it.

The words of the menu are in Portuguese or English. The CLI selects the language from `VIBEBOOK_LANG`, `LANG` or, on macOS, the system locale.

To test the core without the app, run `vibebook tray`. To use another core, set `VIBEBOOK_TRAY_CORE` (for example `bun cli/vibebook.ts tray`).

## Updates

Under the account line, the menu shows the version that runs ("deco.chat 0.1.4"). It cannot be clicked. The menu has one update line, for deco.chat itself: the app and the `vibebook` CLI that the room Claudes use (found in `PATH` and in the usual install folders, because an app that starts at login gets a short `PATH`). It works as in other macOS apps (Sparkle):

1. The line is "Procurar atualizações". Nothing is checked before a click.
2. A click shows "Procurando atualizações…" and reads the newest `tray-v*` release (`api.github.com`), the newest `@decocms/chat` (`registry.npmjs.org`) and `vibebook --version`.
3. Then the line is "Atualizado" for 30 seconds (the version line above already names the version) (it cannot be clicked), then "Procurar atualizações" again. Or it is "Instalar atualização · <new version>", which stays until a click.
4. "Instalar atualização" shows "Instalando atualização…". It updates the CLI first: `npm i -g @decocms/chat@latest` if npm installed it (an install of the old package `vibebook.dev` is removed first), else `vibebook update`. Then, if the app is old, it runs `setup.sh` again, with the usual install folders added to `PATH`, which replaces the app (Windows: it opens the release page). Its output goes to `~/.vibebook/app-update.log`. If `setup.sh` ends before it stops this app, the line is "O deco.chat não atualizou. Tentar de novo". The new app shows "Atualizado" for 30 seconds, and its version line shows the new version. After an update of only the CLI, the line is "Atualizado · CLI <version>" (from `~/.vibebook/app-updated.json`). If no new app starts in 5 minutes, the line checks again.
5. macOS: if the app in `~/Applications` is newer than the app that runs (an install replaced the files, but the old app did not stop), the line is "Reabrir para concluir a atualização · deco.chat <version>". A click quits this app and opens the new one. `setup.sh` also stops an old app that does not quit in 10 seconds with `kill -9`. It finds the old app with `pgrep -a` and `pkill -a`: by default macOS skips the ancestors of the caller, and `setup.sh` always runs under the app (from its menu, or in a terminal of herdr). Without `-a` the old app kept running, and its menu offered the same update again and again.

Nothing runs without a click.

The runner that the app starts opens the Claude Code of each room with bypass permissions (`--dangerously-skip-permissions`; Codex: `--dangerously-bypass-approvals-and-sandbox`). It also marks the room folder as trusted (`~/.claude.json`, `~/.codex/config.toml`), and it accepts the one-time bypass question of Claude Code (`skipDangerousModePermissionPrompt` in `~/.claude/settings.json`). Thus the agent does not stop at a prompt in a terminal that nobody watches. An agent that an older runner opened before its folder was trusted can still wait at "Is this a project you trust?" (the bypass flag does not skip that question). When the runner sees that question in its own terminal, it trusts the folder, ends that agent and opens a new one on the next pass. See README, "Security model".

The agent starts through the login shell (`$SHELL -ilc`), so it gets the person's `PATH`. With fish the command is `exec $argv`, because fish has no `"$0"` and `"$@"`: with them, every terminal ended at once (exit 127).

## Install

`curl -fsSL https://chat.decocms.com/setup.sh | sh` installs the app from the newest `tray-v*` release. Set `VIBEBOOK_NO_TRAY=1` to skip it.

| System | What `public/setup.sh` does |
|---|---|
| macOS | It downloads the `.app.tar.gz`, removes the quarantine flag and puts the app in `~/Applications/deco.chat.app`. It adds the LaunchAgent `~/Library/LaunchAgents/com.decochat.tray.plist` (`RunAtLoad` true, `KeepAlive` false, so "Sair" quits the app). It loads it with `launchctl bootstrap gui/$(id -u)`. If you run the script again, it removes the old agent (`launchctl bootout`) and the old app first. |
| Linux | It puts the AppImage in `~/.local/bin/deco.chat.AppImage` and adds the systemd user service `deco-chat.service`, which starts at login. If the desktop has no tray (no `org.kde.StatusNotifierWatcher` on D-Bus), the service runs `vibebook watch` without a menu. |
| Windows | The script does not run. Install the `.msi` from the release. |

The app has no paid signature. On macOS it has an ad-hoc signature, because Apple Silicon does not run code without a signature. If you download the `.dmg` with a browser, macOS blocks the app the first time. Then go to System Settings > Privacy & Security and click "Open Anyway", or run `xattr -dr com.apple.quarantine /Applications/deco.chat.app`. The app has no automatic update. Run `setup.sh` again to update it.

## Build on your computer

You need Rust (`cargo`) and Bun.

1. Run `bun scripts/tray-bins.ts`. It compiles the CLI for this computer and downloads herdr-core (`hc`) into `tray/binaries/`. It checks the SHA-256 of the herdr-core archive.
2. Run `cargo build` in `tray/` to compile the app. To get the bundle, run `bunx @tauri-apps/cli@2.12.6 build --debug --bundles app` in `tray/`.
3. On Linux, install the libraries first: `libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`.

Do not commit `tray/target/`, `tray/gen/` or `tray/binaries/`.

## Release

1. Increase `version` in `tray/tauri.conf.json` and in `tray/Cargo.toml`. Commit.
2. Push the tag `tray-v<version>`, for example `git tag tray-v0.1.0 && git push origin tray-v0.1.0`.
3. `.github/workflows/release-tray.yml` builds the app on four runners and makes the GitHub Release with the files below and `SHA256SUMS.txt`.

| File | System |
|---|---|
| `deco.chat-macos-aarch64.app.tar.gz`, `deco.chat-macos-aarch64.dmg` | macOS, Apple Silicon |
| `deco.chat-macos-x86_64.app.tar.gz`, `deco.chat-macos-x86_64.dmg` | macOS, Intel |
| `deco.chat-windows-x86_64.msi` | Windows, x64 |
| `deco.chat-linux-x86_64.AppImage`, `deco.chat-linux-x86_64.deb` | Linux, x64 |

`public/setup.sh` downloads these files by name. If you change a name, change the script too.

## herdr-core

The app ships herdr-core (`hc`) 0.1.22 from https://releases.herdr.dev/core/ (Apache-2.0). Its LICENSE and THIRD-PARTY-NOTICES come from the same archive, and the bundle contains them in `licenses/herdr-core/`. On Windows, the bundle also contains its `conpty/` folder. To update herdr-core, change `HC_VERSION` and the SHA-256 values in `scripts/tray-bins.ts` (from the release's `manifest.json`).
