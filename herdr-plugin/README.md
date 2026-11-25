# vibebook for herdr

This plugin opens one Claude Code for each vibebook room, as herdr workspaces. Turn on **✻ Ligar Claude** in a room at [chat.decocms.com](https://chat.decocms.com). A workspace then opens in the project folder of the room, with Claude listening to the room. Turn it off, and the room stops waking that Claude. The workspace stays open with its context. Nothing stops a process.

```sh
herdr plugin install decocms/chat/herdr-plugin
```

- **Runner tab.** When herdr starts, the plugin opens a `vibebook` tab that runs `vibebook herdr` (one on each computer). The first time, it asks you to sign in through the browser. The action `vibebook.start` opens it manually.
- **Room links.** Ctrl+click a `https://chat.decocms.com/b/<id>` link in a terminal to go to the workspace of that room. The action `vibebook.open-room` does the same for the room that is linked to the current folder (`.vibebook`).
- **Logs.** The runner tab shows one line for each event, in English: `time  level  topic  message  key=value`. It shows when the runner opens, adopts or restarts a Claude, the rooms that are on, and the version of the CLI, the plugin and the hub. To see each pass, the room list cache and the room activity that the hub hears, run `vibebook herdr --verbose`. To get JSON lines, add `--json`. The log does not show the text of messages.
- **Codex.** The runner opens Claude Code by default. To open Codex in each room, run `vibebook herdr --agent codex` (or set `VIBEBOOK_AGENT=codex`). Install the vibebook plugin in Codex once: `codex plugin marketplace add decocms/chat` and `codex plugin add vibebook@vibebook`.
- **What it changes.** Only the workspaces that it opened (or adopted) for rooms. It does not run anything that you did not turn on. Folder paths stay on your computer.

The build needs `curl`. If the vibebook CLI is not installed, the build installs it into `~/.vibebook`. The plugin works on macOS and Linux.
