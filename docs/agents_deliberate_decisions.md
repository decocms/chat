# Agent deliberate decisions

This file is a log of the decisions that agents made without a human instruction. A human reviewer reads it later and approves or rejects each entry.

## What to record

Record a decision when all of these conditions are true:

- You selected one option from two or more options.
- No human told you which option to select.
- A reviewer can possibly want a different result.

Examples:

- You added, removed or changed a dependency.
- You deleted code, files or data.
- You selected one design from two or more designs.
- You interpreted a request that has two or more meanings.
- You did not do a check or a step of a procedure.

Do not record these items:

- Formatting, and changes that a tool makes automatically.
- A fix that a failed check tells you to make.
- A decision that a human gave you in an instruction.

## Procedure

1. Make the decision.
2. Add one entry at the end of this file. Do not change the other entries.
3. Use the template below.
4. Put the entry in the same commit as the change.
5. If you cannot undo the decision, stop and ask a human first.

Only a human changes the `Status` line.

## Template

```markdown
### <YYYY-MM-DD> · <branch> · <title, 8 words or less>
- Agent: <model>
- Context: <the problem, 1 or 2 sentences>
- Decision: <what you selected>
- Other options: <what you did not select, and why>
- Risk: low | medium | high
- Undo: <how to undo it>
- Status: open
```

The ID is the date and the branch, not a number. Thus, two agents on different branches do not make the same ID.

## Entries

### 2026-11-18 · docs/agents-consolidation · Keep the plugin Markdown files
- Agent: claude-opus-5-5
- Context: The human told me to remove all Markdown files except `README.md`.
- Decision: I kept `claude-plugin/commands/*.md`, `claude-plugin/skills/vibebook/SKILL.md` and `herdr-plugin/README.md`.
- Other options: Remove them. That breaks the Claude Code plugin, because these files are its commands and skill. The herdr marketplace shows the herdr README.
- Risk: low
- Undo: Delete the three files. Then remove the commands and the skill from the plugin.
- Status: open

### 2026-11-18 · docs/agents-consolidation · Delete the non-Markdown migration evidence
- Agent: claude-opus-5-5
- Context: `docs/` contained about 480 JSON, PNG, log and gzip files. They were evidence for the deleted Svelte migration reports.
- Decision: I deleted them with the reports. I moved the 6 data files that scripts read to `scripts/data/` and changed the script paths.
- Other options: Keep `docs/svelte-migration/` for the scripts. That keeps a large folder that no document explains.
- Risk: low
- Undo: `git checkout <commit before this branch> -- docs/`
- Status: open

### 2026-11-18 · docs/agents-consolidation · Move font and fixture provenance into docs
- Agent: claude-opus-5-5
- Context: `public/fonts/studio/README.md` and `scripts/fixtures/entities/README.md` recorded where third-party files came from and their licenses.
- Decision: I deleted the two files and put their facts in [stack.md](stack.md).
- Other options: Keep the two files. The human asked for one README only.
- Risk: low
- Undo: Restore the two files from git.
- Status: open

### 2026-11-18 · docs/agents-consolidation · Point the Cursor rule at AGENTS.md
- Agent: claude-opus-5-5
- Context: `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc` was a symbolic link to `CLAUDE.md`. That file does not exist.
- Decision: I changed the link to `AGENTS.md`.
- Other options: Delete the link. Then Cursor gets no project rules.
- Risk: low
- Undo: Delete the link.
- Status: open

### 2026-11-18 · docs/agents-consolidation · Remove the feature reference
- Agent: claude-opus-5-5
- Context: The old `AGENTS.md` (115 KB) described each feature with its function names. The human told me to keep only global rules and to remove the feature documents.
- Decision: I kept the design of the system in [architecture.md](architecture.md). I removed the descriptions of single features. The code is now the reference for features.
- Other options: Move the feature text to `docs/features/`. The human rejected feature documents.
- Risk: medium. Some facts that are not clear from the code are now only in git history.
- Undo: `git show <commit before this branch>:AGENTS.md`
- Status: open

### 2026-11-18 · docs/agents-consolidation · Use 900px as the mobile/desktop breakpoint
- Agent: claude-opus-5-5
- Context: The human asked for two breakpoints, mobile and desktop, but gave no width. The Svelte app uses `min-[901px]` 151 times, `max-[720px]` 46 times, `sm:` 49 times and `max-[900px]` 11 times.
- Decision: Mobile is 900px or less. Desktop is 901px or more. The other breakpoints are old code.
- Other options: 720px (the phone home of the vanilla app), or the Tailwind `md` breakpoint (768px). Both are used less.
- Risk: medium. Screens from 721px to 900px change from desktop to mobile when old code moves.
- Undo: Change the two values in `docs/stack.md`.
- Status: open

### 2026-11-18 · docs/agents-consolidation · Squash merge for automerge
- Agent: claude-opus-5-5
- Context: The release procedure enables automerge. The human did not name a merge method.
- Decision: `gh pr merge --auto --squash`. The history of `main` has one commit for each pull request (`… (#160)`).
- Other options: Rebase merge or merge commit. The repository permits both.
- Risk: low
- Undo: Change the command in `docs/workflow.md`.
- Status: open

### 2026-11-18 · docs/agents-consolidation · Release the plugin prompts as 0.24.13
- Agent: claude-opus-5-5
- Context: The human told me to rewrite all Markdown files in STE, including `claude-plugin/commands/*.md` and `SKILL.md`. These files are the prompts that agents in other repositories follow.
- Decision: I kept each command, tool name and rule, and changed only the sentences. I removed the "Gui #NNNN" references. I increased the plugin version to 0.24.13, so that the herdr runner restarts running Claudes with the new text.
- Other options: Keep the version. Then running Claudes keep the old text until the next release.
- Risk: medium. A change of words in a prompt can change agent behavior. Test `/vibebook:listen` in a test room before the merge.
- Undo: Revert the four files and the version.
- Status: open

### 2026-11-18 · docs/agents-consolidation · Correct the off behavior in the herdr README
- Agent: claude-opus-5-5
- Context: `herdr-plugin/README.md` said that "Ligar Claude" off closes the workspace. Since Nov 2026, off only stops delivery, and the workspace stays open.
- Decision: I wrote the current behavior.
- Other options: Keep the old text. It is wrong.
- Risk: low
- Undo: Revert the paragraph.
- Status: open

### 2026-11-18 · ci/main-red-and-pr-template · Mention the GitHub login of the commit author
- Agent: claude-opus-5-5
- Context: The human asked to mention the commit author, with only a real login. The `workflow_run` payload gives the commit author name and email, but no login.
- Decision: The workflow asks the commits API for `author.login`. If GitHub cannot resolve it, the workflow uses `workflow_run.actor.login`. It mentions only a login that has letters, digits and `-` (no bots).
- Other options: Mention only `workflow_run.actor.login`. For a squash automerge, that is the person who enabled automerge, not always the author.
- Risk: low
- Undo: Change the `login=` lines in `.github/workflows/main-red.yml`.
- Status: open

### 2026-11-18 · ci/main-red-and-pr-template · One open main-red issue, retitled to the newest commit
- Agent: claude-opus-5-5
- Context: The human asked to comment on the open `main-red` issue if one exists. The issue title has a short sha.
- Decision: The workflow comments on the open issue and changes its title to the newest red commit. It also ignores runs from forks with a branch called `main`, and it treats `timed_out` jobs as failed jobs.
- Other options: Keep the first title. Then the title names a commit that is possibly not the cause now.
- Risk: low
- Undo: Remove the `gh issue edit` line.
- Status: open

### 2026-11-18 · ci/main-red-and-pr-template · Write an allowed list of Markdown files
- Agent: claude-opus-5-5
- Context: The human asked to add the template path to the allowed list in `docs/writing.md`. That file had no list.
- Decision: I added rule 6 with all the Markdown files in git now, plus the template. I added `herdr-plugin/README.md` because it is in git.
- Other options: Write only the template path.
- Risk: low
- Undo: Remove rule 6 in `docs/writing.md`.

