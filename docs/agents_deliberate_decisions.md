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
- Status: open
