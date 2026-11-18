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