### 2026-11-18 · chore/remove-migration-tooling · Delete the migration-only tooling
- Agent: claude-opus-5-5
- Context: The task told me to delete the tooling that only the finished Svelte migration used, and to keep all that a live check uses. I selected each file.
- Decision: I deleted the `performance` and `font-forensics` workflows, `scripts/ui-metrics*.ts` (a vanilla against Svelte benchmark), the migration inventory (`migration-inventory.ts`, `inventory-*.ts`, `reconcile-inventory.ts`, `scripts/data/baseline.json`, `scripts/data/inventory.json`), the font experiment (`font-forensics-browser.ts`, `font-css-range-browser.ts`, `scripts/font-forensics/`, `scripts/fixtures/font-forensics/`), their tests and package scripts (`measure:ui`, `capture:inventory`), and three root screenshots. I kept `app-hmr` and `chunk-diagnostics`, because `dev:app` and the chunk plugin in `svelte/vite.config.ts` are live. I kept `capture-studio.ts`, because it makes `studio-tokens.json`, which the browser-ui job reads.
- Other options: Also delete `app-hmr`, `chunk-diagnostics` and `capture-studio.ts`. Live code still uses what they test or make.
- Risk: low. No check in `bun run check` or `ci.yml` used the deleted files.
- Undo: `git revert` the commit of this branch.

### 2026-11-18 · fix/client-boundary-worktree · Declared dependency roots for the client boundary
- Agent: claude-opus-5-5
- Context: `check:client-boundary` failed in a checkout under `.claude/worktrees/`. The fixture project is a temp directory, but it aliases `tailwindcss` from the checkout's `node_modules`, so the private-directory test read the whole checkout path.
- Decision: `createClientBoundaryPolicy` and `clientBoundary` take an optional `dependencyRoots`. For a file under `<dependency root>/node_modules/`, only the part after the dependency root is tested. Other files outside the project still have their full path tested. The fixture declares the checkout as a dependency root.
- Other options: Test only the part after the last `node_modules` segment of any path. That needs no option, but it also accepts files such as `~/.ssh/node_modules/x.js`.
- Risk: low. Production builds do not pass the option. Their behavior does not change.
- Undo: Remove the option and the fixture argument.
- Status: open

### 2026-11-18 · ci/main-red-skip-superseded · Ignore a cancelled CI run when main has a newer commit
- Agent: claude-opus-5-5
- Context: The human asked to open an issue when CI on `main` is cancelled. CI uses a concurrency group, so a newer push cancels a queued run. The first run of `main-red.yml` opened issue #167 for that reason only.
- Decision: If the run is cancelled and `main` has a newer commit, the workflow does nothing. A failed run always opens the issue.
- Other options: Remove `cancelled` from the conditions. Then a cancelled run on the newest commit is not visible.
- Risk: low. The run of the newer commit reports its own result.
- Undo: Remove the `cancelled` block in `.github/workflows/main-red.yml`.

### 2026-11-18 · refactor/agent-rules-source · One source for the agent rules
- Agent: claude-opus-5-5
- Context: The rules for agents in a room were written in `SKILL.md`, `listen.md`, `setup.md`, `public/llms.txt`, the MCP `INSTRUCTIONS`, `how_to_answer`, `brief_how` and the `create_room` `next` text. The copies were different.
- Decision: The source is `shared/agentRules.ts` (19 named Markdown blocks, no imports). `src/agent.ts` and `src/book.ts` import it. `scripts/agent-prompts.ts` writes the static copies between `<!-- agent-rules:<name> -->` markers. `check:agent-prompts` is in `bun run check`. The blocks use "your human". In `listen.md`, one line says that "your human" is me.
- Other options: A data file under `scripts/data/`. The Worker cannot import it without a bundler change. One generated file for the full skill. Each file has text that is only for its reader (CLI setup, MCP-only steps), so only the shared blocks are generated.
- Disagreements that I resolved (I kept the most recent or the most strict text):
  - `llms.txt` told agents to use `save_app` and `post` with `app` + `data` for a room app. These tools were removed. All copies now say `upload_file` `apps/<name>.html`, then `app_open`.
  - `listen.md` said `start_epic`, `open_doc`, then `update_doc`. `start_epic` with `answer: true` opens the document itself. All copies now say `start_epic` with `answer: true`.
  - The app height rule (`containerDimensions`, no scrollbars) and the `doc-history`, `router-feedback`, `live-page` and `choices` rules were not in the MCP instructions. They are there now.
  - `reply_quote` was not in the skill. `how_to_answer` had extra rules (`from_message_id`, no "Resposta:" paragraph, small talk stays in the chat, the existing answer epic in `read_room`). All copies have them now.
  - The skill and `llms.txt` did not have the approval rule of the MCP instructions (tell your human what, who and the results before you act outside vibebook). All copies have it now.
  - `report_issue` kinds were only in the tool description. The `acks` block names them.
  - The "Gui #NNNN" references in the MCP instructions and `llms.txt` are removed.
- Risk: medium. The words of the MCP instructions changed, and agents follow them. No tool name, argument or JSON shape changed.
- Undo: Revert the commit. The plugin version goes back to 0.24.13.
- Status: open

### 2026-11-18 · feat/guidelines-check · A ratchet baseline for the guidelines check
- Agent: claude-opus-5-5
- Context: The human asked for `scripts/guidelines-check.ts` with a baseline for old violations. The human did not say what a lower count does.
- Decision: The baseline has a count for each rule and file. A higher count fails. A lower count also fails and tells you to run `--update`, so that the baseline goes down with the code.
- Other options: Accept a lower count without a failure. Then a fixed violation can come back without a failure.
- Risk: low. A person who fixes old code must also commit the new baseline.
- Undo: Remove the `decreased` failure in `scripts/guidelines-check.ts`.
- Status: open

### 2026-11-18 · feat/guidelines-check · Scope and exemptions of the guidelines check
- Agent: claude-opus-5-5
- Context: The rules in `docs/stack.md` do not say exactly which text is a color, a breakpoint or a component level.
- Decision:
  - Colors: the check reads only `tw:` classes: a hex value in an arbitrary value (`tw:bg-[#fff]`, `tw:shadow-[…#0000000d]`), or a palette color (`tw:bg-red-500`, `tw:bg-white`). A hex string in TypeScript data (avatar palettes, brand icons in SVG) is not a violation.
  - Breakpoints: container queries (`tw:@min-3xl:`) are not screen breakpoints. The check permits them.
  - `fetch`: the check reads `svelte/features/`, `svelte/lib/` and the root files of `svelte/`. The gallery, the parity stories and `svelte/build/` are development tools.
  - Comment lines are not checked.
  - Atomic level: a component has the lowest level of the stories that import it, because stories also import smaller components as helpers.
- Other options: Read all hex strings, or treat container queries as breakpoints. These options give many false failures.
- Risk: low. A hard-coded color in an inline `style` attribute is not found.
- Undo: Change the regular expressions in `scripts/guidelines-check.ts`.
- Status: open

### 2026-11-18 · feat/room-sidebar-search · The DM search box in the room sidebar
- Agent: claude-opus-5-5
- Context: The human asked to put the search box of the DM sidebar in the room sidebar too. The box was a button inside `DmNav.svelte`.
- Decision: The box is now `svelte/features/app-navigation/SearchField.svelte`. `DmNav.svelte` and the room sidebar (`svelte/Sidebar.svelte`, under the room header) use it. Both open the same search dialog (⌘K), which searches all rooms. The label in a room is "Buscar" / "Search", because the long placeholder is cut in the sidebar and "Find or start a conversation" is about DMs.
- Other options: A search for only this room. The search API searches all rooms, so this needs a server change. Copy the button into `Sidebar.svelte`. Then the two copies can become different.
- Risk: low. The rail on desktop also has a search button, so the room has two ways to open search (the DM sidebar already had two).
- Undo: Remove `SearchField` from `svelte/Sidebar.svelte`.
- Status: open

