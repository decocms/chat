# deco.chat menu bar app

The menu bar app (the "tray") keeps a computer connected to deco.chat with no terminal open. Its menu has four items: who is signed in, one line for updates of deco.chat itself (with its version), "Abrir o deco.chat" and "Sair". You turn the Claude of a room on or off in the web app. It runs on macOS, Windows and Linux.

## How it works

The app is a Tauri 2 shell (`src/main.rs`). It only draws the menu. The logic is in the vibebook CLI (`cli/vibebook.ts`).

1. The app starts the `vibebook` binary that is next to its executable: `vibebook watch --menu`. It sets `VIBEBOOK_HERDR_DIR` to that folder, so the CLI uses the `herdr` binary that the app ships.
2. `vibebook watch` starts `herdr server` (herdr with no window) if `herdr status server` does not show `status: running`.
3. `vibebook watch` runs the herdr runner (`vibebook herdr`) as a child. If the runner stops, it starts it again after 15 seconds. Only one runner runs on a computer: a second one stops at once.
4. With `--menu`, the CLI is also the core of the menu. It writes one JSON line for each menu and reads one JSON line for each click (see the comment at the top of `src/main.rs`).
5. When the core stops ("Sair", or a crash), the app stops. herdr continues, with the Claudes in it.

The words of the menu are in Portuguese or English. The CLI selects the language from `VIBEBOOK_LANG`, `LANG` or, on macOS, the system locale.

To test the core without the app, run `vibebook tray`. To use another core, set `VIBEBOOK_TRAY_CORE` (for example `bun cli/vibebook.ts tray`).

## Updates

The menu has one update line, for deco.chat itself: the app and the `vibebook` CLI that the room Claudes use (found in `PATH` and in the usual install folders, because an app that starts at login gets a short `PATH`). It works as in other macOS apps (Sparkle):

1. The line is "Procurar atualizações". Nothing is checked before a click.
2. A click shows "Procurando atualizações…" and reads the newest `tray-v*` release (`api.github.com`), the newest `vibebook.dev` (`registry.npmjs.org`) and `vibebook --version`.
3. Then the line is "Atualizado · <version>" for 30 seconds, then "Procurar atualizações" again. Or it is "Instalar atualização · <new version>", which stays until a click.
4. "Instalar atualização" shows "Instalando atualização…". It updates the CLI first: `npm i -g vibebook.dev@latest` if npm installed it, else `vibebook update`. Then, if the app is old, it runs `setup.sh` again, which replaces the app (Windows: it opens the release page). The new app shows "Atualizado · deco.chat <version>" for 30 seconds (from `~/.vibebook/app-updated.json`). If no new app starts in 5 minutes, the line checks again.

Nothing runs without a click.

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

1. Run `bun scripts/tray-bins.ts`. It compiles the CLI for this computer and downloads herdr into `tray/binaries/`. It checks the SHA-256 of herdr.
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

## herdr

The app ships herdr 0.9.5 from https://github.com/herdrdev/herdr/releases (Apache-2.0). Its license is in `licenses/herdr-LICENSE.txt`, and the bundle contains it. On Windows, the bundle also contains herdr's `conpty/` folder and its notices. To update herdr, change `HERDR_VERSION` and the SHA-256 values in `scripts/tray-bins.ts`.
