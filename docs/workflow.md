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
- `bun run dev` runs with `--local`: the `AI` binding (Workers AI) is always remote, and a remote binding needs a valid `wrangler login` or `CLOUDFLARE_API_TOKEN`. Without them the dev server did not start, so nobody could test a change locally. Locally, dictation (Whisper) does not work. Everything else does.

## Screens

Each change that a person can see gets screens from local development before its pull request merges (Gui, #4723).

1. Set `DEV_EMAIL` to a test email (for example `ana@example.test`) in `.dev.vars`, and `SESSION_SECRET` to any random string.
2. Run `bun run dev`. Wait until http://127.0.0.1:8797/api/me answers with the test email.
3. Run `bun run screens -- --hover`. It makes a new room "Sala de teste" with three test messages and saves the room at 1440 px (still and with the mouse over a message), the room at 390 px and the home at 390 px in `.screens/<branch>/`.
   - If your change needs another state (a thread, a reaction, a dialog), add the steps to `scripts/screens.ts` in the same pull request.
   - `--react` adds a reaction. `--link` opens a copied link to an old message in a new tab. `--dm` opens "Nova mensagem" with a colleague (an account on the test email's domain). `--resume` makes six threads (one pinned) and a second room, then at 1440 px and 390 px (with a video of each) leaves a thread and comes back, opens threads and checks that the sidebar keeps its order (newest made first), follows a link to a thread and to a message, and clicks the open room. Each screen is checked: the run fails if the app shows something else. `--marks` uses the Markdown shortcuts of the composer and shows the marks in the messages. `--settings` opens Settings › Cloud agents at 1440 px and 390 px. It checks that the section is not drawn again when `/api/me` is read again, then takes each state of the Studio pickers (search, projects, loading, no projects, error). It stubs the page's own Studio routes with test organizations and projects, so it needs no Studio.
4. Look at each screen. If it does not show the change working, fix the change. Do not continue.
5. Run `bun run screens -- --hover --publish`. It pushes the screens to the branch `pr-screens` (no workflow runs there; the repository is public, so test data only) and prints the Markdown. Put it in the "Screens" section of the pull request.

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
- `release-tray` (`.github/workflows/release-tray.yml`) runs only on a tag `tray-v*` and by hand. It builds the menu bar app (see "Release the menu bar app").
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

1. Open a pull request. Fill in each section of `.github/pull_request_template.md`. A change that a person can see needs its screens in the pull request first (see "Screens").
2. Rebase the branch on the newest `main` (`git fetch origin && git rebase origin/main`). Push it.
3. Enable automerge: `gh pr merge <number> --auto --squash`. Do not enable it on a visible change without screens in the pull request.
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

## Test the call locally

Each change to the call (`web/features/call/`, `src/calls.ts`, `recorder/`) gets this test, and its screenshots go in the pull request.

1. In `.dev.vars`, set `REALTIME_SFU_APP_ID` and `REALTIME_SFU_APP_SECRET` (the SFU app; the media goes through it) and `DEV_EMAIL`.
2. Run `bun run build:ui`, then `bun run dev`.
3. Run `bun scripts/call-browser.ts`. Two people (fake microphone, camera and screen) join a call, share a screen and leave. The screenshots go to `/tmp/vibebook-call-browser` (`TEST_OUTPUT_DIR`).
4. Run `bun scripts/call-answer-browser.ts`. A DM's call is answered from another room, the call follows the person to another room and Home, and the stage's tiles are 16:9 with 2 and 4 people. The screenshots go to `/tmp/vibebook-call-answer`.

To test the recorder too:

1. In `.dev.vars`, also set `RECORDER_URL=http://127.0.0.1:8790`, `RECORDER_SECRET` (any long value) and `CALL_RECORD_ROOMS=*`. Restart `bun run dev`.
2. Build and start the recorder's container. Give it a Grain token only if the test may send a recording to Grain; else give it any value, and the upload fails after the transcript:

   ```
   cd recorder/container && docker build -t chat-recorder:local .
   docker run -d --name rec -p 8789:8080 -e RECORDER_SECRET=<same> -e GRAIN_API_TOKEN=<token or x> chat-recorder:local
   ```

3. The container opens the chat at `127.0.0.1:8797`, which is its own address in Docker. Forward that port to the computer:

   ```
   docker exec -d rec node -e "const n=require('net');n.createServer(c=>{const s=n.connect(8797,'host.docker.internal');c.pipe(s).pipe(c);c.on('error',()=>{});s.on('error',()=>{})}).listen(8797,'127.0.0.1')"
   ```

4. Run `RECORDER_SECRET=<same> CF_TOKEN=<token that can run Workers AI> bun scripts/call-recorder-local.ts`. It stands in for the recorder Worker.
5. Run `TEST_RECORDER=1 bun scripts/call-browser.ts`. For a DM, run `bun scripts/call-dm-consent-browser.ts`: the two people answer the recording question, and the screens go to `/tmp/vibebook-call-dm-consent`. Read the container's log with `docker logs rec`: it shows who it saw, the transcript lines and each step. With a fake Grain token, the last step fails at the upload, as expected.
6. Remove the container: `docker rm -f rec`.

## Test the camera's blur

Each change to the blur (`web/features/call/blur.ts`) gets this test. Put the screens of before and after in the pull request.

1. Do steps 1 and 2 of "Test the call locally".
2. Make a camera file from a photo of a person (public domain or your own, because the screens go to a public branch):

   ```
   ffmpeg -loop 1 -i person.jpg -vf "scale=-2:720,pad=1280:720:(ow-iw)/2:0,format=yuv420p" -t 3 -r 24 /tmp/person.y4m
   ```

3. Run `TEST_GPU=1 TEST_CAMERA=/tmp/person.y4m bun scripts/call-blur-test.ts`. It opens "Câmera e desfoque" in a call and saves the preview at each level in `/tmp/vibebook-call-blur` (`TEST_LABEL` names the files). It prints the frames a second with the strong blur (`strong_fps`). Without `TEST_GPU=1`, Chrome draws on the CPU and the number is much lower than a person sees.

## Test the call's audio

Each change to the microphone path of the call (`web/features/call/session.ts`, `denoise.ts`) gets this test. Put its numbers in the pull request.

1. Do steps 1 and 2 of "Test the call locally".
2. Run `TEST_DENOISE=0 TEST_LABEL=off bun scripts/call-audio-test.ts`, then `TEST_DENOISE=1 TEST_LABEL=on bun scripts/call-audio-test.ts`.
   - Ana speaks `scripts/fixtures/call-noise.wav` through a fake microphone: Portuguese speech with pauses (macOS `say`, voice Luciana), mixed with brown noise, a hammer, keys and a voice in the back. Bia records what arrives.
   - The audios, and a screen of Ana's "Mais opções" menu, go to `/tmp/vibebook-call-audio` (`TEST_OUTPUT_DIR`).
   - The script prints the noise floor (the quietest 10% of 100 ms windows), the speech level (the loudest 10%) and the gap, in dB. A better noise suppression gives a lower noise floor and a bigger gap. Listen to the audios too: the numbers do not show a voice that is cut.
3. To test with real noise, run `TEST_LIVE=1 TEST_SECONDS=30 bun scripts/call-audio-test.ts`. Open the two links that it prints in your browser, start the call and speak. The script records what Bia hears.

## The call recorder

The recorder (`recorder/`) is a Worker of its own, `chat-recorder`, with a container. Workers Builds does not deploy it.

- `.github/workflows/deploy-recorder.yml` deploys it when `recorder/` changes on `main`. It needs the `RECORDER_DEPLOY_TOKEN` repository secret: a Cloudflare API token that can edit Workers scripts and Containers. Without that secret the workflow does nothing.
- To deploy from a computer, start Docker. Then run `cd recorder && bun install && npx wrangler deploy`.
- Its secrets: `RECORDER_SECRET` and `GRAIN_API_TOKEN` (`npx wrangler secret put`, in `recorder/`).
- In the `chat` Worker: `RECORDER_URL` (the recorder's address), `RECORDER_SECRET` (the same value) and `CALL_RECORD_ROOMS` (room ids with commas, or `*`). Without them, no call is recorded.
- Deploy the recorder before the chat when the two change together. A recorder that is newer than the chat is safe.

## Roll back

- Worker code: revert the commit on `main`. Workers Builds deploys the revert.

## Release the CLI

1. Increase the version in `cli/package.json` and `VERSION` in `cli/vibebook.ts`.
2. Run `bun run build:cli`. Commit.
3. Push the tag `cli-v<version>`.
4. `.github/workflows/publish-cli.yml` publishes to npm (Trusted Publishing, no token).
5. Run `npm view vibebook.dev version`. Say that the release is out only when it shows the new version.

## Release the menu bar app

The menu bar app (`tray/`) has its own release. A merge into `main` does not release it.

1. Increase `version` in `tray/tauri.conf.json` and `tray/Cargo.toml`. Commit.
2. Push the tag `tray-v<version>`.
3. `.github/workflows/release-tray.yml` builds the app for macOS (arm64, x64), Windows (x64) and Linux (x64). It makes a GitHub Release with the name of the tag.
4. Look at the release. It must have the seven files in `tray/README.md` and `SHA256SUMS.txt`. `public/setup.sh` installs the newest `tray-v*` release.

To build without a release, run the workflow by hand (`workflow_dispatch`). The files are then in the artifacts of the run. The app ships the CLI of the commit that it builds, so a change to `cli/` gets to the app only with a new app release.
