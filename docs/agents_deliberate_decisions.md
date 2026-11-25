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

### 2026-11-24 · refactor/thread-done · A thread is done, never archived

- Agent: claude-opus-5-5
- Context: Gimenes asked to purge "archived" for threads from the code base (#4466) and selected "everything, also the column (migration)" (#4505). He did not say how to migrate each room, what to do with agents that still send `archived`, or if the room archive changes (he did not select that option).
- Decision:
  - In each room, the Book renames `epics.archived` to `epics.done` (`ALTER TABLE … RENAME COLUMN`) when it starts, before the loop that adds missing columns. Otherwise that loop adds an empty `done` and every done thread opens again. The values stay: 1 = done, -1 = a person opened it again, 0 = open.
  - The wire field `Epic.archived` becomes `done`. The socket command `epic.archive` becomes `epic.done`, the Done tab state is `done`, and `archiveEpic` becomes `setDone`.
  - MCP: `update_thread` documents only `status`. It still accepts `archived` and `mark_done` without documentation, because agents with an older plugin send them. `read_room` and `search` send `done`.
  - The thread texts that were not used ("Desarquivar thread", "Arquivar thread", "Arquivado") are removed. The old `dismissed` status shows as Feito.
  - Unchanged: the room archive ("Arquivar sala", `members.archived_at`, `/archived`), the old entries in this file, and the words in the mark_done question ("pode arquivar", "arquiva essa"), because people still type them.
- Other options: Keep the column and rename only the code (the column was part of the request). Drop the column and read only `status` (-1 has no place in `status`). Refuse `archived` from old agents (their `update_thread` calls fail).
- Risk: medium. After the deploy, a plain revert reopens every done thread, because the old code adds an empty `archived` column.
- Undo: Revert the commit and also add a reverse rename (`RENAME COLUMN done TO archived`) before the add-columns loop.
- Status: open

### 2026-11-24 · feat/router-action-cases · One feedback table for all of the router, with suggested cases

- Agent: claude-opus-5-5
- Context: Gimenes asked for reports and a self-improving loop for every part of the router, not only wake (#4481). He selected "1 + 2 + 3" and asked to move the old table into the new one (#4483), with the name `router_feedback` (#4485). He did not say which undo signals to use, how long "soon" is, or how the old table goes away.
- Decision:
  - One D1 table `router_feedback`, key (room, message, action, who). `action` is "wake" or the name of a router action or reading. The list comes from `ROUTER_ACTIONS` and `ROUTER_READINGS` (`FEEDBACK_ACTIONS`), so a new action gets reports and its own bench part ("<action> (D1)") with no other change.
  - The old rows of `router_cases` are copied with `INSERT OR IGNORE` in the schema. The old table stays and nothing writes to it. The bench reads it only if `router_feedback` does not exist yet (before the deploy).
  - Three undo signals write a `suggested` row: a thread opened again within 30 minutes after a Jev close, a reply thread the router made and a person deleted within 30 minutes, and a wait the router read that its person cleared with the Inbox's ✓. "Resolve all" does not count, because it is cleanup. A suggested row does not run in the bench. The person's agent asks them (`router_feedback_suggested`) and records the answer as a `case`. A suggestion never replaces a case.
- Other options: One table for each action. Run suggested rows in the bench (a reopen is not always a router mistake). Drop `router_cases` (a destructive D1 change).
- Risk: low. A wrong suggestion only makes an agent ask one question.
- Undo: Revert the commit. The table and its rows stay, unused.
- Status: open

### 2026-11-24 · feat/router-bench-all · Every router bench case must pass, with the D1 cases

- Agent: claude-opus-5-5
- Context: Gimenes raised the bar (#4444, #4462): every case must pass, the repository cases and the production cases in D1, and the CI must read D1. He creates the Cloudflare token. He did not say how to handle Jev's noise or what CI can print.
- Decision:
  - A case that fails runs two more times. It passes only if both of those pass (2 of 3). A false yes is counted when the case still fails.
  - The compare fails when a part of the pull request is under 100% or has a false yes, as well as when a score goes down. A part that main does not have must also pass all its cases.
  - The D1 cases are their own part ("acordar (D1)"). The bench prints only their number and note, never their text, because the repository and its CI logs are public.
  - The bench reads the database `chat` with `bunx wrangler` (it read `vibebook` with `npx`, which does not exist, so `--d1` never worked). CI needs only `CLOUDFLARE_API_TOKEN`; the account ID is in `wrangler.jsonc`.
- Other options: Run each case 3 times always (3 times the cost). Fail on the first miss (Jev's noise fails good pull requests). Keep the D1 cases in the same part as the repository cases.
- Risk: medium. A pull request that does not touch the router's behavior can fail on a case that Jev misses 2 of 3 times. Then fix the question or the case, or ask a human.
- Undo: Revert the commit, and delete the `CLOUDFLARE_API_TOKEN` secret.
- Status: open

### 2026-11-24 · fix/email-theme · The e-mails use the app's light theme

- Agent: claude-opus-5-5
- Context: Gimenes said that the digest e-mail has the wrong background color and fonts (#4457). All e-mails use one layout (`emailHtml` in `src/auth.ts`), which still had the old blue theme and a Caprasimo title. He did not give the new colors.
- Decision: The layout and the inline colors of the digest, mention and invite e-mails take the app's light tokens from `web/styles/tailwind.css`: the page is `--vb-muted`, the card is white with `--vb-border`, the text is `--vb-foreground`, the secondary text is `--vb-muted-foreground`, links are `--vb-link`, and buttons are `--vb-primary` (near black) with white text, as in the app. The font is Inter (from Google Fonts) with system fallbacks, and the title is Inter 600. The e-mail stays light only (`color-scheme: light`).
- Other options: Lime brand buttons (`--vb-brand`). A dark version for mail apps in dark mode.
- Risk: low. Only the look of the e-mails changes. A mail app that blocks web fonts shows the system font.
- Undo: Revert the commit.
- Status: open

### 2026-11-24 · feat/phone-message-actions · Hold a message on the phone to open its actions

- Agent: claude-opus-5-5
- Context: Gimenes asked for the message actions on the phone (#4402). He approved a long press that opens a sheet (#4437, #4440), and said to keep only the right swipe, for reply. He did not give the time, the order or the reactions in the sheet.
- Decision:
  - Holding a message for 500 ms without moving more than 8 px opens a sheet from the bottom. Android's own long press (a contextmenu event) opens the same sheet, only once.
  - The sheet has, from the top: six quick reactions and "more reactions", then Reply, Create thread, Copy text, Copy link, Edit, History, and Delete (in red, last). Each row closes the sheet, then acts. A row shows only when the hover toolbar shows the same button.
  - The sheet is in `MessageActions`, next to the toolbar, so it uses the same copy, edit, delete and history code.
  - The left swipe (copy and link) and the long right swipe (thread) are gone. A right swipe of any length replies.
  - On a touch screen, a message is not selectable (`select-none`, no iOS callout), because a long press opens the sheet. "Copy text" in the sheet copies it.
- Other options: A bar of buttons that a tap shows. Keep the long right swipe for a thread.
- Risk: low. People cannot select a part of a message on a phone. They copy all of it from the sheet.
- Undo: Revert the commit.
- Status: open

### 2026-11-24 · feat/router-actions-waits · The router questions at the 0.8 floor

- Agent: claude-opus-5-5
- Context: Gimenes fixed every action threshold at 0.8 (#4435) and asked for adversarial review agents to find a better use of Jev. He did not choose the variant.
- Decision:
  - Three review agents (wording, call structure, new cases) gave 32 new bench cases and four variants. The bench ran each variant with the real Jev.
  - `answer_thread`: one short positive question plus two vetoes (V3). It got 22/22, also the "llm or regex?" case.
  - `mark_done`: the new wording without vetoes (V1). It got 35/35. The vetoes stopped true cases ("pode fechar" at 0.95).
  - The waits question gets one sentence: a request to the author's Claude to ask a person ("pergunta pro Bruno…") does not wait on that person.
  - The veto threshold is 0.5 (`VETO`).
  - The waits threshold stays 0.7, as before in production. The 0.8 floor is for actions only.
- Other options: Two calls (actions without the room context, V2: 34, 21). Vetoes on both actions (V3: mark_done 30). The old questions at 0.8 (V0: 33, 18, two false yes).
- Risk: low. In two runs of V4, one true case missed once ("arquiva essa" at 0.78). No false yes in either run.
- Undo: Revert the questions in `src/routerActions.ts`.
- Status: open

### 2026-11-24 · feat/router-actions-waits · Router actions, stage 2: waits joins the router's Jev call

- Agent: claude-opus-5-5
- Context: Gimenes approved the 3 stages (#4379) and asked to start the follow-ups (#4425, #4426). Stage 2 moves "who waits on whom" (`findWaits`) into the one Jev call of the router actions. He did not say how.
- Decision:
  - A new kind of registry entry, a reading (`ROUTER_READINGS`): questions that join the same call, whose answers the room keeps. `waits` is the first one.
  - For a message of a person, only the question "does this ask something of Ana?" moves. The question "does this answer an earlier ask?" is not needed there: `answeredHere` already deletes the author's earlier waits in that thread.
  - Waits now appear at once, not about 30 seconds later.
  - `findWaits` keeps the messages of agents (the router actions do not see them) and the messages of people that the router pass did not read, 2 minutes after the message.
  - The bench runs each case as production does: all actions and readings in one call, in a room with three other people.
- Other options: Keep `findWaits` on the alarm and only share the prompt. Move the messages of agents into the router pass too.
- Risk: medium. With more questions and more context in one call, Jev can score `mark_done` or `answer_thread` differently. The bench shows it.
- Undo: Remove `waits` from `ROUTER_READINGS` and the skip in `findWaits`.
- Status: open

### 2026-11-24 · feat/router-actions · How the router bench check compares

- Agent: claude-opus-5-5
- Context: Gimenes approved a GitHub Actions check for the router bench (#4412, #4414). He did not say what "worse" means or which version of the cases the base runs.
- Decision:
  - The check runs the branch's bench script and cases on main too, so both sides answer the same questions. A part that main does not have (for example the router actions before they merge) is "new": it is shown, not compared.
  - It fails when a part's score goes down, when an action has more false "yes" answers, or when a part is gone.
  - It is not a required check. Gimenes can make it required in the branch protection.
- Other options: Compare with stored scores in the repository (they go stale). Allow a small drop (Jev can move by a case between runs).
- Risk: low. Jev can answer a case near the threshold differently between runs, and then the check fails without a real change. Run it again, or move the case's threshold.
- Undo: Delete `.github/workflows/router-bench.yml`.
- Status: open

### 2026-11-24 · feat/router-actions · Router actions, stage 1: the registry, answer_thread and mark_done

- Agent: claude-opus-5-5
- Context: Gimenes asked for router actions (#4369): actions that the server does without the person's agent, in one shape, so that future actions follow a template. He approved 3 stages (#4379). He did not give the thresholds, the message length, or how a person sees a wrong guess.
- Decision:
  - `src/routerActions.ts` holds the registry. Each action has `when` (synchronous), `ready` (asynchronous, optional), `exact`, `question`, `threshold` and `run`. All the actions that apply to a message share one Jev call.
  - `answer_thread` is the old `answerIntent`, with the same question and the same threshold (0.7).
  - `mark_done` keeps the exact phrase, without a model. Jev is asked only for a message of 60 characters or less in an open thread, with a threshold of 0.8. A short message is usually a closing word, so the cost and the false hits stay low.
  - When Jev closes a thread, the server posts "✓ Marquei esta thread como feita. Escreva qualquer coisa aqui para reabrir." Any message from a person already opens a done thread again, so no new undo control is necessary.
  - Without `MODEL_JUDGE` (tests) or with it set to `off`, only the exact phrases act.
- Other options: Ask Jev about every message in a thread. Add an undo button that calls a server command.
- Risk: medium. A wrong guess closes a thread. The line in the thread says so, and one message opens the thread again.
- Undo: Remove the `mark_done` question (keep `exact`), or revert the commit.
- Status: open

### 2026-11-24 · feat/ack-doing-status · Which threads an agent's ack moves to Fazendo

- Agent: claude-opus-5-5
- Context: Gimenes (#4368) asked to remove the ✻ in the thread list and to move the thread to "doing" when an agent works on it. He did not say which statuses change.
- Decision:
  - Only an ack with `doing` on a message in a thread moves it, and only from A fazer. Review and done stay: a person set them. An archived thread stays archived.
  - An ack on a message in main changes no thread.
  - The ack does not move the thread back when the agent finishes. The thread stays Fazendo until a person or the tasks change it.
  - The ✻ goes from the thread row only. The ✻ under a message in the chat ("X está trabalhando nisso") stays.
- Other options: Move review back to doing too. Show Fazendo only while the ack is open (a computed status, not a stored one).
- Risk: low. A thread can show Fazendo after the agent stopped, until somebody changes it.
- Undo: Revert the commit.
- Status: open

### 2026-11-24 · feat/notify-offer · One notifications offer for each device

- Agent: claude-opus-5-5
- Context: Gimenes asked for notifications on by default (#4354) and picked both ways to get there (#4363): a banner and the first send. A browser shows its permission prompt only from a click or a key, so the app cannot turn them on alone.
- Decision:
  - A device that never chose (permission "default", switch off, push supported, not iOS web) gets one offer. `vb.notifyAsked` in localStorage records that the offer happened. After that, only `/settings` turns notifications on.
  - The banner is a row at the top of the room's attention area and a card at the top of Home. "Ativar" asks the browser. The × only records the offer.
  - The composer's send asks the browser on the first send of a device, in the same gesture, before the message goes.
  - Turning the switch off in `/settings` also records the offer.
  - If localStorage throws, the offer does not show.
- Other options: Ask on page load (browsers block or quiet a prompt without a gesture). Show the banner again after a × on another day.
- Risk: low. A person who refuses the browser prompt is not asked again on that device.
- Undo: Revert the commit.
- Status: open

### 2026-11-24 · feat/phone-a2 · Phone strip: where Apps, Agents and the sheet row go

- Agent: claude-opus-5-5
- Context: Gimenes approved A2 for phones (#4331): a strip with Doc, Arquivos, Decisões and Notas (= Lembretes) under the top bar, people as avatars at the bar's end, and "Apps fora". He did not say where Apps and Agents go, or what to do with the doc sheet's tab row.
- Decision: Apps and Agents stay in the drawer's tab row, so the phone does not lose them. While the doc sheet is open, the strip hides and the sheet's tab row (which is also the handle that closes the sheet) takes its place, so there is one row of tabs at a time. Your account stays at the drawer's top; a DM keeps it in the bar.
- Other options: Remove Apps from the phone. Keep both rows while the sheet is open. Put Apps in the strip.
- Risk: low
- Undo: Revert the commit; `phonePanes` again feeds the drawer row.
- Status: open

### 2026-11-24 · feat/thread-one-click · Desfazer only for threads from main

- Agent: claude-opus-5-5
- Context: Gimenes approved one click for "Criar thread", with a 5 second "Desfazer" (#4310). A thread from a message in another thread also gets a line in `main` that the server writes. The app has no command that deletes that line.
- Decision: The thread shows "Desfazer" only when its source message is in `main`, and only while the thread is empty. The notice is in the footer of the source card at the top of the new thread, not a floating toast, because the click opens the thread and the message view unmounts. A small store (`web/features/chat/threadUndo.ts`) carries the new thread ID from the message view to the thread view.
- Other options: Undo everywhere, and leave the orphan line in `main`. Add a server command that deletes the epic and its origin line: that changes the server for a rare case.
- Risk: low
- Undo: Remove the `startedThread` check in `Chat.svelte`, or set `startedThread` for all sources in `Message.svelte`.
- Status: open

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

### 2026-11-19 · feat/profile-stats · The public profile is off by default

- Agent: claude-opus-5-5
- Context: The human asked for a public profile with the tokens, messages, deploys and limits of each person (#3526), to make it a badge to share.
- Decision: `/u/<handle>` shows only to the person, and to people who share a room with them, until they turn on "Perfil público" in Settings. The hover card on a chat avatar works for people who share a room. A profile never shows the email. The avatar on the page comes from `/u/<handle>/avatar`.
- Other options: Public by default, with a switch to hide it.
- Risk: low. Fewer public pages until people turn it on.
- Undo: Set `profile_public` to 1 when it is NULL in `profileFor`.
- Status: open

### 2026-11-19 · feat/profile-stats · Tokens count input, cache and output

- Agent: claude-opus-5-5
- Context: The CLI reads the Claude Code transcript. Each model call has input, cache read, cache write and output tokens.
- Decision: The CLI sends the sum of all four for the session (`x-vibebook-usage: <session>:<tokens>`). The server adds the growth to `user_stats` for the day. Cache reads are most of it, so the number is large (one long session: about 1.6 billion).
- Other options: Only input and output tokens. Cost in dollars.
- Risk: low. The titles thresholds in `shared/titles.ts` assume this sum.
- Undo: Change the sum in `sessionUsage` (cli/vibebook.ts) and the thresholds.
- Status: open

### 2026-11-19 · feat/profile-stats · The profile page is a public page, served like the login

- Agent: claude-opus-5-5
- Context: The page must open without a session. The typed routes in `api.ts` need a session.
- Decision: `/u/:handle` serves the page shell with `vb-page=profile` (the same shell as the login and access pages). The data comes from `GET /auth/profile/:who` in `authApi`, which checks who may see it. The Settings switch is `POST /api/me/profile`.
- Other options: A new public app type beside `authApi`.
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

### 2026-11-19 · feat/cli-herdr-logs · The hub shows what it hears at a new loopback route

- Agent: claude-opus-5-5
- Context: The human asked that `vibebook herdr --verbose` show room activity and the room name, with no change on the server and no change in behavior. The hub hears the room events, but the runner is a different process.
- Decision: The hub keeps its last 100 events in memory (kind, room ID, time; no message text) and serves them at `GET /events?since=<seq>`, a long-poll on its loopback port. Only `herdr --verbose` reads it. The runner gets the user email from the access token (`<email>:<grant>:<secret>`), with no request. The human chose English-only log lines for the runner. This is an exception to rule 6, because the logs are operator output and not app text.
- Other options: The runner also opens its own socket. That is a second connection for each machine. Write the hub events to a log file. Then that file needs rotation.
- Risk: low. The route answers without CORS headers, as `/wait` does. Thus a web page cannot read it.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · explore/pin-app-icons · A pinned app's tile is the marble its name draws

- Agent: claude-opus-5-5
- Context: The human selected option A (a marble tile, like a room) from a side-by-side test against B (the marble tile with an app glyph on it). These details were not given by the human.
- Decision: The tile uses `OrgAvatar` with the app's label as its seed, like a room uses its title. It is 20 px with `rounded-md`, the rail's ratio (about 30% of the side). `pinAppTint` and `pinAppInitials` are removed. Links keep their line glyph: a glyph leaves deco.chat, a tile opens inside the room.
- Other options: Seed with `connectionId/tool`, so that a rename does not change the colour. In the test, two room apps with that seed got almost the same marble. Use `rounded-sm`, the 16 px avatar's radius.
- Risk: low. A rename of an app gives it a new colour.
- Undo: Revert the commit.
- Status: open

### 2026-11-19 · feat/room-members-search · People & agents beside the chat, and a search for the room's messages

- Agent: claude-opus-5-5
- Context: The human asked for People & agents like Discord's member list, beside the chat, and for a search of the room's messages. They reviewed it on a local build and asked to ship it.
- Decision: Two new panes, `people` and `search` (`DocumentPane`). `people` reuses `PeoplePanel` with a `members` variant (Online / Offline / Invited with counts, 32px faces, offline dimmed, an "Invite people" button) and `AgentPresenceRows` with `large`. The sidebar no longer shows People. `search` is a new component, `web/features/chat/RoomSearch.svelte`: no existing one searched one room's messages. It matches the loaded messages, then the server's `/api/search` filtered to the room, and a click jumps to the message. The field is in the top bar (`roomSearchQuery`). Closing the Doc opens People; closing People closes the pane.
- Other options: Keep People in the sidebar. Search in the Cmd+K palette with a room filter.
- Risk: low. The search over loaded messages misses text inside cards.
- Undo: Revert this commit.

### 2026-11-19 · fix/stale-chunks · A chunk of an older deploy reloads the page once

- Agent: claude-opus-5-5
- Context: A person who opened the app before a deploy got "Não foi possível carregar esta tela" on Settings. Workers Static Assets serves only the newest build, so the old chunk name fell through to the Worker (401), and "Tentar de novo" asked for the same missing file. The human asked for a reload on a stale chunk and a 404 for a missing asset.
- Decision: `createDeferredModule` and a `vite:preloadError` listener (mount.ts) call `reloadForNewBuild` when the import error is a browser's "module did not load" message (`isStaleChunk`). It reloads at most once in 60 seconds for each tab (`sessionStorage`), and never when storage is blocked, so it cannot loop. A second failure shows the error state. The Worker answers `/assets/*` with 404 and `no-store`, before the sign-in check.
- Other options: First ask `/api/me` for the current version (`v`) and reload only when it differs. That adds a request and a wait when the network is the cause. Keep the old chunks of earlier deploys. Workers Static Assets cannot do that.
- Risk: low. A real network failure on a lazy view also reloads the page once.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/notifications-phase1 · One chime for what is for you, in any room, and the Inbox count in the tab's name

- Agent: claude-opus-5-5
- Context: The human asked for notifications like WhatsApp (a DM, an agent that needs them) and for the Inbox count in the tab's name. They said: first one uniform notification and sound, ship, then iterate (two and three notes later). The chime played only for messages in the open room. A DM or a mention in another room made a web push, but only for people who turned on Notifications.
- Decision: `Book.notify` (DM, mention, an agent asks you) also pokes the recipients' `Person` with `{t: "alert", book}`. The open app plays the same chime as a message in the open room, if Sound is on. With two or more tabs, only the tab that gets the `vb-chime` Web Lock plays it. The same 20-second limit as the push applies. The tab's name starts with the Inbox count (`tabTitle`, "(3) Sala · deco.chat") on Home and in a room. I did not add the request for notification permission at the right time. It stays a task for the next epic.
- Other options: The service worker tells the open tabs about each push. That works only for people who turned on Notifications. A `BroadcastChannel` to choose one tab. The Web Lock needs no election.
- Risk: low. A browser without Web Locks plays the chime in each open tab.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · fix/copy-no-ui-marks · Copying messages takes only their text

- Agent: claude-opus-5-5
- Context: The human copied messages from one conversation to another, and the UI's marks came along. They asked that these marks are not selectable.
- Decision: `select-none` on the bar under a message (reactions, acks, seen), the epic thread cards, the time zone, the quote's ✦, the "agent" and "entregue" badges, and every `Avatar` (initials and agent glyphs). The author's name, the time and the text stay selectable, so a pasted conversation still says who wrote what and when. Checked on the live room: a copied range had ✓ ⏳ ✻, "3/4 tasks · 3 replies" and "GMT-3" before, and only the author, the time and the text with the same rules.
- Other options: Also make the author and the time not selectable. A copy handler that writes a clean text to the clipboard.
- Risk: low. A person can no longer select an avatar's initials or a badge's text.
- Undo: Revert this commit.
- Status: open

### 2026-11-19 · feat/token-backfill · The profile counts a machine's older Claude Code tokens

- Agent: claude-opus-5-5
- Context: The human asked why the profile did not count the tokens they spent before CLI 1.7.6 (#3646). The live counter only sees sessions from 1.7.6 on, and the CLI did not update itself.
- Decision: Once per machine, a detached `vibebook maintain` (started by `listen`) scans every transcript in `~/.claude/projects`, including the subagents' (`<session>/subagents/*.jsonl`), sums the same four token kinds by the entry's UTC day and sends them with the `usage_backfill` tool. It counts all Claude Code use on that machine, not only sessions in deco.chat rooms. Sessions the live counter already reported (`~/.vibebook/usage/<session>.json`) are skipped; the scanned ones get that file at the scanned offset with total 0, so the live counter adds only what comes after. The server keeps `usage_backfill (email, machine, day)` at the largest value sent, so a rerun (`vibebook backfill --force`) never counts twice; the profile adds it to the live total. Last 2 years only, ≤ 1e11 a day. The same child also updates an install.sh CLI every 6h when the server's is newer (the running listen exits with "a CLI foi atualizada"); an npm install gets one stderr line a day.
- Other options: Count only sessions in folders linked to a room. Send per session instead of per day.
- Risk: low. Two machines that share transcripts (a synced home) would count them twice. A session open during the scan loses the bytes written between the scan and the marker.
- Undo: `DELETE FROM usage_backfill`; drop `maintain` from `listen`.
- Status: open

### 2026-11-20 · feat/pill-atom-b · Every badge is a white pill with an edge, and the tone is a dot

- Agent: claude-opus-5-5
- Context: The human said that the Inbox pills did not match the rest of the product, and then asked to change the pill atom itself, so that every pill changes. They compared 4 options in a playground and selected option B: a white pill with an edge, with the colour only in a dot.
- Decision: `badgeVariants`: all variants are `bg-card shadow-edge`, with foreground text (`muted` keeps the muted text). A toned variant (success, warning, destructive, agent, lime, info, brand) sets `--badge-tone`. The tone colours a 6px dot before the text, or the leading icon when there is one. `BadgeDot` uses the same colour, so an explicit dot does not make a second dot. `sm` is 18px and `default` is 22px, so the edge does not touch the text. info uses `--color-notice`, because `--color-brand-blue` is too pale for a dot on white. The Inbox row kind is now a `Badge` (Claude is `agent`, purple; a task takes its status's tone), not a span with its own colours. The Inbox filters stay buttons (`aria-pressed`): the selected one is `outline` and the others are `ghost`, not black. "✓ entregue" lost the ✓, because the dot now says it.
- Other options: Make the filters a `ToggleGroup` (its items are radios, not `aria-pressed`, so the tests and the keyboard behaviour change). Keep the tinted pills and change only the corners (option A).
- Risk: low. All the badges in the product change their look at the same time. Badges with a class that sets a background (`Count`, `TagsInput`) keep that background.
- Undo: Revert this commit.
- Status: open

### 2026-11-20 · feat/composer-single-field · The composer is one filled field, and send has its own slot

- Agent: claude-opus-5-5
- Context: The human asked for a composer like the Discord phone composer, then approved the artifact in epic c01ee455 (a ghost +, and a reply strip with a preview). They asked for no horizontal shift while you type, support and speed for long texts, and CSS transitions. They did not select between "Enter only" and "button while typing" for send on a computer.
- Decision: `ChatField` is one `bg-muted` field (`rounded-3xl`, `md:rounded-xl`) with no edge, and a thin ring on focus. The order is + (ghost), the text, emoji, mic and send. The icons in the field hover with `bg-secondary-hover`, because `accent` is the same colour as `muted` in light mode. On a phone, send takes the mic's cell when there is something to send, but not while you dictate. On a computer, send keeps its slot and fades in when there is text. Thus the text never moves sideways. The reply strip (one line: "Respondendo a **who** · start of the message…", without "Respondendo a" on a phone) and the attachments are inside the field, on top, through the new `above` snippet. The text grows up to 160px (256px on a computer) and then scrolls. The line count and the "has text" test stop early, so a long text costs nothing per keystroke. The computer hint line ("Enter envia · Shift+Enter nova linha") is not added, because send stays visible.
- Other options: Enter only on a computer, with no send button (the artifact's default). The browser tests click send, and a hidden action is harder to find. Show send only on a computer when there is text, without a reserved slot (the text moves 32px sideways).
- Risk: low. The home ask box uses the same field, so it changes too.
- Undo: Revert this commit.
- Status: open

### 2026-11-21 · feat/mobile-controls · The phone room has no bottom bar; the title's menu holds the room's shortcuts

- Agent: claude-opus-5-5
- Context: The human selected proposal C in epic 7f79a4ab: the bottom of a phone room is only for the composer, the title opens a menu from the top, the top bar keeps the most important information, and the thread's files strip stays. The mockup did not say where the shortcuts go in the existing menu, what Back does on the board, or how big the controls are.
- Decision: The bottom bar (`PhoneTabBar`) becomes `PhoneRoomMenu`: five shortcuts (Doc, Board, Files, Agents, Search) at the top of the menu that the title already opens, above "Esta sala | Todas as salas". A DM shows only Files and Search. A shortcut closes the menu, then opens its panes. Search leaves the top bar for the menu. The top bar shows the thread's title in the middle and, under it, the room and the epic's progress ("Produto · 2 de 4 tarefas"). The room's avatar is not in the bar any more (a DM keeps the person's face). The back button, the inbox and your avatar have 40px targets, the icons are 20px, and your avatar is 32px (it was 16px); the home's bar uses the same avatar. On a phone, Back (and the edge swipe) first leaves the full board or closes the doc sheet, and only then goes to the main thread or to the rooms. The doc sheet uses the layout's existing top sheet with a handle.
- Other options: A new drawer from the left (proposal A) or tabs at the top (proposal B), which the human did not select. A separate drawer component, instead of the menu that the title already opens. Keep search in the top bar.
- Risk: medium. Each phone room changes. The browser fixture opens the panes through the menu now.
- Undo: Revert this commit.
- Status: open

### 2026-11-21 · fix/mobile-drawer · A phone sheet is only open or closed, and keeps one height while it slides

- Agent: claude-opus-5-5
- Context: The human said that the phone drawer shrinks when it opens, is not only open or closed, and does not slide with a good ease. Three adversarial reviews (state, CSS, and a frame-by-frame measurement at 390px) found the causes. The human did not select the fixes, the durations, or what to do with the full-height doc while you type.
- Decision: The thread's files strip above the doc sheet stays until the slide out ends, so the sheet keeps one height (it changed from 560px to 606px at the start of each close). The doc sheet no longer becomes full height when a field in it has focus. A drag only previews: its release always settles to fully open or fully closed, also when the sheet stays open or a tap stops a slide. A menu shortcut changes the side sheet to the doc sheet in the same history entry: the side sheet slides out while the doc slides in (`leavingSheet`), and the backdrop stays on. An open takes 360 ms and a close takes 260 ms, with the existing `.32,.72,0,1` curve, in proportion to the distance that is left (at least 40%).
- Other options: Take the doc sheet out of the grid with the strip inside it (a bigger change to the layout and the tests). Keep the full-height doc while you type, as a separate mode. Keep one 300 ms time for all slides.
- Risk: low. Only the phone sheets change. The doc sheet no longer grows when you type in it; the keyboard can cover more of a long document.
- Undo: Revert this commit.
- Status: open

### 2026-11-22 · feat/mobile-pane-in-place · On a phone, a pane takes the chat's place, and the Inbox keeps the top bar

- Agent: claude-opus-5-5
- Context: The human asked that Doc and the other panes that opened as a drawer on a phone appear in the place of the chat, and that the Inbox keep the top bar with its button pressed. They did not say if the composer stays under a pane, how a pane appears, or what ← does with the Inbox open.
- Decision: On a phone, the doc and board panes fill the rows under the top bar and the thread's files strip, over the chat and the composer (as the old bottom-bar tabs did). They keep the `doc` sheet state and its history entry, so ← and the edge swipe go back to the chat. They fade in with a short rise (`vb-room-pane`, 12px) on the same scrubbed timeline, with no handle and no backdrop. Only the side sheet (the title's menu) is still a drawer. The Inbox opens under the top bar; the bar's Inbox button is pressed and closes it, so the Inbox's own ✕ on a phone is gone. ← closes the Inbox first.
- Other options: Keep the composer under a pane (the doc's editor and the chat composer would fight for the keyboard). Swap with no motion at all. Keep the ✕ next to the pressed button.
- Risk: medium. Each phone room changes how Doc, Files and Agents open. The browser tests close the Inbox with the bar's button now.
- Undo: Revert this commit.
- Status: open

### 2026-11-22 · fix/mobile-menu-scroll · In the phone's title menu, only the epics scroll

- Agent: claude-opus-5-5
- Context: The human said that in the menu that the room's title opens on a phone, all of the menu scrolls, and that only the epics must scroll. They did not say if the epics' tabs (Épicos, Plano, Feitos) stay in place.
- Decision: On a phone, the menu does not scroll. The shortcuts, the "Esta sala | Todas as salas" tabs, the room's row and the epics' tabs stay in place. Only the list under the epics' tabs scrolls. The DM list and the list of all rooms already scroll in their own area. The desktop sidebar still scrolls whole.
- Other options: Scroll the epics' tabs with the list. Keep one scroll for the whole menu, and make the shortcuts sticky.
- Risk: low. Only the phone menu changes.
- Undo: Revert this commit.
- Status: open

### 2026-11-22 · fix/mobile-menu-dismiss · The room behind the phone's title menu is glass

- Agent: claude-opus-5-5
- Context: The human asked that the part of the room outside the phone's title menu close the menu when you tap it, and that it use a glass effect. A tap on that part already closed the menu in the browser test at 390px. The human did not say how strong the glass is.
- Decision: The backdrop under the title menu keeps its color and adds a small blur (`backdrop-blur-sm`). It fades in and out with the menu's slide. The browser test now taps the backdrop and expects the menu to close, so that this behavior stays.
- Other options: A stronger blur, as in the dialogs (`backdrop-blur-[32px]`, `bg-glass`). A shorter menu, so that more of the room shows under it.
- Risk: low. Only the phone menu's backdrop changes. A blur costs more to draw on old phones.
- Undo: Revert this commit.
- Status: open

### 2026-11-22 · fix/mobile-menu-swipe-glass · A swipe up on the glass under the title menu closes it

- Agent: claude-opus-5-5
- Context: The human said that a swipe on the glass under the phone's title menu does not slide the menu. Only the handle at the bottom of the menu started a drag, because a closing handle had to be inside its sheet.
- Decision: The backdrop under the title menu is also a closing handle of the side sheet. A swipe up on it moves the menu with the finger, and the release settles fully open or fully closed, as with the handle. A tap on it still closes the menu. A swipe down on it does nothing. The backdrop has `touch-none`, so the browser does not scroll the page during the swipe.
- Other options: Close the menu at once when a swipe on the backdrop starts, with no drag. Make all of the room under the menu a drag area, also when the menu is closed.
- Risk: low. Only the phone menu's backdrop changes. The browser test swipes on it and expects the menu to close.
- Undo: Revert this commit.
- Status: open

### 2026-11-22 · feat/mobile-title-left · The phone's title is on the left, right after ←

- Agent: claude-opus-5-5
- Context: The human asked that the room's title on a phone be aligned left, right after the back button, not in the center. They did not say where the second line (the room and the epic's progress) and the ▾ go.
- Decision: The title button keeps all of the space between ← and the inbox, so the tap area does not change. Its text starts at its left: the thread's title with ▾ right after it, and the second line under it, also aligned left. A DM keeps the person's face before the name.
- Other options: Make the button only as wide as the text. Keep the second line in the center.
- Risk: low. Only the phone's top bar changes.
- Undo: Revert this commit.
- Status: open

### 2026-11-22 · feat/mobile-home-chat-list · The phone's home is a list of conversations

- Agent: claude-opus-5-5
- Context: The human asked for a phone home like WhatsApp: a list of the rooms with a preview of the last message, where a tap opens the room. They said the top bar stays as it is. They did not say what happens to the cube, the ask box, the wait cards and the grid of room icons, or how the preview reads.
- Decision:
  - On a phone, the home is `ChatList`: all rooms and DMs, the newest message first. Each row is the existing `RoomLink` (avatar with the unread dot, ✻ and waits), with the time at the end and one line under the name: "Você: …", "Ana: …", "Claude: …" or "@vibe: …". A DM does not show the other person's name in its line. Your own DM shows only after you wrote in it.
  - The cube, the ask box, the wait cards and the grid of icons do not show on a phone that has a conversation. The waits stay in the inbox and on the avatars. A person with no conversation still gets the old home, with its way in.
  - The server keeps the newest message in the D1 `books` row: three new columns (`last_by`, `last_text` with the first 160 characters, `last_agent`), added by `ensureSchema`. A message for one person (`for_who`) and @vibe's quiet lines do not change it. A room without a stored line shows its summary until its next message.
  - The browser app has no `track()`, so the list sends no event.
- Other options: Read the last message from each room's Durable Object (one call for each room on each home load). Keep the ask box over the list. Sort by the rail's order, not by activity.
- Risk: medium. D1 now holds a short copy of each room's newest message. The README already says that D1 holds messages. The desktop does not change.
- Undo: Revert this commit. The columns can stay; nothing else reads them.
- Status: open

### 2026-11-23 · feat/mobile-chats-waits · What waits on you sits on top of the phone's list

- Agent: claude-opus-5-5
- Context: The human selected option C of the list mockups: what waits on you pinned on top, and "Claude está trabalhando…" while an agent works. They did not say how many waits show or what a tap opens.
- Decision:
  - The phone's list starts with "N esperando você": the 3 most pressing waits (your Claude's asks first, then asks from people, then your tasks in review, newest first). Each row has the room's avatar, the room (and the epic), who asks and what, in the warning tone, and when. A tap opens that message. With more than 3, a button opens the Caixa de entrada. Under them, "Conversas" titles the list.
  - A room with a live agent ("doing" ack, `busy_until`) shows "Claude está trabalhando…" in place of its last line. Its place in the list does not change.
- Other options: Show all waits. Group the waits by room. Move a busy room to the top.
- Risk: low. Only the phone's home changes.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/composer-mic-send-swap · The mic and send share one button, and dictation is a recording bar

- Agent: claude-opus-5-5
- Context: The human asked that the composer show the mic while the box is empty and the send button once it has text, on phones and on a computer, and that dictation work like WhatsApp. They confirmed on an artifact that stop only stops (the text stays for review). They did not say how to start a dictation when the box already has text.
- Decision:
  - The mic and send share one cell at every width: the mic while the box is empty, send when there is something to send, stop (the red mic with a square) while you dictate. Before, a computer showed send beside the mic.
  - While you dictate, the + and the emoji hide. A trash takes the + place, and a red dot with the time comes before the text, which fills in live. The red ring around the field is gone. The trash puts the text back as it was before the dictation. Stop keeps the text, and send comes back.
  - With text in the box, the mic is not there (as in WhatsApp). To add dictation to text, hold Space in the box, as before.
- Other options: Keep the mic visible beside send on a computer. Hide the text during dictation and show only a wave. Make stop send.
- Risk: low. A person who dictated after typing on a computer now holds Space for that. The button keeps its "Ditar mensagem" name for tests and screen readers; its tooltip says "Parar de ditar" while you dictate.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/mobile-home-whatsapp-chrome · The phone's home has a chat app's bar

- Agent: claude-opus-5-5
- Context: The human asked for the phone's home to look like WhatsApp: no DM list under the list, a top bar like WhatsApp's, a search field and a large `+`. They did not select the title, the actions in the bar or how the shell knows the layout.
- Decision:
  - The DM list under the list was the home's DM sidebar (`data-home-dms` in `AppShell`, row 3 on a phone). On a phone with the list (`data-home-layout="chats"`), the shell does not draw it. The shell also does not draw the app's phone bar (`AppNavigation`) there. Both use the Tailwind variant `max-md:group-has-[[data-home-layout=chats]]/shell:hidden`. Thus `HomePanel` stays the only place that selects the layout.
  - The list draws its own bar: "deco.chat" in bold on the left, then the Inbox button and your avatar (a link to Settings) on the right. The title is the name of the app, as WhatsApp shows "WhatsApp". It is the same in the two languages.
  - The bar has no room switcher ("Início ▾"), no search icon and no small `+`. The list already holds all rooms and DMs, the search field opens search, and the floating `+` opens "Nova sala".
  - The Inbox button replaces the "Caixa de entrada" row of the DM sidebar. Without it, the Inbox opens on a phone only when more than 3 items wait.
  - Invites and message requests ("Pedidos") were only in the DM sidebar. They now show on top of the list.
  - The floating `+` is a 56px `brand` button at the bottom right, above the safe area.
- Other options: Keep "Início ▾" with the room switcher as the title. Use "Conversas"/"Chats" as the title. Give `AppNavigation` a prop for the layout (the shell does not know if the home shows the list or the desk). Keep the small `+` in the bar.
- Risk: low. Only the phone's home with at least one conversation changes. Your own DM ("Você") shows in the list only after you wrote in it, as before.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/global-inbox-rail · The Inbox is one global button under the logo
- Agent: claude-opus-5-5
- Context: The human approved the artifact "Inbox global" (#3837) and asked for four slots on the rail: the logo and the Inbox (only when something waits), a line, DMs, a line, rooms, then search and +. The artifact also said that the Inbox loses "Esta sala / Todas as salas", and that the Home and room sidebars lose their Inbox items.
- Decision:
  - The rail shows an Inbox button under the logo, with the number of waits, only while something waits on you (or while the Inbox is open). It opens `/?inbox`.
  - The Inbox always shows all rooms: the scope buttons and the dialog's tabs are gone, and the state starts with `all: true`.
  - The Home sidebar hides its Inbox row on a computer (the rail button does the same). Phones keep it.
  - The room sidebar keeps its Inbox item for now. It now opens the all-rooms Inbox, so its number and its list agree. Two browser tests open the in-room Inbox through it; a follow-up removes it together with those tests.
  - The DM slot shows only when a DM has something new, as before.
- Other options: Show the Inbox button always. Remove the room sidebar item in this change.
- Risk: low. A person who used "Esta sala" now sees all rooms; each row says its room.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/epic-status-pill · The epic bar shows a status pill

- Agent: claude-opus-5-5
- Context: The human selected proposal A: the Archive button becomes a status pill with a menu. They asked for an "Arquivado" status in place of the trash button, and no edit button. They did not select the details below.
- Decision:
  - The epic has a new `status` column in the `Book` SQLite (null by default). `epicStatus` (`shared/epicStatus.ts`, a new file because `shared/room.ts` holds only schemas) calculates the status when the column is null.
  - A change of the archive removes a stored status that is not true any more. Auto-archive and a manual archive remove todo, doing and review. A reopen removes done and dismissed. "live" stays.
  - On phones, the pill is under the title in `ThreadHeader`. The "⋯" menu is gone, because without rename and delete it holds only the same list as the pill.
  - In the sidebar, each epic shows the icon of its status. An epic with a `prod` stage shows only the prod icon that it showed before, so that a row does not have two rocket icons.
  - Icons: A fazer `circle`, Fazendo `clock`, Esperando OK `eye`, Feito `check-circle`, No ar `rocket-01`, Arquivado `archive`. I copied `archive` from `@untitledui/icons` 0.0.19 (the paths of the other icons are the same in 0.0.19 and 0.0.23).
  - The Worker sends a `track()` event `epic_status` (with `via` app or agent), because the browser app has no `track()`.
- Other options: Keep "⋯" with the status list on phones. Keep the stored status when the epic is archived or reopened. Show both icons in the sidebar.
- Risk: low. Rename and delete have no button now. The commands `epic.rename` and `epic.del` and the agent tools stay.
- Undo: Revert this commit. The `status` column stays and the old code ignores it.
- Status: open

### 2026-11-23 · feat/room-signals-three · A room avatar shows three signals

- Agent: claude-opus-5-5
- Context: The product owner approved three signals on a room avatar: "waits on you" (the only number), "new messages" (a dot without a number) and "agent working" (the ✻). The proposal left three questions open, and some details were not given.
- Decision:
  - The number stays lime (`Count`, `bg-brand`). `Count` does not change in the app. A question from your own Claude is no longer red: the number has one colour.
  - The number counts all waits of the room: asks, AI-guessed asks without an @, questions and permissions of your Claude, and your tasks in review. The separate review dot is gone. `waitCount` replaces `waitIndicator`.
  - The number also changes in the room sidebar and the epic list, because they use the same `WaitBadge`. Thus one number has one meaning on all surfaces.
  - The ✻ shows when any agent of the room works, as before.
  - In the rail, the new-messages dot is a `RailPill` state (`human` strong, `agent` muted) at the place of the selected bar. On the other surfaces (phone list, sidebar rows, home grid, switcher), `RoomAvatar` draws the dot on the left edge of the avatar.
  - A DM in the rail keeps its number of new messages, at the top right, with `Count`. A DM row in the phone list uses the dot, as a room does.
  - The cloud mark is gone from the avatar. The tooltip keeps "sandbox na nuvem rodando" as its last line. The tooltip lines follow the order of the signals.
  - I did not add the "why a wait exists" field (for a Mentions filter in the Inbox). It needs a new column in the D1 `waits` table, and a human must approve a schema change.
- Other options: Make the number red, as in Discord and Slack (this changes `Count` in all the app). Count only asks with an @. Show the ✻ only for your own Claude. Draw the rail dot on the avatar edge.
- Risk: low. A person who looked for the red number of new messages now sees a dot. The number is higher when tasks wait in review.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/epic-status-no-live · An epic has no "No ar" status
- Agent: claude-opus-5-5
- Context: The human said that "live" can mean different things and asked for a single "done" state (#3877).
- Decision:
  - The status menu has A fazer, Fazendo, Esperando OK, Feito and Arquivado. "live" is not a status any more, in the app, the room command and `update_epic`.
  - With no chosen status, an epic in production (`prod` deployed or verified) shows Feito.
  - A stored "live" value reads as no status (the Book drops values it does not know), so those epics show the status from `prod` and the tasks: Feito.
  - The sidebar's deploy-stage icon (rocket, verified, changes) stays. It shows the agents' `prod` stage, not a status. The human can ask to remove it too.
- Other options: Map "live" to "done" in the database. Also remove the sidebar's deploy-stage icon.
- Risk: low.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/epic-no-rocket · The epic list has no deploy icon
- Agent: claude-opus-5-5
- Context: After "No ar" was removed (#3877), the human asked to also remove the rocket in the epic list (#3882).
- Decision:
  - The epic list does not show the `prod` icon (rocket, verified, changes requested) any more.
  - Each epic shows its status icon, also when it has a `prod` stage. An epic in production shows Feito. Before, the `prod` icon replaced the status icon.
  - The `prod` stage itself stays: agents set it, the epic's thread still shows it (`Chat.svelte`), and it gives the Feito status.
- Other options: Show nothing for an epic with a `prod` stage.
- Risk: low. The "changes requested after deploy" cue is not in the list now. It is still in the thread.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/no-room-inbox · Remove the room Inbox, keep shared parts

- Agent: claude-opus-5-5
- Context: Gimenes approved one global Inbox (the rail button and `/?inbox`). I removed the Inbox entries in a room and the code that only they used. I selected what to delete and what to keep.
- Decision:
  - Deleted: the sidebar Inbox row and its collapsed icon, the phone room bar Inbox icon and its skeleton placeholder, the `RoomScene` Inbox overlay, `presentation.openInbox` and `presentation.inbox`, `RoomScope.setInboxVisible`, the `"inbox"` title of `RoomBarTitle`, and the Sidebar props `oninbox`, `inboxOpen`, `inboxCount` and `onthreadintent`.
  - Kept: `RoomInbox` and `InboxControls`, because `HomeInbox` (`/?inbox`) draws them. Kept the `viewControls` slot of `RoomHeader` and the `overlay` slot of `RoomLayout`, because `docs/design.md` and the gallery use them for other views.
  - Kept the room scope in `inbox.ts` (`InboxBinding.roomScope`). No app path opens the Inbox in a room now, but unit tests cover its ownership rules. Kept `EpicTree`'s `selectionDisabled` and `onBeforeOpen` props.
  - Tests: three DOM tests of the room Inbox now mount `HomeInbox`. I deleted the test that the overlay keeps the composer and the draft, because the global Inbox has no equivalent. The browser tests open `/?inbox` (and the rail on desktop when something waits).
- Other options: Delete the room scope in `inbox.ts` and its tests (a larger change to a tested owner). Delete the `viewControls` slot (then `docs/design.md` loses its procedure for view controls).
- Risk: low. A person who used the Inbox in a room now uses the rail (desktop) or the Home bar (phone).
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · fix/loading-title-left · A phone's Home loads with the list's bar
- Agent: claude-opus-5-5
- Context: The human said that a loading state still does not show the title on the left (#3878). On a phone, Home loaded with the desk layout (the cube and a centred headline bar) and then jumped to the list with "deco.chat" on the left. The room loading bar was already on the left (#302).
- Decision:
  - On a phone, while the account loads, `HomeSkeleton` draws the list's bar ("deco.chat" on the left, the inbox, the avatar), the search field and five rows, as bars. Both loading steps use it (the shell's `page` and `HomePanel`), so nothing moves.
  - The desktop loading state does not change.
  - A person with no conversation yet sees the list's bars first and then the desk. This is rare, and the title stays on the left until the account answers.
- Other options: Keep the desk skeleton and only add the title bar above it.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/search-in-title · The room search stands where "Sala principal" was
- Agent: claude-opus-5-5
- Context: The human asked to move the room search to where the desktop bar says "Main thread", with the placeholder "Search in <room name>" (#3902). An epic's thread shows the epic's title and status pill in that place.
- Decision:
  - In a room's main thread (desktop), the search field is at the start of the bar, up to 320 px wide, and the "Sala principal" label is not shown. The sidebar still marks the main thread.
  - In an epic or a suggestion, and on the full board, the bar keeps its title and the search stays at the end of the bar, as before.
  - The placeholder is "Buscar em {room}" / "Search in {room}" in both places. The search pane's own field does not change.
  - The profile font audit reads the room's name in the sidebar header, because the main thread's bar has no title text now.
- Other options: Put the search at the start of the bar in every thread, before the epic's title.
- Risk: low.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · fix/composer-skeleton · The composer and its loading state share one shape
- Agent: claude-opus-5-5
- Context: The human said that the composer does not match its loading state. They asked for a taller composer, the composer's fill on the loading state, and code that tells a developer to change both together (#3905). The composer was 44px with `bg-muted`. The loading state was 56px with the input colour, other corners, a shadow, other margins and an extra 8px.
- Decision:
  - New file `web/features/composer/shape.ts` with four class constants: `COMPOSER_SLOT` (desktop cell), `COMPOSER_FRAME` (strip), `COMPOSER_BOX` (corners and fill), `COMPOSER_ROW` (56px row). No existing file held the composer's shape, and both `ChatField` and `RoomSkeleton` must import it. Its comment says to change the shape only there.
  - `ChatField`, `ComposerForm`, `RoomLayoutFrame`, `RoomSkeleton` and `HomeSkeleton` use these constants. The composer is now 56px.
  - Home's ask box is also a `ChatField`, so it is 56px too, and Home's loading bar uses the same box and row.
  - `ComposerForm` uses `flex flex-col gap-2` in place of `space-y-2`: its hidden file input gave the box an 8px bottom margin.
  - Home's loading bar keeps its old width (576px against 640px). That was different before and the human did not ask about it.
- Other options: Make the loading state 44px like the old composer.
- Risk: low. The composer is 12px taller.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/epic-row-slot · The epic row: one slot at the end, and task progress as a bar
- Agent: claude-opus-5-5
- Context: The human asked for the epic's status at the end of its row, a number in its place when there is something new, and the x/y task count as a bar under the title (gray at 0 done, green after) (#3899, #3904). Then they said to change only the UI, not how the app tracks read messages (#3915).
- Decision:
  - The slot at the end shows the lime wait count (`WaitBadge`) when something waits on you, else the status icon. The app tracks reads only per room, so there is no per-epic count of new messages. The wait count is the number that already exists for an epic.
  - The x/y text is gone. A 2px `Progress` bar sits at the foot of the row, under the title. Its aria-label keeps the count ("1 de 3 tarefas"). An epic with no tasks has no bar.
  - `Progress` gets a new `success` tone (`text-success`) for the green fill. Its gray track is the existing `bg-muted`.
- Other options: Add per-epic read tracking for a count of new messages (the human said no). Keep the x/y text beside the bar.
- Risk: low.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/epic-row-slot · A touch screen has no actions menu on the epic's row
- Agent: claude-opus-5-5
- Context: On a phone, the `...` menu on each epic row was always visible, because a touch screen has no hover. The human said to remove it and to keep the actions only inside the epic (#3924). Inside the epic, the phone sheet had only the status menu. The row menu also pinned the epic, moved a pinned epic up or down, and picked its owner.
- Decision:
  - The row's `...` is hidden on `hover:none` screens (phones, tablets). On a computer it still shows on hover.
  - The status menu in the phone's thread sheet (`EpicActions`, `owners` prop) also has "Fixar no topo"/"Desafixar" and the owner choice.
  - "Mover para cima/baixo" for a pinned epic is not inside the epic. Thus a touch screen cannot change the order of pinned epics. The human can ask for it.
  - The desktop top bar's status menu does not change: the row menu is still there on hover.
- Other options: Open the row menu with a long press.
- Risk: low. A touch laptop with no mouse loses the row menu, but it has the menu inside the epic.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/epic-row-no-menu · The epic list has no actions menu on desktop either
- Agent: claude-opus-5-5
- Context: The human asked to remove the `...` from the epic list on desktop too (#3933). The row menu pinned the epic, moved a pinned epic up or down, and picked its owner.
- Decision:
  - The epic row has no actions menu on any screen.
  - The epic's status menu in the desktop top bar (`RoomBarTitle`) also has "Fixar no topo"/"Desafixar" and the owner choice, as the phone sheet does.
  - A pinned epic still moves up or down with Alt+↑/↓ on its row. There is no menu item for this any more.
- Other options: Put "Mover para cima/baixo" in the epic's status menu as well.
- Risk: low. Moving pinned epics is now only on the keyboard.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · fix/room-skeleton-pane · A loading room opens its pane as the room will, and its skeleton matches today's room
- Agent: claude-opus-5-5
- Context: The human said that the room's loading state shows the side pane open when it is closed. They asked to connect the loading state to the pane's real value, to make the code tell a developer to change both together, and to update the skeletons to match today's messages and bars (#3938).
- Decision:
  - `documentClosedBefore` and `DOCUMENT_CLOSED_KEY` (`vb.docClosed`) move to `room-layout/model.ts`. The room's controller and the skeleton (through `roomDocumentOpen` in `preview.ts`) read the pane through it. The skeleton draws no pane when it is closed.
  - New `room-shell/shape.ts`: the message row and its 40px avatar column (`Message.svelte`), and the epic row's progress bar (`EpicTree.svelte`). The real components and the skeleton import them. I did not put this in an existing file, because no file held shapes for both the room and the skeleton.
  - The skeleton's top bar shows the search field on the main thread ("Buscar em <sala>", as #318), then Doc and five tab icons. In an epic it shows the face and a name line.
  - The skeleton's sidebar shows "Quadro de tarefas", the Épicos/Plano/Feitos tabs, epic rows with the status at the end and the progress bar, and "Novo épico". The empty "Fixados" and "Pessoas" blocks are gone.
  - The skeleton's messages use the real row: a 40px avatar, the name and the time, the text.
  - `docs/design.md` says where the shared shapes are.
- Other options: Keep the pane always open in the skeleton and only fix its width.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/home-waits-inline · The phone home opens the rest of what waits on you in place
- Agent: claude-opus-5-5
- Context: The human asked that "See all 5 in the Inbox" on the phone home show the rest inline, as WhatsApp does (#3942).
- Decision: The button opens all the waits in the same list and reads "Ver todas as {n}" / "See all {n}". When open, it reads "Mostrar menos" / "Show less" and closes the list to 3 again. The list does not remember open or closed between visits. The Inbox stays one tap away through the icon in the top bar.
- Other options: Remove the limit of 3 and show all the waits always. Remember the open state per browser.
- Risk: low.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/chat-copy-transcript · A copy across messages reads as WhatsApp's
- Agent: claude-opus-5-5
- Context: The human said that a copy of many messages brings emoji and pieces of the UI. They asked for a copy like WhatsApp's: the name, the time and the message (#3955).
- Decision:
  - When a selection reaches past the text of one message (into a name line, an avatar, or a second message), the chat timeline writes one line for each message that it touches: `[hh:mm, date] name: text`. The text is the message's own text, so agent marks, reactions, badges and buttons stay out. A message with only files gives the file names.
  - A selection inside the text of one message keeps the browser's copy, so a person can still copy a part of a message.
  - A message that the selection only touches gives its full text, as in WhatsApp.
  - The date uses the person's locale. The name is the same as on the message row (`messageAuthor` in `chat/model.ts`, now shared).
- Other options: Copy only the text, without names and times. Copy only the part of each message that is selected.
- Risk: low.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/desktop-home-inbox · On a desktop, the Home is the Caixa de entrada
- Agent: claude-opus-5-5
- Context: The human chose option 2 of the mockup (#3967): on a desktop the logo opens the Caixa de entrada, with the search in the top bar as a room has it. The phone keeps its list.
- Decision:
  - On a desktop, `/` shows the Inbox (`HomeInbox`). `/?inbox` still works on both.
  - A person with no rooms yet still gets the old Home on a desktop, because it has the first-room and connect-agent steps. Until the account loads, a desktop shows the Inbox, because most people have rooms.
  - The Inbox's bar: the search on the left (same size and place as "Buscar em <sala>"), which opens the search palette as the phone's search does. Then "N esperando você" and "Resolver todos".
  - The rail: the logo carries the count and opens the Caixa. The separate Inbox button is gone.
  - The desktop list: one row "Caixa de entrada" with its count, in place of "Início". The phone's rows do not change.
  - The ask box ("O que você quer resolver?"), the cube and the card fan are not on the desktop Home now. They stay in the code for the no-rooms Home.
  - Not in this change: Abrir/Responder/Resolver buttons on hover. The keys o, r and e do these now.
- Other options: Keep the Home for everybody and only move the search. Show the Inbox also to people with no rooms.
- Risk: medium. It changes the first screen on a desktop.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/epic-status-after-title · The epic's status follows its title; its menu has no owner picker
- Agent: claude-opus-5-5
- Context: The human asked to put the epic's status right after the epic's title in the room, and to remove the owner selector from the status menu (#3975).
- Decision:
  - In the desktop top bar, the status pill comes right after the title. The vertical line that ended the epic's controls is gone, because the pill is no longer at the end.
  - The status menu (top bar and the phone's sheet) has no "Dono do épico" group now. "Fixar no topo" / "Desafixar" stays, because the epic list has no other menu to pin an epic.
  - The server's `epic.owner` command stays. Only the UI changes.
- Other options: Remove the pin item too, so that the menu has only the statuses.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/rail-hold-to-sort · Rooms on the rail move by press and hold, not by the browser's drag
- Agent: claude-opus-5-5
- Context: The human asked to rearrange the rooms in the sidebar by click and hold. They said that the gesture today shows a strange drop in the UI (#3978). The rail used the browser's drag and drop: a ghost of the link and a dashed box on the room under it.
- Decision:
  - New action `railSort` (`app-navigation/railSort.ts`) on the rail's room list, with pointer events. Hold a room for 250 ms (or, with a mouse, move it 6 px) and it lifts and follows the pointer. A line shows where it lands. Letting go saves the order with the existing `rooms.order`. Escape puts it back. A short press is still a click that opens the room.
  - On a touch screen, a move before the hold scrolls the rail.
  - The browser's drag of the tile, its link and its picture is off.
  - The held room lifts in place (data attributes and Tailwind classes; the style policy does not let code set inline styles).
  - I did not reuse the epic list's sorter (`navigation/sortable.ts`, @dnd-kit/dom): it sorts only among siblings of one parent, and the rail puts rooms of one tint in their own group box. A room must be able to move between those boxes.
- Other options: Keep the browser's drag and only restyle the drop box. Move tiles live to open a gap, as some apps do; tint groups make that harder.
- Risk: low.
- Undo: Revert this commit.
- Status: superseded by "The rail sorts with dnd-kit, as one flat list" (feat/rail-dnd-kit)

### 2026-11-23 · feat/rail-dnd-kit · The rail sorts with dnd-kit, as one flat list
- Agent: claude-opus-5-5
- Context: Gimenes #3997: the rail's hold-to-sort was still poor on desktop. He wanted a preview of what is dragged, like dnd-kit, and asked to use dnd-kit where the product drags things.
- Decision:
  - The rail uses the epic list's sorter (`navigation/sortable.ts`, @dnd-kit/dom). The dragged room follows the pointer and the others make room. A mouse starts after 6 px; a finger holds 250 ms. `railSort.ts` is gone.
  - The rail is one flat list now. Each tile carries the tint of its run, with the run's corners on its first and last tile, so a room can move between colour runs.
  - The new order shows at once (a local order) until the saved order arrives, or for 10 s if the save gives up.
  - Other drags in the product: the task board's (removed in #329) and file drops from the computer (composer, image picker). dnd-kit does not handle file drops, so those stay.
- Other options: Keep the tint boxes and sort inside each box only.
- Risk: low.
- Undo: Revert this commit.
- Status: superseded by "The rail and the thread list sort with @dnd-kit/svelte" (refactor/dnd-kit-svelte)

### 2026-11-23 · feat/no-task-board · The task board leaves the product; the room's name is the main thread
- Agent: claude-opus-5-5
- Context: Gimenes #3989 (items 1 and 2): remove the task board from the sidebar and the product. Move the main thread's button up to the room's name, and remove the room's message count. Simplify the data fetching if possible.
- Decision:
  - The board, its full-width mode in the room layout (`boardFull`, `toggleBoard`, the board cell) and its "board" pane are gone. Its entry points are gone too: the sidebar row, the collapsed rail button, the phone menu shortcut and the count.
  - The tasks stay. They show in the doc of their epic (or of the room), as before.
  - On a desktop, the room's name at the top of the sidebar is the main thread. It is selected there and shows what waits on you. The "Sala principal" row is only on phones (with the room's name) and in DMs.
  - I kept the server's per-thread message counts (`counts`). The reply count on the thread cards in the chat still uses them. Only the sidebar's use is gone.
- Other options: Hide the board only and keep its code for later. Keep the "Sala principal" row under the name.
- Risk: medium. It removes a view. Tasks of the main thread show only in the room's doc.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/threads-four-states · Epics show as threads, with 4 states and 2 tabs
- Agent: claude-opus-5-5
- Context: Gimenes #3989 (items 3 and 4), with the defaults he approved in #3993.
- Decision:
  - The visible text says "thread" (Portuguese: "a thread", feminine), not "épico". The code, the commands, the tool names and the `epics` table keep their names. There is no migration.
  - The states are A fazer, Fazendo, Requer ação (stored as `review`) and Feito. An epic archived without being done (`dismissed`) shows as Feito. The menu has no separate "Arquivado".
  - The sidebar has 2 tabs: "Threads abertas" and "Feitas". @vibe's suggestions (the old Plano tab) show under the open threads.
- Other options: Rename the storage and the tools too. Keep "Arquivado" as a fifth state.
- Risk: low. The server is unchanged.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · refactor/dnd-kit-svelte · The rail and the thread list sort with @dnd-kit/svelte
- Agent: claude-opus-5-5
- Context: Gimenes #4020 asked to use @dnd-kit/svelte instead of @dnd-kit/dom, and to make the code simpler.
- Decision:
  - New dependency `@dnd-kit/svelte` 0.5.3 (pinned, the same version as `@dnd-kit/dom`). It replaces our own layer (`navigation/sortable.ts` and `sortable-engine.ts`, about 180 lines).
  - Two new components in `lib/components`, because no existing component sorts:
    - `SortableList`: the provider, our sensors (a mouse moves 6 px, a finger holds 250 ms) and no Accessibility plugin. It keeps the order while a row is dragged.
    - `SortableItem`: one row (`createSortable`). Rows sort only in their group.
  - Svelte moves the rows. While a row is dragged, the parent shows the order of `SortableList`. On drop, the parent saves the order as before.
  - dnd-kit is now in the main chunk: about 35 KB gzip more (170 KB to 205 KB). The old layer loaded it on idle. A lazy load with @dnd-kit/svelte would render the list twice (without and with sorting) and lose focus, so the static import is the simple choice.
  - The old layer caught an error when the drag manager was created. The new code does not catch it. The risk is low: the manager is created in the browser and in happy-dom without errors.
- Other options: Keep @dnd-kit/dom with our layer (lazy, more code). Use dnd-kit's `move()` helper (it mixes the index in the group with the index in the full list).
- Risk: low. The main chunk is larger.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · fix/idempotent-send · One send makes one message (client_id)
- Agent: claude-opus-5-5
- Context: People saw the same message two times. A send that became "not confirmed" was sent again, and the server stored it again. The human approved the design and a new column in `messages`. Three reviews then asked for the changes below.
- Decision:
  - The ID is random (`crypto.randomUUID()`), not a hash of the content. Two real sends of "ok" stay two messages.
  - The scope is `(author, client_id)`, with a unique index. An agent ID is stored as `<agent>:<client_id>` (the MCP session), thus two agents of one person do not share IDs. The length check applies to what the client sends.
  - The ID stays for all time, because it is a column. There is no cleanup.
  - Only the text decides a conflict. The same ID and the same text returns the first message, also after `move_message`, `closeAsk` or a deleted reply target or file. The same ID with another text is refused (`idempotency conflict`). The composer shows that as a failure and does not keep the ID.
  - A send without an ID (an old client) gets a 10-second fallback: the same author, kind, model (`via`), thread, text and reply, plain text only. A `done` post, a card, choices, files or a tag never use it. The scan looks at the newest 50 rows of the thread (a subselect on the `(thread, id)` index), not a new index on `(author, ts)`. Trade-off: an old client that sends the same text two times in 10 seconds on purpose gets one message. The event `message_no_client_id` shows when the old clients are gone, then we can remove the fallback.
  - The lookups are `Book.byClientId` and `Book.recentRepeat`. The three entry points (WebSocket `msg`, `humanPost` over HTTP, `agentPost`) call them before the insert, so that no side effect runs again. On an MCP repeat, `src/agent.ts` also does not run `bumpStat` or move the read cursor, and the cursor update now never moves back. `addMessage` only stores the ID. The server's own posts do not call the lookups.
  - An MCP `post` with `html` and an ID asks `Book.agentRepeat` before the HTML check and the file store.
  - On a WebSocket repeat, the server sends the message again to the tab that sent it only, because the first push can be what got lost.
  - `client_id` stays visible on the wire (the `msg` event and the history). The reviews found it harmless: it is random, and the scope is the author.
  - The browser keeps an ID until its send succeeds: the composer for an unconfirmed draft that the person keeps (in memory, not after a reload), and the inbox reply, Home send and app post through a new small helper (`web/lib/client/sendIds.ts`), because no existing helper did this. A card answer is blocked while unconfirmed, thus it makes a new ID for each click.
  - The CLI does not make an ID. A new ID for each run protects nothing and turns off the fallback. It sends the ID that the agent gives. The CLI is thus unchanged and needs no release for this.
  - Polls (`poll.create`) are not included. A poll makes a poll row and a message, and its settle logic is separate.
- Other options: A content hash (merges real repeats). A time-limited table of IDs (more code, and a late retry makes a duplicate). Compare the full payload on a repeat (a retry after the room moved or closed the message is refused for all time).
- Risk: low. The column is nullable and old clients keep working.
- Undo: Revert this commit. The column and the index can stay.
- Status: open

### 2026-11-23 · feat/thread-origin · Each thread starts from a message in the main thread
- Agent: claude-opus-5-5
- Context: Gimenes (#4123, #4126) asked for "Criar thread" on a message, as in Discord. Threads do not nest. A thread from a message in another thread gets a message in the main thread that links it. "Nova thread" in the sidebar also writes a message in the main thread. These points are not from a human:
- Decision:
  - One function sets the origin (`Book.threadOrigin`) for the person's command and for the agent's `start_epic`. The line for a request inside a thread replies to that request (`reply_to`). Thus the room shows the quote, and `Book.epicsFrom` finds the thread of a request through the line. The three checks that read `from_msg` for a request (the ask of an agent, the reply that closes an ack, the room check of an ack) use `epicsFrom`.
  - The line is written as the person (the command) or as the agent (`start_epic`, kind `agent` with its model). It does not wake the router or run `answerIntent`: it is a record that a thread started, not a request.
  - The client picks the ID of the new thread (8 hex, the same form as the server's IDs). The command result has no payload, so this is how the app opens the new thread. A retry with the same ID makes nothing. An ID of another person's thread is refused.
  - Phones: a long right swipe (past 140 px) starts a thread. A shorter swipe (past 60 px) still replies. Phones have no message menu, and a third target on the left swipe makes the targets too small.
  - The title field is `InlineAdd` (the same row as "Nova thread"), filled with the first line of the message, at most 60 characters, cut at a word.
  - An agent's `start_epic` with no request now also starts from its "↳ virou o épico" line in the main thread.
  - Old threads that started inside another thread stay. No data changes.
- Other options: Return the new ID in the RPC result (more protocol work). A long-press menu on phones (a new component). Keep sub-threads for agents.
- Risk: medium. Every new thread now writes one more message in the main thread when it does not start from a main message.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/thread-tool-names · The thread tools have thread names

- Agent: Claude Opus 5.5
- Context: Gimenes asked to rename `start_epic` to `start_thread` (#4132), with the old names as aliases (#4134). Installed plugins and CLIs call the old names, and the CLI refuses a name that `tools/list` does not have.
- Decision:
  - The tools are `start_thread`, `update_thread`, `suggest_thread` and `delete_thread`. The agent rules, the plugin skill and `llms.txt` use these names.
  - `tools/list` also lists the four old names, each marked "Old name of …". A call with an old name runs the new tool (`TOOL_ALIASES` in `src/agent.ts`).
  - `delete_epic` is in the rename too, so that all thread tools have one form.
- Other options: Accept the old names in `tools/call` only (an old CLI then refuses them). No aliases (old plugins break).
- Risk: low. The old names keep working.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/draft-storage · Composer drafts stay in localStorage

- Agent: Claude Opus 5.5
- Context: Gimenes asked that the text in the message field come back after the person leaves a room or a thread and returns (#4172), "in sessionStorage or another local storage". The drafts lived only in memory, so a reload or a closed app lost them.
- Decision:
  - The text and the reply of each draft go to `localStorage` (`composer/draftStore.ts`), keyed by account, room and thread. A phone app that the system closes loses `sessionStorage`, so `localStorage` is the one that brings a draft back there.
  - Files and polls stay in memory only: a file cannot go into storage, and a half-made poll is rare.
  - At most 64 stored drafts; the oldest go first. A draft that becomes empty (sent, or erased) leaves storage.
  - A successful sign-out removes all stored drafts, so a shared device keeps none.
  - Every storage access is guarded. A blocked storage only loses persistence.
- Other options: `sessionStorage` (lost when the app closes). Store files too (they do not fit in storage).
- Risk: low. A draft can stay on a device until it is sent, erased, pushed out by newer drafts, or the person signs out.
- Undo: Revert this commit.
- Status: open

### 2026-11-23 · feat/invite-email · An invite email for a message request to someone not on deco.chat

- Agent: Claude Opus 5.5
- Context: Gimenes wrote to an email in "Nova mensagem" and expected an invite email when that person is not on deco.chat (#4195). Two agents checked every place where a person types another person's email. Room invites (People, the agent `invite` and `create_room` tools, the home's "start a room", an approved access request) already sent an email through `inviteMember`. A message request (`connect`) sent none.
- Decision:
  - One function sends every invite email: `sendInviteEmail` in `src/invite-mail.ts`. A room invite uses it with the room; a message request uses it without a room.
  - A message request sends the email only when the target has no `users` row and it is the first request from that sender to that email. A repeat or a declined request sends nothing.
  - The email does not contain the message. A stranger's text does not go out in a deco.chat email. The button goes to `/login`, not to a magic link, because no room exists yet.
  - The answer to the sender is the same in every case, so it does not show whether the email has an account. The "Nova mensagem" note says that a person who is not on deco.chat gets an email.
  - Room invites and message requests share one email budget for each sender (`invite:<sender>`, 5 a minute).
  - The agent `invite` tool sends the email again to a member who never signed in, as "reenviar" in People does.
- Other options: A magic link in the message-request email (it needs a new kind of link that signs in without a room). Include the message (spam risk).
- Risk: low. A sender can cause at most 5 emails a minute, and only one for each address.
- Undo: Revert this commit.
- Status: open

### 2026-11-24 · feat/infra-monitor · The infra monitor reads the Worker per day, cached for 10 minutes

- Agent: Claude Opus 5.5
- Context: Gui asked for an infra monitor with the last 7 and 30 days instead of the fixed `infra-ontem` app (#4208). The `metrics` tool gives only yesterday against the week before.
- Decision:
  - A new route `GET /api/metrics/infra?room=&days=` and the room app tool `vibebook_infra`, the same path and the same access check as `vibebook_ai_spend` (report rooms, members only).
  - The windows are 7, 14 and 30 days. The answer has two windows (this one and the one before), so 30 days reads 60 days. The Worker analytics can keep less than that; then the older days show as missing, not as zero.
  - Days are UTC days, because Cloudflare groups `workersInvocationsAdaptive` by UTC date. The visitors from D1 use the same days.
  - One Cloudflare GraphQL call and one D1 query for each call. The result is cached for 10 minutes for each window (the Cache API); a Cloudflare failure is cached for 1 minute and returned as `worker_error`, with the Worker numbers as null.
  - Only the Worker `chat` and the visitors. The zone numbers (requests by kind, bandwidth by route) stay in the daily `metrics` report.
- Other options: A `days` argument on the agent `metrics` tool (markdown only, no app). A cron snapshot in KV (more moving parts for one internal page).
- Risk: low. Members of the report rooms only, at most 2 upstream reads in 10 minutes for each window.
- Undo: Revert this commit.
- Status: open

### 2026-11-24 · fix/answer-epic-always-answered · The server makes sure an answer epic gets its answer

- Agent: Claude Opus 5.5
- Context: Gui (#4210): a question becomes an answer epic, but the Claude answers in main (reply_to) or not at all, and the epic stays on "Claude está escrevendo" forever, even marked done. The agent rules told agents to look for `answer: true` in `read_room`, which never sent it.
- Decision:
  - An agent `post` with `reply_to` = a question that has an answer epic goes into that epic when no other thread is given (or main).
  - In an answer epic whose doc is still empty, an agent post with `reply_to` or `done: true` is also written into the doc. A plain progress post is not.
  - An answer epic does not archive itself while its doc is empty.
  - `ack` of such a question returns `answer_thread` and how to answer. `read_room` epics show `answer` and `unanswered`.
  - 10 minutes after an answer epic is made with its doc still empty, one reminder (tag `reminder`, for the person who asked) goes into the epic. It is in their Claudes' `unacked` and wakes a listen.
- Other options: Only change the agent rules (they already said it, and agents still missed it). Let @vibe answer with Haiku (adds cost and a second answer source).
- Risk: low. A reply the Claude meant for main about a question with an answer epic lands in the epic, where the person is looking.
- Undo: Revert this commit.
- Status: open

### 2026-11-24 · feat/thread-status · A thread has one stored status, and only a person marks it done

- Agent: Claude Opus 5.5
- Context: Gimenes (#4245, #4247, #4249, #4251): threads showed "done" in Open threads. The icon came from `epicStatus()` (production counted as done) and the tab came from `archived` (auto-archive after all tasks done and a delivery). He asked for todo, doing, review and done only, the Done tab = done, no move to done when the tasks finish, and a "Mark as done" hint in the composer. He approved the migration and that the server marks done.
- Decision:
  - The `epics.status` column is always todo, doing, review or done. done = `archived = 1`, so the icon and the tab read one value. `epicStatus()` reads it; tasks and `prod` do not change it.
  - `autoReview()` replaces `autoArchive()`: the first task started moves todo to doing; tasks that become all done move the thread to review once for each round (`alldone:<id>` in meta), so a status chosen after that (doing, to work more) stays. An agent post with `done: true` moves the thread to review.
  - A person's message "Marcar como concluída" or "Mark as done" (case, accents and a final period ignored, nothing else in it) in an open thread marks it done. Any other message in a done thread opens it again as doing.
  - done (menu, `update_thread status` or `archived: true`) still closes the open tasks, like the old Archive. "dismissed" from an old client is done.
  - The composer of an open thread whose tasks are all done shows "Marcar como concluída (Tab)"; Tab writes the text, and the person sends it.
  - Migration, once per room on the Book's start (`epic_status_v2`): archived, done or dismissed → done; open with no task started → todo; every other open thread → review.
  - `read_room` epics show `status`. The agent rules and the `update_thread` text say: do not set done unless your human says so.
- Other options: Keep the derived status and change only the tab (the two rules stay). Let only the agent mark done (needs a listening agent). Move to review on every task change (overrides a person's doing).
- Risk: medium. The migration changes the status of every thread in every room, one time. Threads that used to close themselves now wait in review for a person.
- Undo: Revert this commit. The migrated statuses stay; the old code derives its own status when `status` is null only, so a revert shows the stored ones.
- Status: open

### 2026-11-24 · feat/notification-title · Notification titles: who wrote, then the room

- Agent: Claude Opus 5.5
- Context: Gimenes (#4253) asked for titles like Discord's: "Agente · sala" from an agent, "pessoa · sala" from a person, only "pessoa" in a DM. The app's own notification said "Claude Opus 5.5 de Gimenes · sala" and the web push said "agent de Gimenes · sala".
- Decision:
  - One function, `shared/notificationTitle.ts`, for both the app's notification and the web push.
  - An agent is "Agente" / "Agent" in the reader's language, without its owner or model. @vibe stays "@vibe".
  - The app's notification no longer starts with "@ · " for a mention, so both kinds of notification have the same title.
  - The titles that are not a message from someone ("⏸ Seu agent pede permissão", "❓ Seu agent pergunta", "X espera sua resposta") do not change.
- Other options: Keep the owner ("Agente de Ana · sala"): Gimenes said the agent's name is too long.
- Risk: low. Only the title text changes.
- Undo: Revert this commit.
- Status: open

### 2026-11-24 · feat/new-thread-direct · No "Nova thread" in the sidebar

- Agent: Claude Opus 5.5
- Context: Gimenes (#4286) asked for one way to start a thread: write in the room, then "Criar thread" on the message. He asked to remove "Nova thread" from the sidebar.
- Decision:
  - Remove the "Nova thread" row in the threads list, its title form and its draft state, the + on the collapsed rail, and the row in the loading skeleton.
  - Keep the server's `epic` command without `from` (agents and old tabs can still send it). Only the app's button goes.
  - The threads list keeps the 38 px that the row used: one more thread can show before "Ver mais".
- Other options: Keep the + on the collapsed rail: Gimenes asked for one way only.
- Risk: low. A person who used the sidebar row now writes a message first.
- Undo: Revert this commit.
- Status: open

### 2026-11-24 · feat/edit-delete-messages · Edit and delete messages

- Agent: Claude Opus 5.5
- Context: Gui (#4276, #4312) asked for edit and delete: the author edits and deletes, everyone sees "(editada)" or "Mensagem apagada" like WhatsApp, and the admin always sees what happened.
- Decision:
  - The admin is the room owner (`books.owner`). It is the only role that exists. The owner can delete any message, and only the owner reads `msg.history`.
  - An agent edits and deletes only the messages that it posted (`kind = 'agent'` and its human's email). A person cannot edit their agent's messages, and an agent cannot edit its human's messages.
  - The old text, files and card go to a new table, `message_edits`. The row in `messages` keeps only the current text. A delete clears the text, files, card, choices and poll, and keeps the row, so replies and threads from it stay.
  - The owner keeps the content of a deleted message (Gui #4312: "o admin sempre vai poder ver o que aconteceu"). A delete does not remove a secret from the owner's view.
  - An edited message comes back in `read_room` with `edited: true` for an agent that read the room before the edit (one cursor in `meta` for each human and agent name). The edit does not wake `listen`; the agent sees it at its next read.
  - The room's last-message preview in D1 and e-mails or pushes that already went out do not change.
- Other options: A delete that removes the content for the owner too (the first proposal in the doc). Gui chose that the owner sees it.
- Risk: medium. A new command can change old messages. The worker test `scripts/message-edit.test.ts` covers who can do what, and that no one but the owner gets the old text.
- Undo: Revert this commit. The new columns and table stay and are not read.
- Status: open

### 2026-11-24 · JonasJesus42/voice/screen-share-recording · Calls: the room is the channel

- Agent: Claude Fable 5.2
- Context: Jonas asked for voice channels, cameras and screen share on the Cloudflare Realtime SFU, at the lowest cost, with a move to Google Meet for the screen when the 1,000 GB free in a month are used.
- Decision:
  - One call for each room. No table of channels.
  - The call is in the room's view and on the room's WebSocket. A person who opens a different room leaves the call. One person has one session.
  - A person who opens a room with a call on joins it with the microphone off (Jonas asked for the automatic join; the microphone off is my choice).
  - No SFU SDK and no TURN: the Worker calls the SFU's HTTPS API, and the browser uses `RTCPeerConnection` with STUN only.
  - The limit uses Cloudflare's real traffic for the account (the analytics API, with the token that the reports use) and, as a second count, the bytes that the browsers report. A screen share stops at 900 GB (`CALL_SCREEN_LIMIT_GB`), not at 1,000, to leave a margin. The limit stops screens only, not cameras.
  - To spare traffic, a browser receives no camera while a screen is on show, and one screen at a time.
  - A microphone that is off is a disabled track, not a sender without a track: the SFU refuses to give the others a track that never sent (`empty_track_error`).
  - The Google Meet path keeps no Google token (AGENTS.md, rule 1): the person opens `meet.new`, pastes the link, and the app posts it with a mention of each person in the call.
  - The call's controls are under the stage with their text, not in the top bar (docs/design.md allows three controls there).
  - Entering the call closes the pane and sends the sidebar to its rail. Leaving puts them back.
  - The feature is off until the SFU app's two secrets exist.
- Other options:
  - RealtimeKit (ready UI, recording): Jonas refused it for its cost for each minute of each person.
  - A call that stays when you open a different room, like Discord: it needs the call above the room's view and a second room socket. Add it if people ask.
  - The Meet REST API to make the link: it needs a Google token on the server.
- Risk: medium. The pure parts have unit tests. The WebRTC path was tested by hand and with two automatic browsers against a real SFU app on a local Worker, not on a deployed Worker and not with more than three people.
- Undo: Revert this commit. The `call_usage` table in D1 and the `call` key in each room's `meta` stay and are not read.
- Status: open

### 2026-11-24 · JonasJesus42/voice/screen-share-recording · A dependency for the camera's background blur

- Agent: Claude Fable 5.2
- Context: Jonas asked for a camera dialog with a preview and a background out of focus, with levels, as Meet and Discord have.
- Decision:
  - Add `@mediapipe/tasks-vision` 1.2.3 (Apache 2.0, exact version) and keep its selfie segmenter model in `public/vendor/mediapipe/`. The browser has no feature that does this on all platforms.
  - The runtime is 15 MB. It is in its own chunk and loads only when a person turns the blur on.
  - The frames are drawn on a timer in the page. In a tab that is not on show the browser slows that timer, and the others see the camera almost still.
  - Four more Untitled UI icons in the sprite, for the microphone off, the screen and the camera.
- Other options: The `backgroundBlur` camera constraint (few platforms have it, and it has no levels). A worker with `MediaStreamTrackProcessor` (no slow timer, more code, Chrome only).
- Risk: low. Without the blur the camera works as before. If the model does not load, the dialog says so and the camera goes without it.
- Undo: Remove the dependency, `web/features/call/blur.ts`, the levels in `CameraDialog.svelte` and `public/vendor/mediapipe/`.
- Status: open

### 2026-11-24 · JonasJesus42/voice/screen-share-recording · The call recorder is a second Worker with a container

- Agent: Claude Fable 5.2
- Context: Jonas asked that calls go to Grain (the team pays for it) and approved a container, a Grain token on the server and a Worker apart from the chat.
- Decision:
  - The recorder is the room's own page in a Chromium, in a container, as one more participant. It records what a person sees and hears. This is the pattern of `decocms/channels` (one container for each thing that runs).
  - A second Worker, `chat-recorder`, so that a failed image build never stops a deploy of the chat. The chat calls it with `fetch` and a shared secret, not with a service binding: `wrangler.jsonc` of the chat does not change.
  - The recorder has an identity that is not a person (`gravador-<room>@call-recorder.invalid`). A link signed with `SESSION_SECRET`, good for 5 minutes, is the only way to a session for it. `isMember` accepts it for its one room.
  - Each person sees "Gravando" while the recorder is in the call. No recorder, no mark.
  - Grain refuses the browser's file, so ffmpeg converts it. Grain transcribes the audio and names all the voices "Speaker 1". Its summary does not run by itself on an upload: a person clicks "Run Intelligence" there.
  - `GRAIN_API_TOKEN` is a new server credential (AGENTS.md, rule 1 has a list of exceptions). Jonas approved it. It is in the recorder Worker, not in the chat.
  - Rooms are recorded only if `CALL_RECORD_ROOMS` lists them, because the Grain account is the operator's.
- Other options: The SFU's WebSocket adapter with audio only (no video of the screen). RealtimeKit's recording (cost). A recorder in a participant's browser (it stops when that person leaves).
- Risk: medium. A recorder container, a local chat and the real SFU and Grain ran together one time. The deployed Worker and its container were not tested with a real call.
- Undo: Remove `RECORDER_URL` from the chat's secrets (recording stops at once). Then delete the `chat-recorder` Worker and `recorder/`.
- Status: open

### 2026-11-24 · JonasJesus42/call-recording-safety · A recorded call says who spoke, and a failed recording shows

- Agent: Claude Fable 5.2
- Context: After the first calls in production, Jonas asked for each call to be recorded, with the thread's name, a transcript with names, a summary in the room, better picture quality, and the cameras on show while a screen is shared. He also asked for the failures that nobody would see.
- Decision:
  - A call is of the thread that the first person had open. The recording's title has the room and the thread, and the summary goes to that thread.
  - Our own transcript: Whisper (Workers AI, in the recorder Worker) on parts of 5 minutes, with each piece given to the person whose "speaking" mark covered it the most. The marks come from the recorder's page, each 200 ms. Two people who speak at one time get one name.
  - The summary uses `MODEL_FAST`, the model that the mention e-mails use. This is a new cost for each recorded call.
  - A person alone in a call is not recorded: the recorder comes when a second person joins. The first production recording was one person for 159 seconds.
  - A piece of the transcript with nobody's mark near it and a high "no speech" score is dropped. In that first recording such pieces had the name "Desconhecido".
  - A recorder that leaves a call that goes on is started again, 5 times at most.
  - Quality: camera 360p at 24 frames and 500 kbps (it was 200 kbps, which gave 180p), screen 1080p and 2.5 Mbps, voice 32 kbps. Cameras are received while a screen is on show. Both cost more traffic.
  - `CALL_RECORD_ROOMS` is `*` in production (Jonas: "gravar qualquer call"). Every room's calls go to the operator's Grain.
  - A workflow deploys the recorder. It does nothing until a human makes the `RECORDER_DEPLOY_TOKEN` secret.
- Other options: Grain's own transcript only (all voices are "Speaker 1"). The speech-to-text for each person's own track (exact names with two voices at one time, and much more code in the recorder). Parts sent to Grain during the call (nothing is lost when the recorder stops, and one call is many recordings).
- Risk: medium. The parts ran together on a local machine with the real SFU, Workers AI and Grain. The deployed recorder with these changes was not tested with a real call.
- Undo: Revert this commit and deploy the recorder again. To stop recording at once, remove `CALL_RECORD_ROOMS` from the chat's secrets.
- Status: open


### 2026-11-24 · danielfurt/app-composer-draft · An MCP app can put a draft in the composer

- Agent: Claude Opus 5.5
- Context: Daniel reviews blog posts in the content-os MCP app, in the Apps tab of a room. He selects a passage to comment on it. Each `ui/message` from the app asked "Allow" before the post. Daniel wants the passage to go in the composer of the thread, so that he can type or dictate the comment and send it himself.
- Decision:
  - A `ui/message` where each text block has `_meta: {"vibebook/compose": true}` does not post. The text goes in the composer of the thread, after the text that is already there, and the composer gets the focus. There is no question, because nothing goes to the room until the person sends it.
  - The host context has `"vibebook/compose": true` only where the chat can do this (the Apps tab and app lines in documents). An app that does not see it keeps its own path.
  - A `ui/message` without the mark on each text block is a post, as before.
  - There is no `track()` event: no new control shows, and the browser has no event path. The message that the person sends is a normal message.
- Other options: A new request method (`vibebook/compose`). The SDK on the side of the app sends only the methods that it knows, so an app would need its own code for the request. `ui/update-model-context` (silent, but in a room it has no target). An "always allow" in the confirmation of a post (a post without a question is a larger change in the security model).
- Risk: low. An app can put text in the composer when the person does not expect it, but it cannot send it. It cannot remove the text of the person.
- Undo: Revert this commit. Apps then get the question before each post again.
- Status: open

### 2026-11-25 · feat/ack-opens-thread · A request taken in main opens its thread on the ack

- Agent: Claude Opus 5.5
- Context: Gui (#4562, #4565): main should be almost only thread starts. Agents answered requests in main instead of opening a thread.
- Decision:
  - When an agent acks (`doing`) a message of its own human in main that has no thread, the server opens a thread from it (title = the request, owner = that person, status doing). `start_thread` for that message returns this thread once and sets the agent's title, goal and tasks.
  - A post in main with `reply_to` a request that has an open thread goes into that thread.
- Other options: open a thread for every message of a person in main (also small talk and yes/no answers would become threads); only a stronger rule for agents (agents already had the rule and skipped it).
- Risk: low. A short request that an agent acks with `doing` gets a thread with no tasks. Another person's message, an `idle` or `done` ack and DMs open nothing.
- Undo: Revert this commit. Agents then open threads only with `start_thread`.

### 2026-11-25 · danielfurt/composer-reference · An app's quote is a chip in the composer, and the mic stays on a computer

- Agent: Claude Opus 5.5
- Context: After the composer draft (#404), Daniel said that the quoted passage in the field looked bad. He asked for a reference like Notion's: a chip with the passage above the field, and an empty field for the comment. He also said that the mic goes away when the field has text, so he cannot dictate after the quote.
- Decision:
  - A draft block with `_meta["vibebook/reference"] = { label }` is a quote. The composer shows the label in a chip (the `Chip` atom, with an `x` to remove it). When the person sends, the text of each quote goes before the typed text, with a blank line between them. The message is the same text that the field had before, so agents and the thread read it as before.
  - A quote alone can be sent. The quotes are part of the draft: they are kept in storage with the text and the reply, they come back when a send fails, and they clear when it is sent. At most 8 quotes; the same text once.
  - A block without a usable label is text for the field. A host before this change does the same, so an app can send the reference mark at all times.
  - On a computer (from `md`), the mic and send are two buttons, side by side. Send is off until there is something to send. On a phone they still share one cell (#3821), because the field is narrow. This changes #3821 on a computer.
- Other options: Keep one cell and let a person hold Space to dictate (it works with text, but nobody finds it). A rich quote block inside the field (a larger change to the field). A structured quote in the message (a change to the room's message format and to every reader of it).
- Risk: low. The composer looks different on a computer: an extra button. The send path changes only by the text that it joins.
- Undo: Revert this commit. An app's reference then goes in the field as text, and the mic and send share one cell again.
- Status: open

### 2026-11-25 · feat/reconnect-resume · A reconnect resumes on the socket, before GET /room

- Agent: Claude Opus 5.5
- Context: Gimenes approved the 5-PR cache plan (#4638, #4653, "vai, seu objetivo e ter tudo em main"). The plan's PR 2 was `GET /room` plus a light socket (`?lite=1`). The measurement (PR 0, #4649) showed that 51% of room opens are reconnects (code 1006) that get the whole `state` again (390 KB in the product room), and that the threads (192 KB) and the 5 messages of each other thread (144 KB) are most of it. Moving the same state to `GET /room` sends the same bytes.
- Decision:
  - A reconnect resumes on the socket. The app sends what it has: `since` (its newest message id), `at` (the time of its last state) and `eh` (the hash of the threads that it got). The Book keeps nothing for each client.
  - The answer is a `state` with `resume: true`: the open thread's window and every message newer than `since`, or edited or deleted since `at`. The threads are left out (`epicsSame`) when their hash is the same. All other fields are sent whole, as before. The app merges messages and acks into the room it has.
  - The whole state comes when there are no params, the state is older than 6 hours, or more than 200 rows changed. A cached room that opens again (the 12-room cache) also resumes.
  - `ws_state` records `resume` (`same`, `epics` or `full`), so the next measure shows the effect.
- Other options: `GET /room` with `?lite=1` first, as in the plan (the same bytes until IndexedDB and ETag come). A change log in the Book (rejected before, #4553).
- Risk: medium. A reaction or a card that changed on an older message during the gap shows only after the next full state or live event. Any bug in the merge shows old or missing messages until a reload.
- Undo: Revert this commit. The app then does not send `since`, and the Book sends the whole state.

### 2026-11-25 · danielfurt/human-quotes · Lines that start with "> " are a quote in a person's message

- Agent: Claude Opus 5.5
- Context: The content-os reader puts a passage in the composer as a reference (#409). After the send, the message showed the raw `>` and the reference and the comment looked the same. Daniel asked for a different look for the reference, so that a thread with many comments stays easy to read.
- Decision:
  - In a person's message (the `human` mode, plain text), a run of lines that start with `> ` (or a lone `>`) is a quote block. It uses the same style as a quote in an agent's markdown (`border-l-2`, muted text). Mentions and links inside it still work.
  - Only this one markdown rule applies. The rest of a person's message stays literal: `**`, `#`, backticks and HTML show as typed.
  - The empty lines just before and after the block are removed, because the block has its own margins.
- Other options: A structured quote in the message (a change to the message format, the server and every reader). Full markdown for people's messages (a large change to what people see when they type symbols).
- Risk: low. A person who types `> ` at the start of a line now sees a quote, as in Slack and Discord.
- Undo: Revert this commit.
- Status: open

### 2026-11-25 · feat/room-cache · Rooms are saved in IndexedDB, without DMs, for 7 days

- Agent: Claude Opus 5.5
- Context: The cache plan's PR 3 (Gimenes #4653: "o indexeddb é pra evitar pegar um range grande de mensagens", "o room deveria ser stale-while-revalidate, entao deveria ser instantaneo mudar de sala"). PR 2 (#418) made a socket resume from a room that the app has. Before this change, the app had rooms only in memory (12 rooms), so a reload got each whole state again.
- Decision:
  - The app saves each room that you open in IndexedDB, with the newest 400 messages, and draws it before the socket answers. The socket then resumes from it.
  - It does not save DMs (the plan said "no DMs at first"). A saved room expires after 7 days. A sign-out, a refused session or another account deletes all saved rooms. A room that `/api/me` does not list is deleted.
  - After a reload, the app waits for `/api/me` (at most 300 ms) to know whose rooms to read. It never draws a saved room for an account that it does not know.
  - The open waits at most 300 ms for IndexedDB, then the socket starts.
- Other options: localStorage (5 MB, synchronous). A Service Worker cache of `GET /room` (no `GET /room` yet). Save DMs too.
- Risk: medium. Room content stays on the device until a sign-out or 7 days, so a person who uses your browser profile while you are signed in can read it in the browser's storage. A bug in the merge shows old messages until the server answers.
- Undo: Revert this commit. The app then keeps rooms in memory only, and old saved rooms stay unused in IndexedDB.
- Status: open

### 2026-11-25 · feat/link-chips · Link chips: new component, own endpoint, page cache

- Agent: Claude Opus 5.5
- Context: The product owner asked that a link to this app in a message show as a one-line chip of where it goes, and "Sala privada" when the viewer can't see it. The details below were not specified.
- Decision:
  - A new component `AppLinkChip.svelte` (no existing component draws an inline place: `Chip` is a control, the file and GitHub chips are part of `RichNodes`). It uses `PersonAvatar`, `RoomMark` and `Icon`.
  - A new route `GET /api/books/:id/link` answers 200 with `{kind:"private"}` for a non-member, a missing room, thread or message, and a message the chat hides from the viewer, so the answer never tells them apart. The rules are in `src/linkTarget.ts`.
  - Only a link whose text is the bare URL becomes a chip. A link with its own text stays a link, and a click opens it in the app.
  - A file link (`#f`), an app link and `#doc` without a thread stay links.
  - The open room's messages and threads come from its state. A link to the open room itself still asks the server, because only the server has the room's icon version.
  - Answers are kept for the page's life, `private` too: a person who joins a room sees its chips after a reload. A failed request is not kept.
  - One request per place, not one batched request for all links.
- Other options: A batched endpoint for all links of a page. A chip for labelled links too. No cache for `private`.
- Risk: low. A chip can show an old title until a reload.
- Undo: Revert this commit.
- Status: open

### 2026-11-25 · feat/one-room-memory · Memory keeps only the open room, and DMs are saved too

- Agent: Claude Opus 5.5
- Context: The cache plan's PR 4 ("Só a sala aberta em memória: sai o cache de 12 salas"), approved by Gimenes (#4653, #4670). PR 3 (#420) saved rooms in IndexedDB but not DMs ("no DMs at first"). Gimenes: "Dms sao rooms como qualquer outras, nao? tem do, tem tudo" (#4804).
- Decision:
  - IndexedDB saves DMs like other rooms. `/api/me` lists DMs that have messages, so the prune keeps them.
  - With IndexedDB, memory keeps only the open room. A room that you open again draws from IndexedDB (at most 300 ms), then resumes.
  - Without IndexedDB (a private window), memory keeps the 12 newest rooms, as before.
- Other options: Keep DMs out of IndexedDB and in memory (the first version of this PR).
- Risk: low. DM content now also stays on the device until a sign-out or 7 days, as room content does. A switch back to a room waits for IndexedDB (usually a few milliseconds) instead of memory.

### 2026-11-25 · feat/room-context-menu · Room settings dialog becomes one context menu

- Agent: Claude Opus 5.5
- Context: The product owner asked for a Discord-like context menu on a room in place of the "Settings for <room>" dialog, with Mark as read, Invite people, Notifications, Color, Icon, Rename, Move, Copy link and Archive.
- Decision:
  - One menu for the whole app (`RoomMenu.svelte`, mounted by `AppNavigation`). It is the studio `DropdownMenu` anchored at the pointer (`customAnchor`), not one bits-ui `ContextMenu` per row. The rail, the phone's grid and list, and the DM rows only call `controller.openMenu(id, trigger, point)` through one action (`roomMenuTrigger.ts`): a right-click, a 500 ms touch long press, or Shift+F10 / the ContextMenu key.
  - "Mark as read" got a small new path: `POST /api/books/:id/read` writes `human_reads` up to the room's last message. The dot goes at once in the client.
  - Left out: "Invite people" (the invite form lives in the room's People panel; no route opens it from outside the room) and "Notifications" (the app has no per-room mute).
  - "Rename room" shows only for the room that is open, as before: the rename goes through that room's socket.
  - A DM gets "Mark as read" and "Copy conversation link" only. Archive is left out for a DM, because an archived DM would hide new messages from that person.
  - Errors of a change and "Copied" show for 2.5 s in a small notice at the foot of the screen.
- Other options: One `ContextMenu` per row (like the pins); keep the dialog and add a menu beside it; send the person to the room and open its People panel for "Invite people".
- Risk: low. The same mutations as the dialog, from a different surface.
- Undo: Revert this commit.
||||||| parent of 7a68e433 (feat(cli): Codex wakes from the room through codex queue; the plugin works in Codex; herdr installs the plugin (1.7.9))

### 2026-11-25 · viktor/codex-setup · Codex listens through codex queue

- Agent: Claude Opus 5.5
- Context: A person set up deco.chat in Codex with the prompt from `llms.txt`. Codex could read and post, but no room message ever woke it: `vibebook listen` prints one line and exits, and only Claude Code starts a turn when a background command ends. Codex also stopped the listen at the end of its turn. The same person asked for a setup that works for Codex and for new people. Codex 0.172 has `codex queue --thread <id> --message <text> --resume`, which starts a turn in a thread, and it sets `CODEX_THREAD_ID` in the env of each command.
- Decision:
  - Inside Codex (`CODEX_THREAD_ID` set, no `CLAUDE_CODE_SESSION_ID`), the agent is the Codex thread, as a Claude Code session is.
  - `vibebook listen` in Codex starts itself detached with `--codex-wake <thread>` and returns at once. On news, the child queues one message into the thread with `codex queue --resume`. The same news within 10 minutes is not sent again. `--once` keeps the old one-shot listen.
  - The child stops 15 minutes after no Codex window is open (the app-server daemon does not count, because it stays up). When the CLI file changes, it starts the new CLI itself.
  - The Claude Code plugin is also the Codex plugin (`codex plugin add vibebook@vibebook` reads the same marketplace). The session hook detects Codex by its rollout `transcript_path` and gives Codex its own listen step. The permission hook names the agent after the Codex thread.
  - The herdr runner installs the Claude Code plugin when it is missing. Without the plugin, the Claude it opens gets the listen prompt in words, not `/vibebook:listen`.
  - `vibebook herdr --agent codex` opens Codex in each room. It installs the plugin in Codex and writes `~/.codex/rules/vibebook.rules`, a rule that runs only the `vibebook` command outside the Codex sandbox (Codex's sandbox has no network and cannot write `~/.vibebook`). Not `--dangerously-bypass-approvals-and-sandbox`: a room agent reads other people's messages, and that flag removes every approval for every command.
- Other options: A Codex `Stop` hook that blocks until the room has news (it holds the turn open and the person cannot type). A separate Codex plugin folder (two copies of the same skill and hooks). Let the waker run while Codex is closed (queued turns then run in the daemon with nobody watching, on the person's plan).
- Risk: medium. A queued turn starts while the person types in Codex. The process check can miss a Codex started in an unusual way; then the child stops after 15 minutes and the person runs listen again.
- Undo: Revert this commit. Codex then reads and posts but is not woken, and the runner opens Claude with `/vibebook:listen` again.
- Status: open

### 2026-11-25 · fix/link-reveal · A message link survives the live room and an old bottom intent

- Agent: Claude Opus 5.5
- Context: A copied link to a message (`#m<id>`) still opened the room at the bottom after #434 (Gimenes #4843). Two causes:
  - The room opens from IndexedDB, and the link search asks for an older page. Then the live room replaces the saved one (a new connection), the page of the old connection is dropped, and the search stopped.
  - A render measured with bottom intent before the jump applied it during the jump.
- Decision:
  - When the same room and thread are replaced while a link search runs, the search starts again on the new connection.
  - During a jump, a bottom intent of a render does not move the chat. A real bottom intent (own send, "latest") ends the jump first.
- Other options: Keep the page of the old connection. Start the link search only when the room is live.
- Risk: low. A search that starts again sends up to 15 more page requests.
- Undo: Revert this commit.

### 2026-11-25 · fix/ws-resume-params · The worker passes the resume to the Book, from a new small module

- Agent: Claude Opus 5.5
- Context: The worker's `/ws/:id` route built the Book's URL with only `book`, `t` and `rc`. It dropped `since`, `at` and `eh`, so no room open resumed (cache plan PR 2) and each open sent the whole room. In production, 0 of 166 opens in one hour resumed.
- Decision:
  - A new module `src/bookSocket.ts` builds the URL. `src/rooms.ts` (beside `bookStub`) imports Worker-only modules, so a test cannot import it.
  - The worker passes only numbers for `since`, `at` and `rc`, and only letters, digits, `_` and `-` for `eh`. A resume needs both `since` and `at`.
- Other options: Pass the whole query string to the Book. Keep the code in `src/index.ts` with no test.
- Risk: medium. The resume path now runs in production for the first time. A bug in it shows wrong messages until the next full open.
- Undo: Revert this commit. Opens then send the whole room again.
- Status: open

### 2026-11-25 · JonasJesus42/call-audio-test · RNNoise noise suppression in the call, on by default

- Agent: Claude Opus 5.5
- Context: In the first team call, the other side heard the construction behind Leandro (Grain bedd8d31). Jonas asked for a noise suppression like Discord's, on for all when the result is good, and a local test that captures the audios (#4961).
- Decision:
  - Add `@sapphi-red/web-noise-suppressor` 0.4.2 (MIT, exact version) and use its RNNoise worklet. The browser's own noise suppression is not enough for this noise.
  - It is on by default. A switch in "Mais opções" turns it off on that device, and changes the track of the call with `replaceTrack`, without a new negotiation.
  - The raw microphone stays for mute and for the speaking mark.
  - After RNNoise, a gain of 2 (+6 dB) and a limiter at -6 dB. RNNoise alone left the voice about 6 dB lower (Jonas: "ficou baixo").
- Measure (`scripts/call-audio-test.ts`, the fixture with construction, keys and a voice), what the other side hears:
  - Browser noise suppression only: noise floor -49.7 dB, speech -13.0 dB.
  - RNNoise only: noise floor -69.9 dB, speech -19.2 dB.
  - RNNoise, gain and limiter: noise floor -61 dB, speech -14 dB, peak -6.2 dB.
- Other options: DeepFilterNet (better, about 10 times the CPU and a larger model). GTCRN from the same package (newer, not measured yet). Krisp (paid, a key in the browser).
- Risk: medium. RNNoise can cut a quiet voice. Each person can turn it off. It uses one more AudioContext and some CPU on each device in a call.
- Undo: Revert this commit. The `vb-call-denoise` key in `localStorage` stays and is not read.
- Status: open

### 2026-11-25 · JonasJesus42/call-nav-blur · The blur uses the multiclass model and blurs only the background

- Agent: Claude Opus 5.5
- Context: In the call of Gimenes and Leandro the blur was "meio bugado". Jonas: the model does not find the person well, and the type of blur is different from Meet.
- Decision:
  - Use MediaPipe's `selfie_multiclass_256x256` model in place of `selfie_segmenter`. On a test portrait the old model kept part of the flag behind the shoulder as the person; the new one does not.
  - Blur only the background: the frame with the person cut out, at a quarter of the size, drawn three times so its edge is opaque. The person's colors do not make a halo.
  - A firm edge (a short ramp between 0.3 and 0.7 of the model's confidence), mixed with the mask of the frame before.
  - Stronger levels: light 10 px, strong 32 px (was 6 and 18).
- Measure (`scripts/call-blur-test.ts`, with the GPU of a MacBook): 18 frames a second with the old model, 15 with the new one.
- Other options: Keep the old model with the new drawing (faster, but it does not fix the cut). A WebGL pipeline with a joint bilateral filter, as Meet has (much more code).
- Risk: medium. The model is 16 MB (was 250 KB): the first blur takes longer to start, then the browser keeps it in its cache. On a slow computer or phone the frame rate can go down.
- Undo: Revert this commit.
- Status: open

### 2026-11-25 · feat/dm-same-domain · Colleagues by company email domain in "Nova mensagem"

- Agent: Claude Opus 5.5
- Context: The product owner asked that people with the same company email find each other when they start a DM, with no change to the UI (Gimenes #5006, after the corporate rooms mockup). The details below were not specified.
- Decision:
  - A company domain is the domain of the email, except a list of free providers (gmail.com, hotmail.com, outlook.com, icloud.com, uol.com.br and others, `shared/dm.ts`).
  - A colleague is a person with an account (a `users` row) on your company domain. The picker shows up to 200 of them after the people from your rooms, with "pelo seu e-mail @domínio".
  - You can DM a colleague without a message request (`canDm`), the same as a person from your rooms.
  - Nothing changes for rooms. A colleague does not see your rooms.
- Other options: Let a company turn this on (a list of domains). Show colleagues only after you type. Keep the message request for colleagues.
- Risk: medium. On a shared domain that is not in the list (a university, an ISP), strangers see each other's email, name and picture and can DM without a request.
- Undo: Revert this commit.
- Status: open

### 2026-11-25 · JonasJesus42/dm-record-consent · How a DM asks for the recording

- Agent: Claude Opus 5.5
- Context: Jonas: "DM tem que ter o aviso e só grava se aceitar". A room's call stays recorded always, with the notice.
- Decision:
  - Each new DM call asks both people on the stage ("Gravar esta call no Grain?", Gravar / Não gravar). The recorder starts only after both said yes.
  - One "Não gravar" ends the question for that call: a later yes does not record it. The next call asks again.
  - The answer is stored in the Book's meta for the current call only (`call_consent`), and it counts from a stage that shows before the room has the person in the call.
- Other options: Only the person who starts the call asks, and the other sees a notice. A setting per DM that stays between calls. Never record a DM.
- Risk: low. A room's call does not change. A DM call where nobody answers is not recorded.
- Undo: Revert this commit.
- Status: open
