# Architecture

## Summary

deco.chat is a chat app, similar to Discord. It runs on Cloudflare Workers. People chat in rooms. Each person can connect an agent (their own Claude). The agents work with the people on tasks in the room.

A room has these parts:

- Chat threads. The main thread is `main`. Each epic has its own thread. Each new thread starts from a message in `main` (`epics.from_msg`), as in Discord, so threads do not nest (`Book.threadOrigin`):
  - From a message in `main` ("Criar thread" on the message): that message is the origin. One click makes the thread and opens it (Gimenes #4310). The title is the first line of the message (`threadTitle`). For 5 seconds, while the thread is empty, the thread shows "Thread criada · Desfazer", which sends `epic.del`.
  - From a message in another thread: the server writes a line in `main` that replies to that message ("Nova thread a partir desta mensagem de …"). The quote of the reply links the source. That line is the origin. `Book.epicsFrom` finds the thread of a request through that line.
  - The app has no "Nova thread" in the sidebar (Gimenes #4286). A person starts a thread only with "Criar thread" on a message. The server still accepts an `epic` command without `from`: then it writes the title in `main` as a message of the person, and that message is the origin.
  - From an agent (`start_thread`): the same rules. A line that the server writes for an agent is an agent message.
  - The client can pick the ID of the new thread (8 hex characters). Then it opens the thread, and a retry with the same ID makes nothing.
  - Older threads that started inside another thread stay as they are.
- Epics with tasks. There is no task board: the tasks show in their epic. Each epic has one status: A fazer, Fazendo, Requer ação (stored as `review`) or Feito. There is no archive. Feito is the column `epics.done = 1` and the Done tab (-1 = a person opened it again). A person or an agent sets it (`epic.status`, `update_thread` `status`). Only a person makes it Feito: tasks and production do not. `epicStatus` (`shared/epicStatus.ts`) reads it. When an agent acknowledges a message in an epic with `doing`, an epic that is A fazer changes to Fazendo (`Book.agentAck`). The thread list shows no other mark for an agent at work.
- Documents. The room has one document, and each epic has one document.
- Files, decisions, reminders, pins and polls.
- AI-native formats: native cards, HTML embeds, room apps and MCP apps.

## Runtime parts

| Part | Code | What it does |
|---|---|---|
| Worker | `src/index.ts` (Hono) | Serves pages, the API, OAuth and `/mcp`. Sends WebSockets to the correct Durable Object. |
| `Book` Durable Object | `src/book.ts` | One for each room. Keeps the room data in SQLite. Sends real-time events. Runs the room alarm. |
| `DocRoom` Durable Object | `src/docroom.ts` | One for each document. Keeps the live Yjs text for co-editing. Copies the text back to the `Book`. |
| `Person` Durable Object | `src/person.ts` | One for each person. Holds the app WebSocket of that person. Tells open tabs to fetch again. Sends DM presence. |

## Storage

| Store | Contents |
|---|---|
| SQLite in the `Book` Durable Object | All data of one room: messages, epics, tasks, documents, file index, acknowledgements, decisions, reminders, pins, polls. |
| D1 (`DB`) | Data that is shared between rooms: users, rooms, members, friends, agents and their read cursors, waits, events (analytics). |
| R2 (`FILES`) | Files, avatars and room icons. |
| KV (`OAUTH_KV`) | OAuth grants and tokens, stored only as hashes. The Studio client id of each origin. |

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
- A DM, a mention or an ask from an agent in a room that you do not have open sends `{ t: "alert", book }` to your `Person` (`Book.notify`, with the web push). The open app plays the chime.
- Every send to room sockets goes through `Book.sendTo`. It sends a JSON-RPC notification and counts bytes for each event type.
- `Book.webSocketMessage` answers each JSON-RPC request with exactly one response. It does not answer a notification.
- DM presence (the dots in the DM list) goes from `Person` to `Person`. The browser sends no request for it. The rules are in `src/presence.ts`.
  - A person is online when their `Person` has one or more open `/ws-me` sockets (the `app` tag).
  - The first socket sends `online` to the `Person` of each DM contact (`POST /presence`). Contacts are the people of the DMs that have a message (`dmContacts`, one D1 read).
  - After the last socket closes, an alarm waits 30 seconds (`PRESENCE_GRACE`). Then it sends `offline`. A new socket in that time cancels it.
  - While the person is online, the alarm sends `online` again every 30 minutes. A stored `online` older than 75 minutes is offline.
  - The receiving `Person` keeps each contact's state (`p:<email>`). It sends `{ t: "presence", people }` to its open app sockets. A new socket first gets the full list (`all: 1`).
  - Only people who share a DM with you get your presence.

### One send, one message

A send can become "not confirmed" (a timeout, a dropped socket, a server error) after the `Book` stored it. A second send of it must not make a second message.

- Each send of a person or an agent has a `client_id`: a random ID (`crypto.randomUUID()`), not a hash of the text. Two sends of "ok" are two messages. The client makes the ID one time for each send, and uses the same ID on each retry of that send.
  - The WebSocket `msg` command, `POST /api/books/:id/post` and the MCP `post` tool accept `client_id` (`CLIENT_ID_PATTERN` in `shared/commands.ts`: 8 to 64 characters of `A-Z a-z 0-9 _ -`).
  - The composer (`web/features/composer/drafts.ts`) keeps the ID of an unconfirmed send that the person keeps. If the person sends that draft again without a change, the ID is the same. A changed draft gets a new ID.
  - The inbox reply, the Home send and the `vibebook_post` app tool keep the ID of a failed send until the same send succeeds (`web/lib/client/sendIds.ts`). A card answer cannot be sent again while it is unconfirmed.
  - The CLI does not make an ID. It sends the `client_id` that the agent gives.
- The `Book` keeps the ID in `messages.client_id`, with a unique index on `(author, client_id)`. The column is permanent, thus a retry matches at any time. An agent ID is kept as `<agent>:<client_id>`, thus two agents of one person do not share IDs.
- `Book.byClientId` finds the earlier message before the insert. Only the text decides, because the room can change the thread, the reply, the files and the choices after the insert (`move_message`, `closeAsk`):
  - The same ID and the same text: the server returns that message. It does not insert, broadcast or run the side effects again (answer intent, reopen, `track`, stats, alarm, the agent read cursor). Over the WebSocket, only the tab that sent it gets the message again.
  - The same ID and a different text: the server refuses the send (`idempotency conflict`). The composer shows it as a failure and keeps the draft.
  - An ID with a bad format: the WebSocket and HTTP schemas refuse the command (`invalid command`, `invalid message payload`). The MCP `post` tool answers `invalid client_id: …`.
  - An MCP `post` with `html` asks `Book.agentRepeat` first. A retry does not check or store the HTML again.
- A send without a `client_id` (an old client) gets a narrow fallback (`Book.recentRepeat`). The server looks at the newest 50 messages of the thread. If the same author, kind and model (`via`) sent the same text and reply in the last 10 seconds, with no files, poll, card, choices or tag, the server returns that message. A `done` post, a card and choices never use the fallback. Each send without an ID sends the `message_no_client_id` event. Thus, we can see when the old clients are gone.
- The posts that the server makes (reminders, @vibe, notices, the first message of a DM) do not use these checks.
- Polls (`poll.create`) do not have a `client_id`.
- The `msg` event and the room history carry `client_id` when the message has one. The composer settles its send by that ID first, and by its content only for a message without an ID.

### Edit and delete

- The author edits a message (`msg.edit`, agent tool `edit_message`). The author or the room owner deletes it (`msg.delete`, `delete_message`). An agent changes only the messages that it posted.
- The `msgEdit` event carries only the new text (or the delete). The old text, files and card go to `message_edits`. Only the room owner gets them, with `msg.history` and the `history` event to that tab.
- An edit goes through the secret filter like a send. A deleted message keeps its row and its place, with no text, files or card.

## Agents

- An agent is the Claude of one person. It acts for that person only.
- The main path is the `vibebook` CLI (`cli/vibebook.ts`). It sends JSON-RPC to `/mcp` with an OAuth token. MCP clients without a shell use `/mcp` directly.
- The agent tools are in `src/agent.ts`. Each tool call checks room membership again.
- The rules that tell an agent how to behave in a room are in `shared/agentRules.ts`. The MCP instructions, `read_room.how_to_answer`, the plugin skill and commands, and `public/llms.txt` use them. Change a rule there, then run `bun scripts/agent-prompts.ts`.
- Only messages that the person wrote are instructions to their agent (`from_your_human`). The server sets the author. Message text cannot change it.
- `vibebook listen` waits through a local hub process. The hub holds one WebSocket to the `Person` Durable Object.
- `@vibe` is the room housekeeper. It grades epics and finds who waits on whom (Jev model, `src/jev.ts`). It does not answer chat messages.

## Browser apps

- The browser app is Svelte 5, in `web/`. It has one shell, `web/index.html`. The app (at `/`) and the sign-in, consent, access and connection pages use it. For these pages, `src/auth-page.ts` adds a `vb-page` meta tag and `robots: noindex`, and `web/main.ts` then shows the page. The auth layout (`web/features/auth/AuthFrame.svelte`) sets its own full-height background.
- A person who is not signed in gets `/login`. There is no landing page.
- deco Studio is the only sign-in. `/login` sends the person directly to Studio (`/auth/studio/start`). The login page shows only after a failed sign-in (`?error=`) or after a sign-out (`?out=1`). This stops a redirect loop.
- The browser and the server communicate only through typed RPC. The rules are in [stack.md](stack.md).
- Wire contracts are in `shared/` (zod schemas). The API routes in `src/api.ts` use these schemas. The browser gets only the types (`hc<AppType>`).
- The browser build must not import backend code. `web/build/clientBoundary.ts` stops the build if it does.

## AI-native formats

| Format | Code | Rule |
|---|---|---|
| Native card | `src/card.ts` | A JSON spec. The app draws it. No HTML. |
| HTML embed and room app | `src/embed.ts`, `apps/<name>.html` files | Runs in a sandboxed iframe with an opaque origin and `connect-src 'none'`. A Jev check runs before it is stored. |
| MCP connection and MCP app | `src/mcpconn.ts`, `src/mcpauth.ts` | The browser calls the MCP server. Each person signs in with their own account. |
| Files | `src/rooms.ts` (`storeFile`), `src/fileHeaders.ts` | Members only. HTML is sandboxed. SVG is not permitted. |

## Security

- The session cookie is HttpOnly, Secure, SameSite=Lax and signed with HMAC.
- Sign-in is with deco Studio (`src/auth.ts`, `/auth/studio/*`): OAuth 2.1 with PKCE. Each origin (production, a branch preview, local dev) registers itself at Studio as a public client and keeps the client id in `OAUTH_KV` (`studio-client:<origin>`). The Worker checks the `id_token` of the token response (`aud` must be its client id), then asks Studio's userinfo with the access token. If userinfo answers 404 (an older Studio), the Worker uses the `id_token` claims. It accepts the email only if Studio marks it as verified. The Studio picture (Google or GitHub hosts only) becomes the avatar if the person has not uploaded one (`src/studioAvatar.ts`). Invite links still sign in a new person one time.
- The Worker refuses a cross-site request that changes state.
- The secret filter (`src/secrets.ts`) refuses messages, files and embeds that contain a secret.
- Rate limits: `AI_LIMIT`, `LOGIN_LIMIT`, `UPLOAD_LIMIT`, `AGENT_LIMIT` (`wrangler.jsonc`).
- If you change auth, tools or storage, make `README.md` (Security model) and `public/llms.txt` agree with the change.

## AI models

The models are Worker variables in `wrangler.jsonc`: `MODEL_ROUTE`, `MODEL_CLASSIFY`, `MODEL_FAST`, `MODEL_JUDGE`. The calls go through OpenRouter. Speech-to-text uses Workers AI. Each model call records its cost in an event. Ask a human before you change a model.

### Router actions

The server can act on a message of a person without waking a Claude (`src/routerActions.ts`). Each action has the same parts:

- `when`: synchronous checks. They do not call a model.
- `ready`: optional asynchronous checks, for example a D1 query.
- `exact`: a fixed phrase. It acts without a model.
- `question` and `threshold`: one Jev question. The action runs when the probability is at the threshold or more.
- `run`: the action.

`Book.personWrote` runs the actions on each message of a person. All the actions that apply share one Jev call. If Jev is not available, no action runs. The actions are:

- `answer_thread`: a question in main becomes an answer thread (0.8). It runs only when the author has a Claude that listens to the room. It has two vetoes: "asks to build, change or fix something" and "said to a person, or a greeting or an OK". A veto at 0.5 or more stops the action.
- `mark_done`: the exact phrase "Mark as done" or "Marcar como concluída", or a short message (60 characters or less) that says the thread is finished (0.8). A Jev decision posts a line in the thread. Any message from a person opens the thread again.

To add an action, add an entry to `ROUTER_ACTIONS` and a test to `scripts/router-actions.test.ts`.

The threshold of each action is 0.8 or more (`ACTION_THRESHOLD_MIN`). Do not lower it. If an action misses cases, improve its question. A test fails if an action has a lower threshold.

An action can also have vetoes (`vetoes`): short questions in the same call. A veto at 0.5 or more (`VETO`) stops the action. Write the main question as a short positive definition, and put each "no" case in a veto. A long list of "answer no for…" in one question lowers the score of the true cases.

A reading (`ROUTER_READINGS`) also goes into the same Jev call. It does not select one action. The room keeps its answers. The readings are:

- `waits`: who the message asks for something ("esperando você"). Each other person in the room is one question (0.7). If the author @mentions people, only those people wait. The room stores the waits in D1 `waits` and sends a push.

`Book.findWaits` (on the alarm) reads the messages of agents. It also reads a message of a person that the router pass did not read (Jev not available, or the exact phrase), 2 minutes after the message.
