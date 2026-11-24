# Workflow

## Set up

1. Install Bun 1.4.4. Make sure that `bun --version` shows 1.4.4.
2. Run `bun install --frozen-lockfile`.
3. Copy `.dev.vars.example` to `.dev.vars`. Set `OPENROUTER_API_KEY` and `SESSION_SECRET`.
4. To skip the sign-in in local development, set `DEV_EMAIL`. It works only on a loopback host.

## Develop

| Command | Result |
|---|---|
| `bun run dev` | Starts the Worker at http://127.0.0.1:8797. Wrangler builds the browser app into `dist/` first. |
| `bun run dev:app` | Starts the Worker (8787) and Vite (5173) with hot reload. Open http://127.0.0.1:5173/. |
| `bun run dev:components` | Starts Vite with hot reload. Open http://127.0.0.1:5173/dev/gallery.html (components) or `/dev/design-system.html?id=<story>` (design system). |

Rules:

- Use `127.0.0.1`, not `localhost`. OAuth needs a loopback IP address.
- To change the local identity, open `/api/dev/as?email=<email>`.
- Local emails go to `.wrangler/tmp/email/`.
- Use test data only. Do not use real rooms, names or emails in tests or screenshots.

## Check

1. Run `bun run check`. It runs types, the i18n check, unit and DOM tests, boundary checks and the format check.
2. If `check:guidelines` fails, read its output. It shows each new violation of the rules in `stack.md`, `folder-map.md` and `writing.md`.
   - Fix the new violation. Do not add it to the baseline.
   - If you removed old violations, the check also fails. Run `bun scripts/guidelines-check.ts --update`. Commit `scripts/data/guidelines-baseline.json`.
3. If you changed the browser, run the browser tests for that area (`test:*:browser` scripts in `package.json`). They need Playwright Chromium (`bunx playwright install chromium`).
4. If you changed the agent tools, run `bun scripts/agent-check.ts` against local development.
5. If you changed the router, the "Router bench" workflow runs `bun scripts/router-bench.ts` on main and on your branch and comments the scores on the pull request. Put the scores before and after the change in the pull request. This is a hard rule (AGENTS.md, rule 14). Every case must pass, also the production cases in D1 (table `router_feedback`: wake and every router action, each its own part), and a score must not go down. A case that fails runs two more times and passes if both pass. New behavior gets new cases in `scripts/router-cases.json` or `scripts/router-action-cases.json`.

## CI

The rule: quick CI on pull requests, long CI on `main`.

| Job (`.github/workflows/ci.yml`) | Runs on | Blocks the merge |
|---|---|---|
| `verify`: types, lint, unit and DOM tests (`bun scripts/check-ci.ts`), about 2 minutes | pull requests and `main` | Yes |
| `browser-app`, `browser-ui`: real-browser tests | `main` and manual runs only | No |
| `ci`: the result of the three jobs above | pull requests and `main` | Yes (on a pull request, the browser jobs are skipped) |

- Do not make a browser test run on pull requests. Do not make it block the merge.
- Two workflows run only when you add their label to a pull request, or when you run them by hand:
  - `app-hmr` (label `run-hmr`): hot reload of `bun run dev:app`.
  - `chunk-diagnostics` (label `run-chunk-diagnostics`): which modules go into each chunk of the browser build.
- The "Workers Builds" checks on a pull request are not required. Do not wait for them.
- `router-bench` (`.github/workflows/router-bench.yml`) runs only on a pull request that touches the router (AGENTS.md, rule 14), and by hand. It needs the `OPENROUTER_API_KEY` and `CLOUDFLARE_API_TOKEN` (D1 read only) repository secrets. It comments the scores on the pull request and fails when a case fails or a score goes down. It does not print the text of a D1 case, because the logs are public. If it fails, do not merge: fix the change or ask a human.
- If CI on `main` fails, `.github/workflows/main-red.yml` opens an issue with the label `main-red` and mentions the commit author. When CI on `main` passes, it closes the issue.

## Build output

`bun run build:ui` builds the browser app (`web/index.html` and the service worker) into `dist/`, together with a copy of `public/`. The Worker serves `dist/`. Wrangler runs this build before `wrangler dev` and `wrangler deploy` (`build` in `wrangler.jsonc`). Do not commit `dist/`.

The component gallery (`web/dev/gallery.html`) is not in `dist/`. `bun run build:gallery` builds it into `dist-gallery/` for the browser tests (`test:room-layout:browser` and the gallery part of `test:design-system`). Run it before these tests. Do not commit `dist-gallery/`.

