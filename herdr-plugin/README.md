# vibebook for herdr

This plugin opens one Claude Code for each vibebook room, as herdr workspaces. Turn on **✻ Ligar Claude** in a room at [vibebook.dev](https://vibebook.dev). A workspace then opens in the project folder of the room, with Claude listening to the room. Turn it off, and the room stops waking that Claude. The workspace stays open with its context.

```sh
herdr plugin install decocms/chat/herdr-plugin
```

- **Runner tab.** When herdr starts, the plugin opens a `vibebook` tab that runs `vibebook herdr` (one on each computer). The first time, it asks you to sign in through the browser. The action `vibebook.start` opens it manually.
- **Room links.** Ctrl+click a `https://vibebook.dev/b/<id>` link in a terminal to go to the workspace of that room. The action `vibebook.open-room` does the same for the room that is linked to the current folder (`.vibebook`).
- **What it changes.** Only the workspaces that it opened (or adopted) for rooms. It does not run anything that you did not turn on. Folder paths stay on your computer. More information: https://vibebook.dev/en/herdr

The build needs `curl`. If the vibebook CLI is not installed, the build installs it into `~/.vibebook`. The plugin works on macOS and Linux.