### 2026-11-18 · feat/settings-page · Cloud agents on the settings page
- Agent: claude-opus-5-5
- Context: The human asked for one settings page (no menu, no dialog) that the account row opens. Sandboxes belong to one room, but the settings page is not in a room.
- Decision: The Cloud agents section has a room picker. It starts on the room you came from (`/settings?room=<id>#cloud`), else the room you opened last. "Cloud agent" in a room's sidebar foot and the phone agents pane are links to that section. The room agent session no longer makes its own sandbox and terminal sessions. I added `CloudSettings.svelte` and `SettingsNav.svelte`, because no existing component shows sandboxes outside a room or lists page sections in the sidebar.
- Other options: Keep sandboxes in the room agents pane and put only the keys on the settings page. That keeps two places for one feature. Make sandboxes account-wide. That changes the server model.
- Risk: medium
- Undo: Revert the commit. The account menu, the account sheet and the sandbox panel in the agents pane come back.
- Status: open

### 2026-11-18 · fix/two-breakpoints · Map the old breakpoints to mobile and desktop
- Agent: claude-opus-5-5
- Context: The human asked to move all old breakpoints (114) to the two breakpoints (mobile ≤900px, desktop ≥901px).
- Decision: `max-[720px]` and `max-sm` became mobile (`max-[900px]`). `sm`, `md` and `min-[640px]` became desktop (`min-[901px]`). `SIDEBAR_MOBILE_QUERY` changed from 767px to 900px. Screens from 641px to 900px now get the mobile layout everywhere, as the room already did.
- Other options: Map `sm` to mobile-first rules one by one. That keeps a tablet layout, which the two-breakpoint rule does not permit.
- Risk: medium. Tablets and narrow windows now see the phone home page and phone dialogs.
- Undo: Revert the commit.
- Status: open

### 2026-11-18 · fix/two-breakpoints · Home cards use an automatic grid
- Agent: claude-opus-5-5
- Context: The home "waiting on you" grid had 4 columns, 3 below 1200px, 2 below 900px and 1 below 720px. The 1200px step is a breakpoint inside the desktop width.
- Decision: Desktop uses `grid-cols-[repeat(auto-fill,minmax(250px,1fr))]`: 4 columns at the 1120px maximum width, fewer when the space is smaller. Mobile uses 1 column.
- Other options: A container query, or 4 fixed columns on all desktop widths (cards too narrow at 901px).
- Risk: low
- Undo: Restore the old grid classes in `svelte/features/home/HomePanel.svelte`.
- Status: open

### 2026-11-18 · fix/two-breakpoints · Repair the duplicate key in the changelog
- Agent: claude-opus-5-5
- Context: `scripts/changelog.json` had two `"en"` keys in the fixes of 2026-11-18. The first held three Portuguese lines. JSON parsers keep only the last key, so the public changelog did not show those Portuguese fixes.
- Decision: I moved the three Portuguese lines to `pt` and the English line to `en`.
- Other options: Leave it. Then the Portuguese changelog stays incomplete.
- Risk: low
- Undo: Revert the change to `scripts/changelog.json`.
- Status: open

### 2026-11-18 · fix/two-breakpoints · The md token is 901px, not 900px
- Agent: claude-opus-5-5
- Context: The human asked to make the built-in `md` token the breakpoint ("md become 900"), instead of pixel values in classes. Tailwind's `md:` means width ≥ md, and `max-md:` means width < md.
- Decision: `--breakpoint-md: 901px`, and all other breakpoint tokens removed (`--breakpoint-*: initial`). Thus `max-md:` is 900px or less (mobile) and `md:` is 901px or more (desktop): the same split as before. TypeScript uses `MOBILE_QUERY` (`(max-width: 900px)`) from `svelte/lib/breakpoints.ts`.
- Other options: `--breakpoint-md: 900px`. Then a 900px screen changes from mobile to desktop.
- Risk: low
- Undo: Change `--breakpoint-md` in `svelte/styles/tailwind.css` and `MOBILE_QUERY` together.
- Status: open

### 2026-11-18 · refactor/drop-tw-prefix · Remove the `tw:` prefix and the class namespace check
- Agent: claude-opus-5-5
- Context: The human asked to use Tailwind classes without the `tw:` prefix. The prefix kept Tailwind away from the vanilla CSS while both ran on one page. Now `ui.css` loads only on Svelte pages, and the vanilla Inbox bundle has no Tailwind classes.
- Decision: I removed `prefix(tw)` from `svelte/styles/tailwind.css` and from `tailwind-merge`, and I removed `tw:` from all classes. The style policy check "First-party class outside the Tailwind namespace" has no meaning without a prefix, so I removed it. I also removed the `style-check.ts` rule against unprefixed `.grid`/`.flex`/`.hidden` rules: `ui.css` loads only on pages whose `<body>` is `data-vb-native`. The checks for `<style>`, CSS files, inline styles and runtime class concatenation stay. The preflight stays scoped to `[data-vb-native]`.
- Other options: Validate each class with the Tailwind compiler. That adds an async compiler to a sync check for a small gain.
- Risk: low. Tailwind now also makes rules for plain words in the source that are utility names (`table`, `static`, `shadow`), about 25 unused rules. No element uses those words as a non-Tailwind class.
- Undo: Revert the commit.

### 2026-11-18 · feat/cf-migration · Do not copy the DocRoom and Person Durable Objects
- Agent: claude-opus-5-5
- Context: The account copy must keep all room data. `DocRoom` keeps the Yjs state of each document. `Person` keeps a cache of `/api/me`.
- Decision: The script copies only the `Book` SQLite. A new `DocRoom` loads its text from the `Book` document when it opens. A new `Person` fills its cache on the next request.
- Other options: Export the Yjs state of each `DocRoom` too.
- Risk: low. The Yjs edit history and an edit that the `Book` did not get in the last 1.5 s before the freeze are lost.
- Undo: Add `DocRoom` export and import methods to `src/migrate.ts`.
- Status: open

### 2026-11-18 · feat/cf-migration · Put the migration runbook in the project room
- Agent: claude-opus-5-5
- Context: The runbook is a plan. `docs/writing.md` says that plans go in the project room or in the pull request.
- Decision: I put the runbook in the doc of epic a256f2ae. `docs/architecture.md` tells only how the copy works.
- Other options: Write `docs/cloudflare-migration.md`.
- Risk: low
- Undo: Copy the epic doc section into `docs/`.
- Status: open

### 2026-11-18 · feat/cf-migration · Copy all data again on each run
- Agent: claude-opus-5-5
- Context: The human said that the move has no maintenance mode. The old Worker keeps writes until the switch.
- Decision: Each run of `scripts/migrate.ts` copies D1, the rooms and KV from the start. `--resume` continues only a run that stopped. R2 skips keys with the same size and etag on the target.
- Other options: Skip the rooms and tables that a previous run copied.
- Risk: medium. Data that people write between the last run and the switch stays only on the old Worker.
- Undo: Make `--resume` the default in `scripts/migrate.ts`.
- Status: open

### 2026-11-18 · chore/remove-migration · The migration code leaves after one copy
- Agent: claude-opus-5-5
- Context: The first copy from vibebook.dev to chat.decocms.com passed. The human said that vibebook.dev retires, so no final copy runs before a switch.
- Decision: I removed `src/migrate.ts`, the `Book` migrate methods, the `/migrate/*` route, `MIGRATE_TOKEN` in `Env` and `scripts/migrate.ts`. The `migration-dump/` line stays in `.gitignore` while local dumps exist. Data written on vibebook.dev after the copy stays there.
- Other options: Keep the code until a final copy at the switch.
- Risk: medium
- Undo: Revert this commit.

### 2026-11-18 · feat/single-worker · Links to the removed public pages go to llms.txt
- Agent: claude-opus-5-5
- Context: The human removed all public pages except `llms.txt`. The invite email, the setup card and the README linked to `/connect`, `/docs`, `/how-it-works`, `/herdr` and `/mcp-identity`.
- Decision: The setup links go to `/llms.txt`. The links about herdr and MCP identity go to the GitHub repository (`herdr-plugin/` and the Security model in `README.md`). The old page paths are not kept: the app moves to a new domain, so no link points to them (the human decided this).
- Other options: Redirect each old path to `/` or `/llms.txt`. Keep a short `/connect` page.
- Risk: low
- Undo: Revert the link changes in `src/rooms.ts`, `svelte/features/agents/SetupInstructions.svelte`, `README.md` and `public/llms.txt`.
- Status: open

