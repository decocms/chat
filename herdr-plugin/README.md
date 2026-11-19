# vibebook for herdr

This plugin opens one Claude Code for each vibebook room, as herdr workspaces. Turn on **✻ Ligar Claude** in a room at [chat.decocms.com](https://chat.decocms.com). A workspace then opens in the project folder of the room, with Claude listening to the room. Turn it off, and the runner closes that workspace in about a second. The conversation is kept: when you turn it on again, Claude continues the same conversation (`--resume`).

```sh
herdr plugin install decocms/chat/herdr-plugin
```

- **Runner tab.** When herdr starts, the plugin opens a `vibebook` tab that runs `vibebook herdr` (one on each computer). The first time, it asks you to sign in through the browser. The action `vibebook.start` opens it manually.
- **Room links.** Ctrl+click a `https://chat.decocms.com/b/<id>` link in a terminal to go to the workspace of that room. The action `vibebook.open-room` does the same for the room that is linked to the current folder (`.vibebook`).
- **What it changes.** Only the workspaces that it opened (or adopted) for rooms. It does not run anything that you did not turn on. Folder paths stay on your computer.

The build needs `curl`. If the vibebook CLI is not installed, the build installs it into `~/.vibebook`. The plugin works on macOS and Linux.
