# Architecture

## Summary

vibebook is a chat app, similar to Discord. It runs on Cloudflare Workers. People chat in rooms. Each person can connect an agent (their own Claude). The agents work with the people on tasks in the room.

A room has these parts:

- Chat threads. The main thread is `main`. Each epic has its own thread.
- Epics with tasks (a kanban board).
- Documents. The room has one document, and each epic has one document.
- Files, decisions, reminders, pins and polls.
- AI-native formats: native cards, HTML embeds, room apps and MCP apps.

## Runtime parts

| Part | Code | What it does |
|---|---|---|
| Worker | `src/index.ts` (Hono) | Serves pages, the API, OAuth and `/mcp`. Sends WebSockets to the correct Durable Object. |
| `Book` Durable Object | `src/book.ts` | One for each room. Keeps the room data in SQLite. Sends real-time events. Runs the room alarm. |
| `DocRoom` Durable Object | `src/docroom.ts` | One for each document. Keeps the live Yjs text for co-editing. Copies the text back to the `Book`. |
| `Person` Durable Object | `src/person.ts` | One for each person. Holds the app WebSocket of that person. Tells open tabs to fetch again. |
| Site Worker | `site/` | The public landing pages (deco blocks). The main Worker forwards `/pt`, `/en`, `/_site`, `/deco` and `/_serverFn` to it. |

## Storage

| Store | Contents |
|---|---|
| SQLite in the `Book` Durable Object | All data of one room: messages, epics, tasks, documents, file index, acknowledgements, decisions, reminders, pins, polls. |
| D1 (`DB`) | Data that is shared between rooms: users, rooms, members, friends, agents and their read cursors, waits, events (analytics). |
| R2 (`FILES`) | Files, avatars and room icons. |
| KV (`OAUTH_KV`) | OAuth grants and tokens, stored only as hashes. |

Rules:

- Keep one room in one `Book`. Do not put the data of two rooms in one `Book`.
- Put a new room field in the `Book` SQLite. Use D1 only when a query must read many rooms.
- Change schemas only by addition. The Worker makes D1 tables with `ensureSchema` (`CREATE TABLE IF NOT EXISTS` and the `ALTERS` list in `src/index.ts`). The `Book` makes its own tables in `src/book.ts`. Do not drop or rename a column.
- Keep assets in R2. Do not keep file bytes in SQLite or D1.

## Real-time messages

- The browser opens one WebSocket to the room (`/ws/:id` → `Book`) and one to the person (`/ws-me` → `Person`).
- The Durable Objects use WebSocket hibernation. An idle socket costs nothing.
- The app does not poll. When a value changes, the server sends a "poke" to the `Person`. The open tabs then fetch again one time.
- Send only the data that changed. A large snapshot to each tab is a known problem.
- Every send to room sockets goes through `Book.sendTo`. It counts bytes for each event type.

## Agents

- An agent is the Claude of one person. It acts for that person only.
- The main path is the `vibebook` CLI (`cli/vibebook.ts`). It sends JSON-RPC to `/mcp` with an OAuth token. MCP clients without a shell use `/mcp` directly.
- The agent tools are in `src/agent.ts`. Each tool call checks room membership again.
- Only messages that the person wrote are instructions to their agent (`from_your_human`). The server sets the author. Message text cannot change it.
- `vibebook listen` waits through a local hub process. The hub holds one WebSocket to the `Person` Durable Object.
- `@vibe` is the room housekeeper. It grades epics and finds who waits on whom (Jev model, `src/jev.ts`). It does not answer chat messages.

## Browser apps

- Svelte 5 is the default app (`svelte/`). The vanilla app (`public/app.html`) is the frozen fallback.
- `src/ui-select.ts` selects the app for each page. Order: the URL `?ui=`, then the cookie `vb_ui`, then the Worker variable `UI_DEFAULT`.
- To send all people back to vanilla, set `UI_DEFAULT=vanilla`. No deploy of code is necessary.
- The browser and the server communicate only through typed RPC. The rules are in [stack.md](stack.md).
- Wire contracts are in `shared/` (zod schemas). The API routes in `src/api.ts` use these schemas. The browser gets only the types (`hc<AppType>`).
- The browser build must not import backend code. `svelte/build/clientBoundary.ts` stops the build if it does.

## AI-native formats

| Format | Code | Rule |
|---|---|---|
| Native card | `src/card.ts` | A JSON spec. The app draws it. No HTML. |
| HTML embed and room app | `src/embed.ts`, `apps/<name>.html` files | Runs in a sandboxed iframe with an opaque origin and `connect-src 'none'`. A Jev check runs before it is stored. |
| MCP connection and MCP app | `src/mcpconn.ts`, `src/mcpauth.ts` | The browser calls the MCP server. Each person signs in with their own account. |
| Files | `src/rooms.ts` (`storeFile`), `src/fileHeaders.ts` | Members only. HTML is sandboxed. SVG is not permitted. |

## Security

- The session cookie is HttpOnly, Secure, SameSite=Lax and signed with HMAC.
- The Worker refuses a cross-site request that changes state.
- The secret filter (`src/secrets.ts`) refuses messages, files and embeds that contain a secret.
- Rate limits: `AI_LIMIT`, `LOGIN_LIMIT`, `UPLOAD_LIMIT`, `AGENT_LIMIT` (`wrangler.jsonc`).
- If you change auth, tools or storage, make `README.md` (Security model) and `/how-it-works` agree with the change.

## AI models

The models are Worker variables in `wrangler.jsonc`: `MODEL_ROUTE`, `MODEL_CLASSIFY`, `MODEL_FAST`, `MODEL_JUDGE`. The calls go through OpenRouter. Speech-to-text uses Workers AI. Each model call records its cost in an event. Ask a human before you change a model.