Some other build output is in git. If you change the source, build it and commit the output in the same commit.

| Source | Command | Output to commit |
|---|---|---|
| `cli/` | `bun run build:cli` | `public/cli.mjs`, `cli/cli.mjs` |
| `web/lib/studio/icons.ts` | `bun scripts/icon-sprite.ts` | `web/lib/studio/icons.svg` (`bun run check:icons` fails if it is different) |
| `shared/agentRules.ts` | `bun scripts/agent-prompts.ts` | the `<!-- agent-rules:<name> -->` regions in `claude-plugin/skills/vibebook/SKILL.md`, `claude-plugin/commands/{listen,setup}.md`, `public/llms.txt` (`bun run check:agent-prompts` fails if a region is different) |

Do not commit `dist/`, `dist-gallery/`, `dist-mcp/` or `.api-types/`. The build makes them.

## Text and languages

- Put each new UI string through `t("texto em pt")` and add its English text. `bun scripts/i18n-check.ts` fails if a key is missing.
- Write each public page in Portuguese and English.

## Tell people

If a person can see the change, say what changed in the release message in the project room. There is no changelog page.

## Release (deploy)

Each merge into `main` is a release. Workers Builds deploys the `chat` Worker (build command `bun run build:app-document && bun run build:mcp`, deploy command `npx wrangler deploy`, which builds `dist/` first).

**Warning: Never leave `main` red. A red `main` is a failed check on the newest commit of `main`.**

1. Open a pull request. Fill in each section of `.github/pull_request_template.md`.
2. Rebase the branch on the newest `main` (`git fetch origin && git rebase origin/main`). Push it.
3. Enable automerge: `gh pr merge <number> --auto --squash`.
4. Wait for the merge. If `verify` fails, fix the branch and push again.
5. After the merge, watch the checks of the merged commit on `main` (`gh run list --branch main --commit <sha>`, `gh run watch <id>`). This includes the browser jobs.
   - A newer push to `main` cancels the older run. If your run is cancelled, watch the run of the newest commit on `main`. It contains your change.
6. If a check on `main` fails, open a new pull request with the fix at once. Use the same procedure. Do not start other work before `main` is green. The open `main-red` issue shows the failed jobs. It closes when `main` is green.
7. Look at the Workers Builds deploy in the Deployments tab of the Worker.
8. Check the change in production.
9. Report the release in the project room.

`bun run deploy` from a computer is for hotfixes only. Ask a human first.

The Worker `chat` (chat.decocms.com, in the deco Cloudflare account) deploys with Workers Builds. `wrangler.jsonc` is its configuration.

- Each push to `main` runs `bun run build:app-document && bun run build:mcp`, then `npx wrangler deploy`.
- Each push to another branch runs the same build, then `npx wrangler preview`. That makes a Worker Preview at `https://<branch>-chat.deco-cx.workers.dev`. The Preview uses the `previews` block of `wrangler.jsonc`: its own D1 (`chat-preview`), KV and R2 (`chat-preview-files`), its own Durable Object storage and its own `SESSION_SECRET`. It never touches production data. Preview URLs are public.
- To make a Preview from a computer: `npx wrangler preview --name <name>`. To delete it: `npx wrangler preview delete --name <name>`.

## The call recorder

The recorder (`recorder/`) is a Worker of its own with a container. Workers Builds does not deploy it.

1. Make sure that Docker runs on your computer.
2. Run `cd recorder && bun install && npx wrangler deploy`.
3. The first time, set its secrets: `npx wrangler secret put RECORDER_SECRET` and `npx wrangler secret put GRAIN_API_TOKEN`.
4. In the `chat` Worker, set `RECORDER_URL` (the recorder's address), `RECORDER_SECRET` (the same value) and `CALL_RECORD_ROOMS` (room ids with commas, or `*`).

Without these secrets in `chat`, no call is recorded.

## Roll back

- Worker code: revert the commit on `main`. Workers Builds deploys the revert.

## Release the CLI

1. Increase the version in `cli/package.json` and `VERSION` in `cli/vibebook.ts`.
2. Run `bun run build:cli`. Commit.
3. Push the tag `cli-v<version>`.
4. `.github/workflows/publish-cli.yml` publishes to npm (Trusted Publishing, no token).
5. Run `npm view vibebook.dev version`. Say that the release is out only when it shows the new version.
