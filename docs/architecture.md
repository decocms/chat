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

### Read a page of messages

- `GET /api/books/:id/messages?thread=&before=&after=&limit=` gives one page of a thread (`Book.messagesPage`), with the acks of that page. Only members get it. It has no state: the answer is the truth at that time.
- The cursor is the message ID, because IDs only increase. `before` scrolls back. `after` gets the messages that came after that ID. With neither, you get the newest. `limit` is 1 to 100 (default 50).
- The app gets scroll-back through this route (`web/features/root-room/api.ts`). If the request fails, the app sends the WebSocket `older` command, which gives the same page.

### A reconnect resumes

- A socket that already has the room (a reconnect, or a cached room that opens again) sends `since` (its newest message id), `at` (the time of its last `state`) and `eh` (the hash of the threads that it got). The Book keeps nothing for each client (`Book.resumeOf`). The worker passes the three values on to the Book (`src/bookSocket.ts`).
- The Book then sends a `state` with `resume: true`. It has the open thread's window and each message that is newer than `since`, or edited or deleted since `at`. When the threads have the same hash, it leaves them out (`epicsSame`). The app merges the messages and acks into the room that it has (`web/app/roomStore.ts`).
- The Book sends the whole state when there are no params, the state is older than 6 hours, or more than 200 rows changed.

### Rooms saved in the browser

- The app saves each room that you open in IndexedDB (`web/features/room-cache/store.ts`): the newest 400 messages and the rest of the room, without typing and edit history. It writes one time for each quiet second, and only on durable events.
- A room that is not in memory (after a reload, or a 13th room) draws from IndexedDB first. Then its socket resumes from it (see "A reconnect resumes"). The read waits at most 300 ms. Then the socket starts anyway.
- A saved room draws only for the account that saved it, when that account is known (`/api/me`, or a `state`). DMs are saved too. A saved room is deleted after 7 days, when you leave or are removed from the room, and when `/api/me` does not list it. A sign-out, a refused session or another account deletes all saved rooms.
- If the browser blocks IndexedDB (a private window), rooms stay in memory only.
- Memory keeps only the open room. Another room that you open again comes from IndexedDB. Without IndexedDB, memory keeps the 12 newest rooms.

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
| MCP connection and MCP app | `src/mcpconn.ts`, `src/mcpauth.ts`, `web/features/apps/bridge.ts` | The browser calls the MCP server. Each person signs in with their own account. A `ui/message` is a post, and the person confirms it first. If each text block has `_meta["vibebook/compose"]`, the text goes in the composer of the thread and the person sends it. A block with `_meta["vibebook/reference"]` (`{ label }`) is a chip above the field; its text goes before the typed text. |
| Files | `src/rooms.ts` (`storeFile`), `src/fileHeaders.ts` | Members only. HTML is sandboxed. SVG is not permitted. |

## Calls (voice, camera and screen)

- A room has one call. The room is the channel: there is no table of channels.
- The media goes through the Cloudflare Realtime SFU. Each browser in the call has one `RTCPeerConnection` to it (`web/features/call/session.ts`). It publishes the track `mic`, `cam` while the camera is on, and `screen` while the person shares a screen. It receives the tracks that the other people publish.
- The browser does not call the SFU's API, because that API needs the app secret. The Worker passes the WebRTC negotiation on (`src/calls.ts`, routes `/api/books/:id/call/*`). Before each request, `Book.callCheck` makes sure that the session is that person's, and that each session to receive from is in the same room's call.
- `Book` keeps who is in the call, the tracks of each person and whose microphone is off (`meta` key `call`). Each change sends `{ t: "call" }` to the room. One person has one session: a second join replaces the first.
- The call lives on the room's WebSocket. When the last socket of a person closes, `Book` removes that person from the call. A person who leaves the room's view leaves the call.
- A person who opens a room with a call on joins that call, with the microphone off. A person who leaves the call stays out until the call ends.
- Calls are off until `REALTIME_SFU_APP_ID` and `REALTIME_SFU_APP_SECRET` exist (Worker secrets). Then the room state has `call`, and the app shows the call.
- A call is recorded only in the rooms of `CALL_RECORD_ROOMS`, and only while the recorder is in it (see "The recorder").
- A DM's call is recorded only after both people accept (`Book.callConsent`, meta `call_consent`, command `call.consent`). The stage asks each person ("Gravar esta call no Grain?"). One "Não gravar" stops the recording for that call. Each new call asks again.

### What a call costs

The SFU bills the traffic that it sends to the browsers, after 1,000 GB in a month. These rules keep that traffic low:

| Rule | Where |
|---|---|
| The microphone sends at 32 kbps at most, and does not send silence (Opus DTX). The browser removes noise and echo first. | `MIC_MAX_BPS`, `withDtx`, `MIC_CLEANUP` |
| The camera is taken at 720p and sent at 360p, 24 frames a second, 500 kbps at most. | `CAM_SEND` |
| A screen is sent at 1080p and 30 frames a second at most, 2.5 Mbps at most. | `SCREEN_LIMITS`, `SCREEN_MAX_BPS` |
| A browser receives one screen at a time: the one that the person chose. A hidden tab receives voices only. | `sync` and `planTracks` |
| A person alone in the call cannot share a screen. A screen that did not change for 10 minutes stops. | `stopShare`, `SCREEN_IDLE_REPORTS` |
| At 900 GB in a month, the Worker refuses a new screen share (409). The app then asks for a Google Meet link and posts it in the room, with a mention of each person in the call. Voice and cameras continue. | `CALL_SCREEN_LIMIT_GB`, `src/callBudget.ts` |

