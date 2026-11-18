# Workflow

## Set up

1. Install Bun 1.4.4. Make sure that `bun --version` shows 1.4.4.
2. Run `bun install --frozen-lockfile`.
3. Copy `.dev.vars.example` to `.dev.vars`. Set `OPENROUTER_API_KEY` and `SESSION_SECRET`.
4. To skip the sign-in in local development, set `DEV_EMAIL`. It works only on a loopback host.

## Develop

| Command | Result |
|---|---|
| `bun run dev` | Builds the browser files, then starts the Worker at http://127.0.0.1:8797. |
| `bun run dev:app` | Starts the Worker (8787) and Vite (5173) with hot reload. Open http://127.0.0.1:5173/app?ui=svelte. |
| `bun run dev:components` | Starts the component gallery with hot reload. |

Rules:

- Use `127.0.0.1`, not `localhost`. OAuth needs a loopback IP address.
- To change the local identity, open `/api/dev/as?email=<email>`.
- Local emails go to `.wrangler/tmp/email/`.
- Use test data only. Do not use real rooms, names or emails in tests or screenshots.

## Check

1. Run `bun run check`. It runs types, the i18n check, unit and DOM tests, boundary checks and the format check.
2. If you changed the browser, run the browser tests for that area (`test:*:browser` scripts in `package.json`). They need Playwright Chromium (`bunx playwright install chromium`).
3. If you changed the agent tools, run `bun scripts/agent-check.ts` against local development.
4. If you changed the router rules or questions, run `bun scripts/router-bench.ts`.

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
- If CI on `main` fails, `.github/workflows/main-red.yml` opens an issue with the label `main-red` and mentions the commit author. When CI on `main` passes, it closes the issue.

## Generated files to commit

Some build output is in git. If you change the source, build it and commit the output in the same commit.

| Source | Command | Output to commit |
|---|---|---|
| `svelte/`, `shared/`, `service-worker/` | `bun run build:ui` | `public/app-svelte.html`, all of `public/svelte-preview/`, `public/sw.js` |
| `collab/` | `bun run build:collab` | `public/collab.js` |
| `cli/` | `bun run build:cli` | `public/cli.mjs`, `cli/cli.mjs` |
| `vanilla/inbox/` | `bun run build:vanilla-ui` | `public/svelte/ui.js` |
| `scripts/changelog.json` | `bun scripts/changelog.ts` | `public/{pt,en}/changelog.html` |
| `scripts/docs.ts` | `bun scripts/docs.ts` | `public/{pt,en}/docs.html` |
| `scripts/personas.ts` | `bun scripts/personas.ts` | `public/{pt,en}.html`, persona pages |

Do not commit `dist-mcp/` or `.api-types/`. The build makes them.

## Text and languages

- Put each new UI string through `t("texto em pt")` and add its English text. `bun scripts/i18n-check.ts` fails if a key is missing.
- Write each public page in Portuguese and English.

## Changelog and public docs

If a person can see the change:

1. Add a line to `scripts/changelog.json`. Use the top release if it has the same date. Else, start a new release.
2. For a feature, write 1 to 3 sentences. Add a screenshot from a test room (`cwebp -q 80 -resize 1400 0`, into `public/changelog/`).
3. Update the chapter in `scripts/docs.ts`.
4. Run the two generators and commit the output.

Do not add chores, refactors or tests to the changelog.

## Release (deploy)

Each merge into `main` is a release. Workers Builds deploys the `vibebook` Worker (build command `bun run build:mcp`, deploy command `npx wrangler deploy`).

**Warning: Never leave `main` red. A red `main` is a failed check on the newest commit of `main`.**

1. Open a pull request. Fill in each section of `.github/pull_request_template.md`.
2. Rebase the branch on the newest `main` (`git fetch origin && git rebase origin/main`). Push it.
3. Enable automerge: `gh pr merge <number> --auto --squash`.
4. Wait for the merge. If `verify` fails, fix the branch and push again.
5. After the merge, watch the checks of the merged commit on `main` (`gh run list --branch main --commit <sha>`, `gh run watch <id>`). This includes the browser jobs.
6. If a check on `main` fails, open a new pull request with the fix at once. Use the same procedure. Do not start other work before `main` is green. The open `main-red` issue shows the failed jobs. It closes when `main` is green.
7. Look at the Workers Builds deploy in the Deployments tab of the Worker.
8. Check the change in production.
9. Report the release in the project room.

`bun run deploy` from a computer is for hotfixes only. Ask a human first.

## Roll back

- Browser app for all people: set the Worker variable `UI_DEFAULT=vanilla`.
- Browser app for one device: the "Nova UI" switch, or `/ui/vanilla`.
- Worker code: revert the commit on `main`. Workers Builds deploys the revert.

## Release the CLI

1. Increase the version in `cli/package.json` and `VERSION` in `cli/vibebook.ts`.
2. Run `bun run build:cli`. Commit.
3. Push the tag `cli-v<version>`.
4. `.github/workflows/publish-cli.yml` publishes to npm (Trusted Publishing, no token).
5. Run `npm view vibebook.dev version`. Say that the release is out only when it shows the new version.
