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
| `web/` | The browser app. `index.html` is the one shell (the app and the sign-in pages). It loads `main.ts`. |
| `web/app/` | Code that all features use: the room store and connection, the transport, the panel and sidebar types. |
| `web/features/` | One folder for each feature of the app (chat, documents, apps, agents, home, …). |
| `web/lib/studio/` | Design-system components, ported from deco Studio. |
| `web/lib/components/`, `web/lib/ui/` | Shared app components. |
| `web/lib/client/` | The typed API client (`hc<AppType>`). |
| `web/build/` | Vite plugins: client boundary, chunk diagnostics, development proxy. |
| `web/styles/` | `tailwind.css`, the only authored stylesheet of the app. |
| `web/dev/` | Development pages: the component gallery (`gallery.html`, not in `dist/`; `bun run build:gallery` builds it into `dist-gallery/` for the browser tests) and the design-system stories (`design-system.html`). |
| `web/app-document/` | The host for app documents. |
| `web/service-worker/` | Web push code. Builds to `dist/sw.js`. |
| `mcp-app/` | The admin MCP app UI. Builds to `dist-mcp/`. |

## Public files

| Folder | Contents |
|---|---|
| `public/` | Static files. The build copies them into `dist/`, which the Worker serves. |
| `public/pt/`, `public/en/` | Public pages in each language. Some are generated (see [workflow.md](workflow.md)). |
| `public/fonts/`, `public/vendor/`, `public/licenses/` | Third-party files and their licenses. |
| `public/llms.txt` | Setup instructions for any agent. Keep it the same as the tools and the plugin. |

## Tools and clients

| Folder | Contents |
|---|---|
| `cli/` | The `vibebook` CLI (`vibebook.ts`) and its npm package. |
| `claude-plugin/` | The Claude Code plugin: hooks, the `vibebook` skill, the `/vibebook:setup` and `/vibebook:listen` commands. |
| `herdr-plugin/` | The herdr plugin. It opens one Claude Code for each room. |
| `.claude-plugin/` | The plugin marketplace file. |
| `og/` | HTML that makes `public/og.png`, the icons and `public/email-logo.png`. |

## Documents

| Folder | Contents |
|---|---|
| `docs/` | Architecture, stack, workflow, writing rules, this map, `agents_deliberate_decisions.md` (the log of agent decisions for human review), and `machine-hub.md` (a proposal for machines and the hub). |

## Scripts and tests

| Folder | Contents |
|---|---|
| `scripts/` | Checks, tests, benchmarks and generators. `*.test.ts` = `bun test`. `*-check.ts` = a check against local development. `*-browser.ts` = a Playwright test. |
| `scripts/data/` | Data files that checks and browser tests read: font digests (`font-assets.json`), Studio design tokens and reference (`studio-*.json`)). |
| `scripts/fixtures/` | Test data. |
| `.github/` | CI workflows and the shared setup action. |

## Root files

| File | Contents |
|---|---|
| `AGENTS.md` | Global rules for agents. |
| `README.md` | The project for humans, and the security model. |
| `wrangler.jsonc` | Worker configuration: bindings, variables, routes. |
| `.vibebook` | The link to the project room. |