The limit uses the larger of two counts. The first is the account's real traffic, from Cloudflare's analytics API (`accountEgress`, the datasets `callsUsageAdaptiveGroups` and `callsTurnUsageAdaptiveGroups`, with `CF_ANALYTICS_TOKEN`). The Worker reads it each 10 minutes at most. The second is what each browser in a call reports (`call.usage`, each 30 seconds), which D1 sums for the month (`call_usage`). It is there at once, and it stays when the API does not answer.

### The recorder

The recorder is a Worker of its own, `chat-recorder` (`recorder/`), with one container for each start. It is apart from the chat so that a problem in it never stops a deploy of the chat.

1. The first person joins a call. The call is the room's, not a thread's. A person alone in a call is not recorded. When a second person joins (in a DM: when both people accepted), if the room is in `CALL_RECORD_ROOMS` (room ids, or `*`), the chat asks the recorder to start (`startRecorder`, `POST <RECORDER_URL>/start`). The two Workers share `RECORDER_SECRET`.
2. The request has the recording's title: the room's name (`Book.callTitle`). The title has no date: Grain shows it. The request also has a link that the chat signed for that room, good for 5 minutes (`recorderLink`). The link gives a session for the room's recorder identity (`shared/call.ts`, `recorderEmail`). That identity is not a person. It is a member of its one room, with no row in `members` (`isMember`).
3. In the container, a Chromium opens the link, and the room's page joins the call as it does for a person, with the microphone off (`recorder/container/main.ts`) The recorder needs the call's screen open, because it records that screen and counts the people on it. The page can close it by itself, so the recorder opens it again. If it cannot see the call for 15 seconds, or saw nobody, it tells the room that the recording failed.
4. The recorder is in the call's list, so each person sees "Gravando". It does not show as a person, and nobody receives its tracks.
5. The page records what a person sees and hears: the shared screen, or who speaks, and all the voices. It also keeps who speaks at each moment.
6. When no person is in the call for 15 seconds, ffmpeg makes the mp4 that Grain takes.
7. The container sends the audio in parts of 5 minutes to the recorder Worker's speech-to-text (`POST /transcribe`, Workers AI, Whisper). Each piece of text gets the name of the person who spoke the most while it lasted (`recorder/container/attribute.ts`). The model's own filter for parts with no voice is on (`vad_filter`): without it, the model writes words for silence.
8. The container sends the video and that transcript to Grain (`GRAIN_API_TOKEN`). With our transcript, Grain shows each person's name. Without it (the speech-to-text failed), Grain transcribes by itself and names nobody.
9. The container tells the chat (`POST /api/calls/recorded`). The chat answers the emails of everyone who was in the call (`Book.callPeople`), and the container shares the recording in Grain with each of them who has a Grain account (`recorder/container/share.ts`). Grain shows it in their meetings. The container also puts the recording in the playlist "Calls do deco.chat" (made the first time, open to the whole workspace). Grain's settings to share with the workspace apply only to Grain's own recordings, not to uploads, and its API cannot set them on a recording. The room's call chat gets a message (`CALL_THREAD`, `call`: one chat for every call of the room, seen beside the call and never listed as a thread; a DM uses its own conversation) with a summary (`MODEL_FAST`), the Grain link and the transcript as a Markdown file. The agents read that file as each other file. A transcript with a secret in it does not enter the room.

What a person sees when the recording fails:

| Failure | What happens |
|---|---|
| The recorder does not start (no answer, or all its containers are in use) | The thread gets "O gravador não iniciou: esta call não está sendo gravada." |
| A recorded room's call has no recorder for 45 seconds | The call shows "Esta call não está sendo gravada". |
| The recorder leaves a call that goes on (Grain's 3 hours for one file, or it stopped) | The chat asks for a new recorder, 5 times at most for one call. The 3 hours give one more recording. |
| The conversion or the upload fails | The thread gets "A gravação da call falhou." |

What the recorder had before it stopped is lost: the file goes to Grain only at the end. Grain's summary does not run by itself on an upload: a person clicks "Run Intelligence" there.

### Noise suppression

The microphone goes through RNNoise (`web/features/call/denoise.ts`) before it goes to the call. It takes out the noise that the browser's own noise suppression lets through (construction, a keyboard, a voice in the back). A gain (+6 dB) and a limiter after it give back the level that RNNoise takes from the voice. It runs in the browser: no audio goes to a server for this. It is on by default. A person can turn it off in "Mais opções" ("Supressão de ruído"); the choice stays on that device (`localStorage`, `vb-call-denoise`). Mute and the speaking mark use the raw microphone. If RNNoise does not start, the raw microphone goes to the call.

### Background blur

The camera dialog (`CameraDialog`) shows the picture before it goes to the call. The person can put the background out of focus (`web/features/call/blur.ts`). A model finds the person in each frame, in the browser: no picture goes to a server for this. The runtime (`@mediapipe/tasks-vision`, 15 MB) and the model (`selfie_multiclass_256x256`, 16 MB) load only when the person turns the blur on. Only the background is blurred, at a quarter of the size, with the person cut out, so the colors of the person do not make a halo around them. The mask of each frame is mixed with the mask of the frame before, so the edge does not shake.

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