### 2026-11-18 · feat/single-worker · The Svelte shell file is app.html
- Agent: claude-opus-5-5
- Context: The app moved from `/app` to `/`. With vanilla gone, the Svelte shell is the only shell. The human said that no link points to the old paths, because the domain changes too.
- Decision: `public/app-svelte.html` is now `public/app.html`. `/app` has no route. The PWA `id` and `start_url` are `/`.
- Other options: Keep the file name `app-svelte.html`. Redirect `/app` to `/`.
- Risk: low
- Undo: Rename the file back and revert `public/manifest.webmanifest`.
- Status: open

### 2026-11-18 · feat/single-worker · The vanilla-only HTML fallbacks are removed
- Agent: claude-opus-5-5
- Context: The human removed the vanilla app. Some routes had a vanilla answer: the access page, the file page, the consent page and the JSON or HTML errors of MCP sign-in.
- Decision: Each route now gives only the Svelte page. A file link with a bad id gets the JSON error. The vendor scripts of vanilla (marked, DOMPurify) and `public/_headers` are removed. The Book still writes the `ws_bytes` app column as `s`.
- Other options: Keep the server HTML pages as a fallback when the Svelte assets are missing (now a 503 text).
- Risk: medium
- Undo: Revert the commit.
- Status: open

### 2026-11-18 · fix/chat-previews · Worker Previews get their own storage, email and secret
- Agent: claude-opus-5-5
- Context: The human asked for working branch previews of `chat` and for `wrangler.jsonc` to be the `chat` configuration (the vibebook configuration is removed). Worker Previews inherit no bindings, so a preview build without a `previews` block fails or gives error 1101.
- Decision: The `previews` block binds new resources in the deco account: D1 `chat-preview`, KV `chat-preview-oauth`, R2 `chat-preview-files`. Each Preview gets its own Durable Object storage. The Preview base config has its own random `SESSION_SECRET`. Previews also get `EMAIL`, because sign-in is by emailed code. Preview builds are on in Workers Builds.
- Other options: Bind Previews to the production D1, KV and R2 (real data in public preview URLs). Give Previews no `EMAIL` (nobody can sign in).
- Risk: medium
- Undo: Remove the `previews` block, turn off preview builds and delete the three `chat-preview*` resources.
- Status: open

### 2026-11-18 · feat/deco-brand-icon · The PNG app icons are full-bleed
- Agent: claude-opus-5-5
- Context: The human asked for the deco favicon and brand icon from `~/code/studio`. The deco `favicon.svg` has rounded corners. iOS and Android put their own mask on an app icon.
- Decision: `public/favicon.svg` is the deco favicon, unchanged. `apple-touch-icon.png`, `icon-192.png` and `icon-512.png` have no rounded corners: `og/icon.html` fills the corners with the deco lime (`#d0ec1a`). The in-app brand icon stays `/favicon.svg`.
- Other options: Keep the rounded corners in the PNGs (the system shows white corners). Add a separate `deco-mark.svg` without the background for the app.
- Risk: low
- Undo: Revert the commit.
- Status: open

### 2026-11-18 · feat/ws-json-rpc · JSON-RPC on the room and person sockets
- Agent: claude-opus-5-5
- Context: The human asked for typed WebSocket messages in the JSON-RPC protocol, with no RPC library, for the Svelte app only.
- Decision: Only the wire edges changed (`shared/jsonRpc.ts`, `parseRoomCall`, `parseRoomEvent`, `Book.sendTo`, `Book.webSocketMessage`, `svelte/transport.ts`). The code keeps the typed tagged messages. A successful response has `result: null`. The data still comes in the events, as before. A refused command is error code -32000 with the reason. I removed the shim that accepted decision ids as strings from old tabs.
- Other options: Results that carry the data (for example `doc.get` returns the text). That is a larger change to each feature. It can come later, one method at a time.
- Risk: medium. A tab that still runs the old app cannot read the room socket until it reloads.
- Undo: Revert the commit.
- Status: open

### 2026-11-18 · feat/ws-json-rpc · The CLI hub moves to JSON-RPC, old CLIs keep tagged JSON
- Agent: claude-opus-5-5
- Context: The `vibebook listen` hub of the installed CLI holds a socket to the `Person` object (through `/mcp`) and reads `m.t`. The human said to move the CLI to the new format and keep the legacy one.
- Decision: CLI 1.6.21 connects to `/mcp?wire=jsonrpc`. It reads JSON-RPC notifications, and also the tagged JSON of an older server. The `Person` object tags each socket when it accepts it (`socketWire`): `/ws-me` and `?wire=jsonrpc` get JSON-RPC, plain `/mcp` gets the tagged JSON. I selected a query parameter, not a new path or a WebSocket subprotocol: the OAuth provider already routes `/mcp`, and a subprotocol needs the server to echo it.
- Other options: A new path such as `/mcp/ws`. The `Sec-WebSocket-Protocol` header.
- Risk: low
- Undo: Revert the CLI change and `socketWire`.

### 2026-11-18 · feat/studio-login · Sign-in is with deco Studio only
- Agent: claude-opus-5-5
- Context: The humans (the CTO and the owner) decided that chat signs people in with their deco Studio account, and that Google, GitHub and the emailed code go away. Studio is an OAuth 2.1 server with dynamic client registration (`/api/auth/mcp/*`).
- Decision: `/auth/studio/start` and `/auth/studio/callback` use OAuth 2.1 with PKCE as a public client, so chat keeps no client secret. Each origin registers itself at Studio the first time and keeps the client id in `OAUTH_KV`, so production, branch previews and local dev work with no configuration. The callback accepts only `email_verified: true`, because an unverified Studio email must not take an account here. The Studio picture is not copied: the old avatar code accepted only Google and GitHub hosts and is removed.
- Other options: One client id in `wrangler.jsonc` (previews could not sign in). Read the Studio session cookie (it belongs to `studio.decocms.com` only). Keep the emailed code as a fallback.
- Risk: medium
- Undo: Revert this commit and set the Google and GitHub secrets again.
- Status: open

### 2026-11-18 · ci/cancel-superseded-main · A newer push to main cancels the running CI
- Agent: claude-opus-5-5
- Context: The human asked that a new commit on `main` cancels the other runs and that only the latest commit runs. Before, a newer push replaced only a queued run. A running run (browser jobs, about 15 minutes) always finished.
- Decision: `cancel-in-progress: true` for every branch in `ci.yml`. `main-red.yml` already ignores a cancelled run when `main` moved on.
- Other options: Cancel only queued runs (the old behavior).
- Risk: low. When merges come faster than one CI run, no commit gets its browser jobs until the merges stop.
- Undo: Set `cancel-in-progress` back to `${{ github.event_name == 'pull_request' }}`.
- Status: open

### 2026-11-18 · feat/rename-deco-chat · A room is a "sala" or "room", not a "deco.chat"
- Agent: claude-opus-5-5
- Context: The human asked to rename vibebook to deco.chat in the app. The UI used "vibebook" for the product and also as the noun for one room ("Seus vibebooks", "Novo vibebook").
- Decision: The product name is "deco.chat". The noun for one room is "sala" (PT) or "room" (EN): "Suas salas", "Nova sala". The default room title is "Nova sala". A room titled "Novo vibebook" still gets an automatic title.
- Other options: "Seus deco.chats". "Seus chats".
- Risk: low
- Undo: Revert the commit.

