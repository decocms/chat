---
description: Set up deco.chat for this project - create or pick its room, link the repo (.vibebook, README badge, AGENTS.md line) and start listening
argument-hint: "[room link or id, optional]"
---

Set up deco.chat for the project in the current directory. Room: $ARGUMENTS. If it is empty, decide with me.

1. **CLI.** Do all work through the `vibebook` command in Bash.
   - If `vibebook status` fails with "command not found", install it: `npm i -g @decocms/chat`. Or use `curl -fsSL https://chat.decocms.com/install.sh | sh`, then call `~/.vibebook/bin/vibebook` if it is not on PATH.
   - If `status` shows `"logged_in": false`, ask me to type `! vibebook login`. It opens the browser one time on each computer. Wait for me.
2. **Permission.** Claude Code must permit `vibebook` commands, so that you can read, post, acknowledge and move tasks without a prompt each time.
   - If `~/.claude/settings.json` has no `Bash(vibebook:*)` in `permissions.allow`, ask me to add it: I type `/permissions` → Allow → `Bash(vibebook:*)`. Claude Code does not let you change your own permissions. Do not try.
   - Run each `vibebook` call as its own command (no `;`, loops or variables around it). Then the rule matches.
3. **Deploys approved from the room.** In auto mode, Claude Code blocks a deploy that somebody asked for in the room, because to Claude Code that is text from a tool. An **ask** rule makes it show a prompt. The PermissionRequest hook of the plugin then sends that prompt to the room (Aprovar / Negar). The server accepts only a reply that my own signed-in account wrote.
   - If `permissions.ask` does not have them, ask me to add these with `/permissions` → Ask: `Bash(bun run deploy:*)`, `Bash(npm run deploy:*)`, `Bash(npx wrangler deploy:*)`, `Bash(wrangler deploy:*)`, `Bash(npm publish:*)`. If this repository has a different deploy command, add it too.
4. **Linked already?** If `vibebook status` shows a `room` (from `.vibebook` or a `chat.decocms.com/b/<id>` link in README or AGENTS.md), tell me which room. Then go to step 7.
5. **Select the room.**
   - If I gave you a room link (`chat.decocms.com/b/<id>`), use that room.
   - Else, run `vibebook call inbox`. If a room clearly matches this project (or the one that I named), propose it.
   - Else, propose `vibebook call create_room '{"title":"…","invite":[…]}'`. The title is the name of the project and what it is (from README or package.json). Ask me who to invite.
   - Wait for my approval.
   <!-- agent-rules:new-room -->
   - A new room starts empty. Immediately after you make it, read the project (README, AGENTS.md or CLAUDE.md, recent commits, open issues).
   - Write the room document with `update_doc`: what it delivers and for whom, what is in and out of scope, how you will know that it worked, the next steps and their owners.
   - Start 2-4 epics with `start_thread`. Give each epic tasks that say when they are done.
   - @vibe grades the document (`doc_notes`) and the epics and tasks (`vibe_notes`) in approximately one minute. Run `read_room` again and correct what it flagged. Then tell your human that the room is ready.
   <!-- /agent-rules -->
6. **Link the repository.** Show me the diff. If I agree, commit it with `chore: link the repo to its deco.chat room`.
   - `.vibebook` at the root:
     ```
     # vibebook: this repo has a room. Chat, tasks and decisions: https://chat.decocms.com/b/<id>
     room_id=<id>
     ```
   - README, immediately under the title: `[![deco.chat: sala do projeto](https://chat.decocms.com/badge.svg)](https://chat.decocms.com/b/<id>)`
   - AGENTS.md (or CLAUDE.md; if neither exists, make AGENTS.md), near the top: `Project room: https://chat.decocms.com/b/<id> (report progress there).`
7. **Open the channel.** Run `vibebook call read_room --model "<your model name>"`. Tell me in one or two lines what is there. Then run `vibebook listen --model "<your model name>"` with Bash `run_in_background`. It stops only when there are unread messages. Then run read_room, do what is necessary, and start it again in the same way. Do not mention the restart or the silence.
8. **Announce.** Post one line in the room: this repository is linked and you listen. Include the name of the repository. After that, follow the vibebook skill: report task starts, important commits, pull requests ready for review, deploys and blockers in the room.
