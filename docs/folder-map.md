# Folder map

If you add, move or delete a top-level folder, update this file in the same commit.

## Server

| Folder | Contents |
|---|---|
| `src/` | The Worker and its Durable Objects. `index.ts` (routes, D1 schema), `book.ts` (room), `docroom.ts` (document), `person.ts` (person), `agent.ts` (agent tools at `/mcp`), `api.ts` (typed API routes), `auth.ts` and `connect.ts` (sign-in and OAuth). One file for each other subsystem, named after it. |
| `shared/` | Code that the server and the browser both use: zod schemas, wire types, commands, events. No backend imports. |
| `packages/server-only/` | The `server-only` marker. The browser build stops if a module imports it. |

## Browser

| Folder | Contents |
|---|---|
| `svelte/` | The Svelte app (the default). |
| `svelte/features/` | One folder for each feature of the app (chat, documents, apps, agents, home, …). |
| `svelte/lib/studio/` | Design-system components, ported from deco Studio. |
| `svelte/lib/components/`, `svelte/lib/ui/` | Shared app components. |
| `svelte/lib/client/` | The typed API client (`hc<AppType>`). |
| `svelte/build/` | Vite plugins: client boundary, UI version, development proxy. |
| `svelte/styles/` | `tailwind.css`, the only authored stylesheet of the Svelte app. |
| `svelte/gallery/`, `svelte/parity/` | Component gallery and parity stories for development. |
| `vanilla/inbox/` | Source of the Inbox of the vanilla app. Frozen. |
| `collab/` | The document editor (CodeMirror and Yjs). Builds to `public/collab.js`. |
| `browser/app-document/` | The host for app documents. |
| `service-worker/` | Web push code. Builds to `public/sw.js`. |
| `mcp-app/` | The admin MCP app UI. Builds to `dist-mcp/`. |

## Public files

| Folder | Contents |
|---|---|
| `public/` | Static files that the Worker serves. |
| `public/app.html` | The vanilla app. Frozen. |
| `public/app-svelte.html`, `public/svelte-preview/` | The built Svelte app. Generated. |
| `public/pt/`, `public/en/` | Public pages in each language. Some are generated (see [workflow.md](workflow.md)). |
| `public/changelog/` | Changelog screenshots. |
| `public/fonts/`, `public/vendor/`, `public/licenses/` | Third-party files and their licenses. |
| `public/llms.txt` | Setup instructions for any agent. Keep it the same as the tools and the plugin. |

## Tools and clients

| Folder | Contents |
|---|---|
| `cli/` | The `vibebook` CLI (`vibebook.ts`) and its npm package. |
| `claude-plugin/` | The Claude Code plugin: hooks, the `vibebook` skill, the `/vibebook:setup` and `/vibebook:listen` commands. |
| `herdr-plugin/` | The herdr plugin. It opens one Claude Code for each room. |
| `.claude-plugin/` | The plugin marketplace file. |
| `site/` | The landing site Worker (TanStack Start and deco blocks). It has its own `package.json`. |
| `og/` | HTML that makes `public/og.png` and the icons. |

## Documents

| Folder | Contents |
|---|---|
| `docs/` | Architecture, stack, workflow, writing rules, this map, and `agents_deliberate_decisions.md` (the log of agent decisions for human review). |

## Scripts and tests

| Folder | Contents |
|---|---|
| `scripts/` | Checks, tests, benchmarks and generators. `*.test.ts` = `bun test`. `*-check.ts` = a check against local development. `*-browser.ts` = a Playwright test. |
| `scripts/data/` | Data files that checks and browser tests read: font digests (`font-assets.json`), Studio design tokens and reference (`studio-*.json`), the vanilla build list (`vanilla-build.json`). |
| `scripts/fixtures/` | Test data. |
| `.github/` | CI workflows and the shared setup action. |

## Root files

| File | Contents |
|---|---|
| `AGENTS.md` | Global rules for agents. |
| `README.md` | The project for humans, and the security model. |
| `wrangler.jsonc` | Worker configuration: bindings, variables, routes. |
| `.vibebook` | The link to the project room. |