### 2026-11-18 · fix/studio-verified · The Studio identity comes from the id_token
- Agent: claude-opus-5-5
- Context: Sign-in with deco failed for everyone. Studio (Better Auth `mcp()` plugin) lists `/api/auth/mcp/userinfo` in its metadata, but that path answers 404. Studio signs its `id_token` with a throwaway HS256 key, so no one can check the signature.
- Decision: The callback reads `email`, `email_verified` and `name` from the `id_token` that the token endpoint returns. It checks that `aud` is our client id and that `email_verified` is true. It does not check the signature: the token comes directly from Studio's token endpoint over TLS for a PKCE-bound code (OIDC Core 3.1.3.7 permits this). The step that fails goes to the Worker log.
- Other options: Add a userinfo endpoint or a real signing key to Studio first (a change in another repo). Call Studio's session API with the access token (it returns no email).
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-18 · feat/domain-chat · The CLI and the plugin talk to chat.decocms.com
- Agent: claude-opus-5-5
- Context: The app moved to chat.decocms.com. The CLI, the Claude plugin, the herdr plugin, the install scripts and the docs still used vibebook.dev. The human decided to keep the names (npm package `vibebook.dev`, command `vibebook`, plugin `vibebook`) and change only the domain.
- Decision: Every URL that a client or a person follows is now https://chat.decocms.com. The npm package name stays `vibebook.dev` in install commands. A login that the CLI saved for vibebook.dev stops with a message in English and Portuguese that asks for `vibebook login`, because a login token works only on the host that made it. `vibebook update` downloads from the new host. The CLI and the plugin hooks find a room from a `chat.decocms.com/b/<id>` link and also from an old `vibebook.dev/b/<id>` link. CLI 1.7.0, plugin 0.25.0.
- Other options: Let old logins continue on vibebook.dev until it is shut down (people would work on the old copy without notice). Rename the package and the plugin now.
- Risk: medium. Each person must run `vibebook login` once.
- Undo: Revert the commit and publish the previous CLI version.
- Status: open

### 2026-11-18 · feat/studio-avatar · Studio userinfo first, and the Studio picture as avatar
- Agent: claude-opus-5-5
- Context: Studio now has `GET /api/auth/mcp/userinfo` (decocms/studio#8567). Until it is deployed, that path answers 404. The removed avatar code copied the Google or GitHub picture at sign-in.
- Decision: The callback asks userinfo with the access token. If userinfo answers, its identity is used (the email must be verified). On 404 the callback uses the id_token claims, as before. The picture (`picture` from userinfo, `profile` from the id_token) becomes the avatar when the person has not uploaded one, with source `studio`. The Worker fetches only Google and GitHub picture hosts.
- Other options: Wait for the Studio deploy and then use userinfo only. Fetch a picture from any https host.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-18 · feat/digest-cron · Turn on the catch-up e-mail
- Agent: claude-opus-5-5
- Context: The 8h/18h digest cron was off until Email Sending worked on chat.decocms.com. It works now.
- Decision: Set `triggers.crons` to `0 11,21 * * *` (8h and 18h São Paulo). Previews get no cron.
- Other options: Keep it off.
- Risk: medium (it e-mails real people; only those with something new who did not turn mention e-mails off)
- Undo: Set `triggers.crons` to `[]` and deploy.

### 2026-11-18 · feat/login-straight-to-studio · /login goes directly to Studio, and a sign-out stays on the login page
- Agent: claude-opus-5-5
- Context: The human asked that `/login` go directly to the Studio OAuth, because it has only one button, and that the page show only after an error, to stop a loop. After a sign-out, `/login` (and `/`) would go to Studio again, and a Studio that is still signed in would sign the same person in again at once.
- Decision: `/login` without `error` or `out` redirects to `/auth/studio/start` (with `next`). Each sign-out goes to `/login?out=1`: the sign-out of this browser (it went to `/`), the sign-out of all browsers, and the "Not you?" form of the consent page.
- Other options: Go to `/` after a sign-out of this browser (that signs the person in again). Sign out of Studio too (deco.chat does not call Studio for the person).
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-18 · fix/herdr-app-switch-now · Off closes the Claude even when it works
- Agent: claude-opus-5-5
- Context: The human asked that "Ligar Claude" off stop or close the Claude of the room on the desktop at once. This replaces the earlier behavior (off only stops delivery, and the workspace stays open).
- Decision: Off closes the workspace (terminal mode) or the space (`--app`) at once, also when its Claude works. If the workspace or space has other terminals, the runner ends only the Claude of the room and keeps the rest. The runner keeps the session, and on again opens it with `--resume`.
- Other options: Wait until the Claude is free, then close it. That is slower, and the human asked for "immediately".
- Risk: medium. Work in progress stops. The conversation is kept.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/composer-focus-on-enter · The composer takes the focus when you enter a room or a DM
- Agent: claude-opus-5-5
- Context: The human asked that the composer have the focus when a person enters a room or a DM.
- Decision: The composer focuses its field when you enter a room, a DM or a thread (not when it mounts again in the same thread, for example after the Inbox closes: then the focus goes back to the Inbox button). It does not focus on a touch screen (`pointer: coarse`) or in the phone layout (`MOBILE_QUERY`), because the keyboard then covers the messages and the phone layout hides its tab bar while the composer has the focus. It does not take the focus from another field or from an open dialog.
- Other options: Focus on touch screens too. Focus only on a room change, not on a thread change.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/room-topbar-breadcrumb · Two new components for the top bar
- Agent: claude-opus-5-5
- Context: The human selected a breadcrumb in the desktop top bar (room › epic, board or inbox), the search at the top of the sidebar, and the epic actions as buttons in the bar (no "⋯"). `ThreadHeader` was the title of both the desktop bar and the phone sheet, so one component had two layouts.
- Decision: `RoomBreadcrumb` (room-shell) is the desktop bar. It uses the studio `Breadcrumb` atoms. The room crumb opens the main thread (`toMain` in `RoomScene`), also from the board, the inbox or a thread that is gone. `EpicActions` (room-sidebar) holds rename, archive, delete and their dialogs once, as a `menu` (phone sheet, in `ThreadHeader`) or as a `bar` (desktop: ✎, a labelled Archive that folds to its icon when the breadcrumb, a container, is narrower than `@xl`, and 🗑). `SearchField` is the 52px header row of each sidebar: room, DM and home, with the `⌘K`/`Ctrl+K` hint (`searchShortcut`, shared with the search dialog). There is no `track()` in the Svelte app yet, so these controls send no event.
- Other options: Keep the bar in `ThreadHeader` with more flags (one component with two layouts and more branches). Copy the action logic into the bar (two copies of the dialog safety checks).
- Risk: low
- Undo: Revert this commit.
- Status: partly replaced by "The sidebar names the room, the bar names the view" (feat/room-topbar-take2). `EpicActions` stays.

### 2026-11-19 · feat/room-topbar-breadcrumb · Rename the room from the top bar
- Agent: claude-opus-5-5
- Context: The sidebar header had the room name and its ✎. The human asked to remove that header, so on desktop the ✎ needed a new place.
- Decision: On the main thread, a ✎ follows the room crumb in the top bar. A DM has no ✎. The phone keeps the ✎ on the room's row in the sheet.
- Other options: Rename from a click on the crumb (a click on a crumb usually navigates). Rename only from the room settings.
- Risk: low
- Undo: Revert this commit.
- Status: replaced by "The sidebar names the room, the bar names the view" (feat/room-topbar-take2)

### 2026-11-19 · feat/room-topbar-take2 · The sidebar names the room, the bar names the view
- Agent: claude-opus-5-5
- Context: After #216 the human asked for the opposite: no search box in the sidebars, the room's name back at the top of the room sidebar, Home at the top of the DM and home sidebar, and the epic's buttons grouped before the pane tabs with a vertical line. The human accepted the recommended answers in the take 2 mockup.
- Decision: `SidebarHeader` (lib/components) is the 52px top row of each sidebar: the room's name (a click opens the main thread, ✎ on hover) or Home. Search stays on the rail and ⌘K. `RoomBarTitle` replaces `RoomBreadcrumb`: the bar names only the view ("Sala principal" in grey, the epic, the suggestion, "Quadro de tarefas", "Caixa de entrada"; a DM: the person), so the room's name is not shown twice. `EpicActions` `bar` puts ✎, Archive and 🗑 together, then a vertical `Separator`, before the tabs.
- Other options: Keep room › epic in the bar (the name shows twice). Show the room's name in the bar on the main thread (the repeat that #m3351 asked to remove). Icon-only Archive.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · chore/pencil-and-home · The DM sidebar is built like a room's
- Agent: claude-opus-5-5
- Context: The human picked option A in the DM sidebar mockup: "Mensagens diretas" names the sidebar, Home and "Você" sit where a room has its Main thread and Inbox. The mockup's two other questions (row size, requests) had no answer.
- Decision: The header is `SidebarHeader` with "Mensagens diretas" and the `+` (new message) at its end. Home and DM rows in the sidebar variant are small, like a room's rows: a 16px icon for Home, an `xs` avatar for a DM, and no status line. The phone's room list (`list` variant) keeps the big rows. "Pedidos" stays a section with its buttons. A "Conversas" section title shows only when there is a conversation.
- Other options: Keep the big 36px rows with the last message under the name. Make "Pedidos" one row with a count that opens its own view.
- Risk: low
- Undo: Revert this commit.

### 2026-11-19 · perf/immutable-chunks · Browser chunks are cached for one year
- Agent: claude-opus-5-5
- Context: The human asked to make navigation faster. Production served each `/svelte-preview/*` file with `max-age=0, must-revalidate`, so each page load sent about 80 revalidation requests (304).
- Decision: `public/_headers` gives `/svelte-preview/*` `Cache-Control: public, max-age=31536000, immutable`. Each file there has a content hash in its name, or (`app.js`, `ui.css`) a `?v=` content hash in each reference. `app.html` keeps revalidation, so a deploy still reaches people.
- Other options: Cache the chunks in the service worker (it has no fetch handler on purpose). Rename `app.js` and `ui.css` with a hash.
- Risk: low. A request for `app.js` without `?v=` stays cached; no code makes one.
- Undo: Delete `public/_headers`.

### 2026-11-19 · perf/lazy-message-toolbar · The message hover toolbar mounts on demand
- Agent: claude-opus-5-5
- Context: The human asked to make navigation faster. A profile showed that the hover toolbar of each message (8 quick reactions, reply, copy, link, each with a tooltip) was about 200 of the 300 ms to show a room with 60 messages.
- Decision: `svelte/Message.svelte` mounts `MessageActions` (floating) on the first `pointerenter` or `focusin` in the message. Until then, one visually hidden button ("Ações desta mensagem" / "Actions for this message") keeps the toolbar in the tab order. When it gets focus or a click (a screen reader in browse mode), the toolbar mounts and focus moves to its first button, or to its last button after Shift+Tab. The button is hidden on coarse pointers, like the toolbar. A swipe copy calls the mounted toolbar at once, inside the gesture (iOS allows the clipboard only there).
- Other options: Remove the tooltips from the toolbar buttons. Virtualize the message list. Keep one shared toolbar for the whole list.
- Risk: low. A screen reader user hears one "Actions for this message" button per message instead of the toolbar buttons until they activate it.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · fix/metrics-chat-worker · Drop the zone-wide daily totals in metrics
- Agent: claude-opus-5-5
- Context: The product report read the daily totals of the whole zone (`httpRequests1dGroups`). The zone is now `decocms.com`, which also holds the other deco sites, and that dataset cannot filter by host.
- Decision: I removed the zone-wide block (requests, unique visitors, cache, threats). The report keeps the Worker numbers and the per-kind and per-route lines, now filtered to our own host.
- Other options: Keep the block with a "all of decocms.com" label (numbers of other sites, not ours). Rebuild it from `httpRequestsAdaptiveGroups` per day (more queries, and the adaptive dataset has no unique visitors).
- Risk: low
- Undo: Restore `ZONE_Q` and its block in `productReport` (`src/reports.ts`).
- Status: open

### 2026-11-19 · fix/sidebar-one-scroll · The sidebar scrolls as one, with Show more
- Agent: claude-opus-5-5
- Context: The human asked for one scroll for the whole sidebar, the epics cut at what fits with "Show more", and roomy people and agent rows.
- Decision: No section scrolls inside (`sidebarSection.ts` is gone). EpicTree, PinnedItems, PeoplePanel and DmNav are `shrink-0` again inside the sidebar's single scroll; the foot stays sticky.
- Other options: Keep the per-section scroll for the DM sidebar only.
- Risk: low
- Undo: Revert this commit.

### 2026-11-19 · fix/snappier-room-switch · Shorter room-switch transition
- Agent: claude-opus-5-5
- Context: The human asked to make the room switch feel more snappy. The view transition froze the screen for up to 300 ms while it waited for the next room's state, then animated for about 260 ms.
- Decision: The wait is at most 120 ms. The old conversation fades out in 90 ms; the new one rises in 150 ms after 30 ms. The browser's crossfade of the rest of the page is 150 ms, not 250 ms (set from `browser.ts` with `updateTiming`, so no new CSS). I kept the custom router and did not add a routing library.
- Other options: No wait (the new room can show empty, then fill). SvelteKit `onNavigate` (a rewrite of the app shell). A Svelte SPA router (it does not remove the room-specific route code).
- Risk: low. A slow room can animate in before its messages arrive.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · chore/drop-native-naming · New names for the "native" code
- Agent: claude-opus-5-5
- Context: The human asked that no name tell that a second UI once existed. "Native" meant the Svelte port. Most names only lose the word. Some new names would collide with a name that is already in use.
- Decision: `NativeComposer` is now `ComposerForm` (`Composer` is its wrapper). `src/native-page.ts` is now `src/auth-page.ts`, and `shared/nativeAuth.ts` is now `shared/authPage.ts`. The colliding attributes are now `data-room-bar`, `data-room-sidebar-panel`, `data-setup-instructions`, `data-suggestion-preview` and `data-origin-id`. The app bridge is now `RoomAppBridge`. The `check:styles:native` subset is removed, because `check:styles` audits all of `web/`; its two policy tests now run in `check:styles`. "Native" stays where it means the browser, the OS (Web Push) or the product's chat cards.
- Other options: Other names. Keep the subset style check under a new name.
- Risk: low. Open branches that use the old names need a rebase.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · chore/vite-app-build · Wrangler builds the app; the shells are web/index.html and web/auth.html
- Agent: claude-opus-5-5
- Context: The human asked to stop committing the built app and to let Workers Builds build it, with the assets in `assets.directory`.
- Decision: Vite builds `web/index.html` and `web/auth.html` into `dist/` with hashed file names; `wrangler.jsonc` serves `dist/` and runs `bun run build:ui` in `build.command`, so `wrangler deploy` in Workers Builds builds first and the dashboard settings stay as they are. The auth pages have their own shell, and `src/auth-page.ts` adds the page metadata with HTMLRewriter (no more regex parsing of the app shell). `/app` is now a Worker route that serves the bare shell, as the static `app.html` did. `uiVersion.ts` and `check:bundle`'s drift check are gone; `check:bundle` now only builds. `public/cli.mjs` stays committed (it is the published CLI, not the app).
- Other options: Change the Workers Builds build command in the dashboard. Keep one shell and rewrite it for the auth pages. Remove `/app` and change the tests and links.
- Risk: medium. If Workers Builds does not run `build.command`, the deploy fails (the running version stays).
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · chore/final-vanilla-sweep · One socket byte count per event kind
- Agent: claude-opus-5-5
- Context: `Book.sendTo` counted socket bytes per UI (`c`). Only one UI is left, so `c` was always "s", and the product report printed "(svelte)" on each line.
- Decision: Count sends per event kind only. New `ws_bytes` events have no `c` dimension, and the report groups by kind. The Durable Object table keeps its `c` column (existing rooms have it), always "". No data is deleted.
- Other options: Keep `c` as "s". Drop the column with a migration in each room.
- Risk: low. For the hours around the deploy, old events with `c` and new ones without it sum into the same line.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · chore/drop-app-route · Browser tests open a separate gallery build
- Agent: claude-opus-5-5
- Context: The human removed `/app` and the `?gallery=1` branch of `web/main.ts`, so the gallery is not in `dist/`. The room layout and design-system browser tests opened the gallery at `/app?gallery=1`.
- Decision: `bun run build:gallery` (`vite build --mode gallery`) builds only `web/dev/gallery.html` into `dist-gallery/` (not in git, not deployed). `scripts/browser-static-gallery.ts` serves that build on a free loopback port. `room-layout-browser.ts` and the gallery part of `design-system-browser.ts` open `/dev/gallery.html` there. The Inbox part still uses the Worker. The CI `browser-ui` job runs `build:gallery` and gives `TEST_GALLERY_ROOT`.
- Other options: Start the Vite dev server in the tests and open `/dev/gallery.html` (source, not built assets). Keep the gallery in the production bundle behind a query parameter.
- Risk: low. The gallery build uses the same Vite configuration and components as `dist/`, but it is a different bundle, so a bundle-only defect in `dist/` is not seen by these tests.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · one-html-shell · One HTML shell for the app and the auth pages
- Agent: claude-opus-5-5
- Context: The human approved one shell. Vite built two: `web/index.html` (the app) and `web/auth.html` (sign-in, consent, access, file-access and connection pages).
- Decision: `web/auth.html` is gone. `authPage()` reads `/` (the built `web/index.html`) and adds `robots: noindex` with the page meta tags. Auth pages do not get `vb-v`. The `<noscript>` text is now in `web/index.html`. The auth layout (`AuthFrame.svelte`) owns its background: it already has `min-h-dvh bg-background`, so the `md:bg-sidebar` of the app body does not show on desktop. No change to it was necessary. Auth pages now get the theme script of the shell before the first paint. A dark theme gives a dark sign-in page (`mount.ts` already did this after mount). The `antialiased` class of the app body makes the text of the auth pages a little thinner on macOS. That is the only visible difference in the screenshots.
- Other options: Keep two shells. Remove `md:bg-sidebar` from the shell body and put it in the app layout. Remove `antialiased` for auth pages.
- Risk: low. Before the script loads, a desktop auth page shows the sidebar colour for a moment (the app shell does the same). `/auth` is no longer a static asset; the Worker answers it (404 or 401).
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · settings-sidebar-like-dms · Settings rows use the Home row icon
- Agent: claude-opus-5-5
- Context: The human asked that the `/settings` sidebar look like the `/` sidebar: "Configurações" / "Settings" in the header, no `+`, the Home row, then the settings sections. A DM row shows a small avatar. A settings section has no avatar.
- Decision: `SettingsNav.svelte` now uses the same pieces as `DmNav.svelte`: `SidebarHeader` with the same `h2`, the same `ul` and `HomeRow`, and `RoomRow` (sidebar variant) for each section. Each section row shows its icon at 16px in `text-muted-foreground`, the same as the Home row icon. The old 36px tile and the small "Settings" label above the sections are gone. I did not add a component.
- Other options: Put the section icon in a tile of the size of the DM avatar. Keep the 36px tile.
- Risk: low. Only the `/settings` sidebar on desktop changes. Phones do not show this sidebar.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · edit-room-dialog-icon · The room pencil opens "Edit room" with the icon field of Settings
- Agent: claude-opus-5-5
- Context: The human asked that the pencil next to the room name open a dialog for the name and a new image, and that it reuse the existing room icon upload.
- Decision: The rename dialog is now "Editar sala" / "Edit room". An `iconField` snippet in `AppNavigationDialogs.svelte` shows the icon (`RoomMark`, `lg`), "Trocar ícone" and "Tirar ícone". It uses `roomIconPng` and `rooms.icon`. The Settings dialog uses the same snippet, so its plain file input is replaced by the preview and the buttons. `RoomMark` takes an optional `size`. The pencil label is now "Editar sala". I did not add a component.
- Other options: Add the icon only to the rename dialog and keep the Settings file input. Make a separate `RoomIconField` component.
- Risk: low. The Settings dialog looks different. The upload and the API are the same.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/device-notification-switches · New DeviceAlerts component for two switches
- Agent: claude-opus-5-5
- Context: The human asked for two switch rows (Notifications, Sound) under "This device" on `/settings`, in place of the bell and the dialog. No existing component draws a settings row with a description and an inline error.
- Decision: I added `web/features/notifications/DeviceAlerts.svelte`. It uses `Switch`, `Button` and `Spinner` from `web/lib/studio/`. `AccountPanel` gives it its row and hint classes through the `notifications` snippet. The enable steps and the migration are pure functions in `web/features/notifications/device.ts`, so tests can run them.
- Other options: Write the rows directly in `AccountPanel.svelte`. That puts push logic into the account panel.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/device-notification-switches · The test push goes only to this device
- Agent: claude-opus-5-5
- Context: Turning Notifications on sends a test notification. `/api/push/test` sent it to every device of the person.
- Decision: `/api/push/test` accepts an optional `endpoint`. The app sends the endpoint of this device, so other devices do not get the test. The server reads the first name from `users.name`. If there is no name, the text has no name. The server tracks `push_test`. The Sound switch is local only and sends no event.
- Other options: Keep the push to all devices. Show a local notification from the service worker without a push. That does not test the push path.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/device-notification-switches · Notifications switch stays on after a failure
- Agent: claude-opus-5-5
- Context: The turn-on steps can fail after the permission: subscription, server or test push. The human asked for an inline error and "Try again".
- Decision: After the browser grants the permission, the switch stays on. The row shows the error and "Try again", which runs the same steps again. If the person closes or blocks the prompt, the switch goes back to off. If the push service accepts 0 test notifications, it counts as a failure. On iPhone Safari without the app installed, the device section also shows `InstallCard`, and the row has the install steps.
- Other options: Turn the switch off after each failure. Then "Try again" is the same as the switch.
- Risk: low
- Undo: Revert this commit.

### 2026-11-19 · feat/dm-presence · DM presence: contacts, refresh and reply
- Agent: claude-opus-5-5
- Context: The human approved Person-to-Person presence for the DM list, with a grace period. The contact source, the staleness rule and the shared dot were open.
- Decision: The contacts are the people of the DMs that have a message (one D1 read in `dmContacts`, only on a transition), the same people whose DM list shows you. While online, the alarm sends `online` again every 30 minutes; a stored `online` older than 75 minutes is offline. When a `Person` hears from a contact that it did not know, it answers one time with its own state (`reply`), so a new DM gets both dots. I made `web/lib/components/PresenceDot.svelte` from the dot of `PeoplePanel`, and both lists use it.
- Other options: Read the contacts from the cached `/api/me` in the `Person` (it is often missing or stale). Give a contact's state no expiry (a lost "offline" stays forever). No refresh (a missed message stays until the next change). Copy the dot classes into `RoomAvatar` (two copies of one visual).
- Risk: low
- Undo: Revert the commit. The `Person` storage keys `announced`, `email` and `p:*` then stay unused.
- Status: open

### 2026-11-19 · image-picker · One picker for a person's photo and a room's icon
- Agent: claude-opus-5-5
- Context: The human chose direction B of the picker brainstorm: a badge on the picture that is always visible, a click opens the file picker, and an image dropped on the picture is taken. The human asked for one component for the photo and the room icon.
- Decision: New molecule `web/lib/components/ImagePicker.svelte`. No existing component wraps a picture as a button with drop. The caller draws the picture, converts the file (`avatarImage` or `roomIconPng`) and saves it. It replaces the "Change photo" button in Account, the photo button in onboarding, and the icon button in Edit room and room settings. The badge uses the `camera-01` icon (added by the icon sprite change). A file over the picture shows a dashed outline and an upload icon. Busy shows a spinner. Account passes only `disabled`, because its profile phase is the same for a name change and a photo change.
- Other options: A hover overlay (direction A). A dropzone row (direction C). A pencil badge.
- Risk: low. The upload calls and the image conversion are the same. Remove icon stays a separate text button.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/icon-sprite · The icon sprite is a Vite asset
- Agent: claude-opus-5-5
- Context: The human asked for one static, cacheable SVG sprite for all icons. The human did not say where it lives or how the Worker serves it.
- Decision: The sprite is `web/lib/studio/icons.svg`. `Icon.svelte` imports it with `?no-inline`, so Vite writes `dist/assets/icons-<hash>.svg`. `public/_headers` already gives `/assets/*` one year `immutable`. A new icon makes a new hash. The service worker has no cache, so the sprite has the same offline behavior as the app shell.
- Other options: Put the sprite in `public/`. It then has no hash and no long cache. Inline the sprite into `index.html`. Each page load then sends all icons again.
- Risk: low. A `<use>` to a file works only on the origin of the app. No iframe and no email uses `Icon.svelte` now.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/icon-sprite · icons.ts is the source, the sprite is committed
- Agent: claude-opus-5-5
- Context: The human asked that the sprite and the `IconName` union come from one place.
- Decision: `web/lib/studio/icons.ts` has the `d` of each path, by name. `IconName` is `keyof typeof icons`. `bun scripts/icon-sprite.ts` writes `icons.svg`, and I commit it. `bun run check:icons` fails if the sprite is different, or if a file in `web/` imports a value from `icons.ts`.
- Other options: A Vite plugin that makes the sprite at build time. The Bun DOM tests and `svelte-check` then need the plugin too. Make the SVG the source and generate the TypeScript union. The type then comes from a generated file.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/icon-sprite · Two icons that are not Untitled UI
- Agent: claude-opus-5-5
- Context: `AgentFoot.svelte` drew a laptop and `paneIcons.ts` drew the ✻ of the agents with their own SVG data. Neither is in `@untitledui/icons`.
- Decision: Both are in the sprite as `app-laptop` and `app-agents`, in a separate `appIcons` group. The ✻ was three `<line>` elements with `rotate`. It is now one path with the same end points, rounded to 0.001.
- Other options: Use `laptop-02` from Untitled UI. That changes how the agent foot looks. Keep a second inline-SVG code path in `Icon.svelte`. That keeps the old way.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/inbox-triage · The Inbox is a triage list
- Agent: claude-opus-5-5
- Context: The human chose direction A of the Inbox brainstorm: compact rows, Reply, Open and Resolve on each row, and "Resolve all". The human asked for loading states and an animation when an item is resolved.
- Decision: `RoomInbox` shows one list, newest first, two lines for each item, with the Markdown removed (`inboxPreview`). The "O que é seu" panel is gone. Its reviews are rows of the list, and your tasks are behind the "Suas tarefas" chip. Chips filter by kind. In "Todas as salas", the list has one group for each room. Asks have a checkbox and a bar to resolve the selected asks. Reply opens a composer under the row and posts in the item's thread (`inbox.reply`). Keys: j, k, o, r, e, x.
- Other options: A list with the conversation beside it (direction B). One item at a time (direction C). Keep the "O que é seu" panel.
- Risk: medium. The Inbox looks different, and your tasks are one click away now.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/inbox-triage · Resolve waits 5 seconds, with Undo
- Agent: claude-opus-5-5
- Context: "Resolve all" removes many asks at once. The human asked for Undo, not a confirmation.
- Decision: `inbox.resolveLater` hides the asks at once and sends them after `INBOX_UNDO_MS` (5 s). "Desfazer" puts them back. If the Inbox closes first, the asks go at once. One new route, `POST /api/waits/resolve-many`, deletes up to 200 asks of the signed-in person in one batch. A row collapses for 200 ms before it leaves (Tailwind `grid-rows` transition, 0 with reduced motion).
- Other options: A confirmation dialog. Send at once and add a route that puts the rows back.
- Risk: low. If the tab closes in the 5 seconds, the asks stay open.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/inbox-triage · The controls of a view go in the top bar
- Agent: claude-opus-5-5
- Context: The human asked that "Esta sala / Todas as salas" and "Resolver todos os pedidos (n)" go in the top bar, after a vertical divider, and that the docs make this a rule.
- Decision: `RoomHeader` takes a `viewControls` snippet. It draws it before the pane tabs, then a vertical `Separator`. `InboxControls` is the Inbox's snippet. On phones, `RoomInbox` draws the same component at its top. The rule and the steps are in the new `docs/design.md`, with the list and feedback rules.
- Other options: Keep the controls in a header inside the Inbox.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/people-remove-and-dm · The name opens the DM, not the row
- Agent: claude-opus-5-5
- Context: The human selected "any member removes any member, except the owner", and asked that a click on a person in "Pessoas e agents" opens the DM with that person.
- Decision: Only the name is a button that opens the DM (the app's `connect`). The avatar keeps its online tooltip, and the ✕, "copiar" and "reenviar" stay as they are. A pending invite has no link. A member cannot remove himself or herself with the ✕ (there is no "leave the room" in this list).
- Other options: Make all of the row a link. Let a member remove himself or herself.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · fix/pwa-splash-mark · The PWA splash shows the deco mark without the lime square
- Agent: claude-opus-5-5
- Context: The human said that the splash screen of the installed app shows a lime square with the `d`, and asked for only the `d` there. The human wants to keep the lime square on the app icon.
- Decision: Android makes the splash from the manifest icons with `purpose: "any"`, and the launcher icon from the `maskable` icons. The `any` icons are now `icon-mark-192.png` and `icon-mark-512.png` (transparent, made from `og/icon-mark.html`). The `maskable` icons are the lime `icon-192.png` and `icon-512.png`. iOS uses `apple-touch-icon.png` (lime), unchanged. The install card and notifications use `icon-192.png`, unchanged.
- Other options: Keep one lime `any` icon at 192 px for the desktop install icon (the desktop icon then mixes two images at different sizes).
- Risk: low. A desktop install (Chrome on Windows or macOS) can show the mark without the lime square.
- Undo: Revert this commit.
### 2026-11-19 · fix/composer-keeps-sent-text · Compare the sent text, do not lock the field
- Agent: claude-opus-5-5
- Context: A phone keyboard can send an input event with the same text after Enter. The composer counted it as an edit, kept the sent text in the box, and people sent the message again (two copies in a DM).
- Decision: An input event with the same text is not an edit. When the message arrives, the box clears if it holds the same text, reply and files as the message that was sent.
- Other options: Lock the text field while the message is sent. That stops fast typing of the next message, which the composer supports now.
- Risk: low
- Undo: Revert the commit.
- Status: open

### 2026-11-19 · feat/inbox-triage · The home's Inbox is a page at /?inbox
- Agent: claude-opus-5-5
- Context: The human asked for an Inbox row under Home in the direct messages sidebar, always for all rooms. The room Inbox close button (X) is gone too, so the sidebar Inbox button closes a room's Inbox.
- Decision: The Inbox row (`InboxRow`) opens `/?inbox`. That is the home route with `inbox: true`. On that route, `HomeInbox` shows the same triage list as a room (`RoomInbox`), with a bar that holds "Resolve all". An Inbox without a room shows all rooms (`roomInboxModel`), and `InboxControls` hides "Esta sala / Todas as salas". The waiting count moves from the Home row to the Inbox row, like a room shows it on its Inbox and not on its Main thread. Two new components: `InboxRow`, because `HomeRow` is Home's row on the phone room list too, and `HomeInbox`, because `RoomInbox` has no top bar of its own.
- Other options: A `/inbox` path, but it needs a change to `run_worker_first` in `wrangler.jsonc`, and a human must approve deploy configuration. The old Inbox dialog (`Inbox.svelte`), but it is not the triage list. Keep the count on Home too.
- Risk: low
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · fix/pwa-splash-android · Android gets its own manifest, sized so that only the splash takes the transparent mark
- Agent: claude-opus-5-5
- Context: The entry "The PWA splash shows the deco mark without the lime square" is wrong. Chrome on Android makes the splash from a `maskable` icon first (`ShortcutInfo::UpdateBestSplashIcon`), not from an `any` icon. That change only made the desktop icon the bare mark. The human wants the lime icon on desktop and on the phone, and the transparent mark only on the splash.
- Decision: `public/manifest.webmanifest` has the original lime icons again (desktop, iOS). On Android, a script in `web/index.html` changes the manifest link to `public/manifest-android.webmanifest`. Its `maskable` icons are a lime `icon-maskable-332.png` and a transparent `icon-splash-512.png` (made from `og/icon-splash.html`, the mark in the safe zone). Chrome takes the smallest icon that is not smaller than the ideal size: 83dp for the launcher and 128dp for the splash. For a screen density from 2.625 to 4, the launcher (218 to 332 px) takes the lime 332 px icon and the splash (336 to 512 px) takes the transparent 512 px icon. Desktop Chrome on macOS takes the largest `maskable` icon, so the desktop manifest must not have the transparent icon.
- Other options: Serve the manifest from the Worker by user agent (changes `run_worker_first` in `wrangler.jsonc`). Accept the lime square on the splash.
- Risk: medium. It depends on the sizes in Chromium. On a screen with density 2 (xhdpi), the splash shows the lime icon. If Chromium changes the sizes, the launcher can show the transparent mark.
- Undo: Revert this commit.
- Status: open
