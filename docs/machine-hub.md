# Machines and the hub (proposal)

Status: proposal. It is not built yet. Discuss it in the epic in the project room before you build it.

## Problem

- The agents pane shows "Other agents": Claudes that are not related to a machine. Most of them are closed. The server cannot know, because it sees only timestamps (`listening_at`, `agent_reads.seen_at`).
- A Claude that is dead shows as "listening" for up to 12 minutes (`LISTEN_FRESH`).
- A Claude that a person opens manually is not related to the machine where it runs. Thus the machine switch does not control it.

## Model

1. **A machine is a hub.** A machine is one `vibebook hub` process: a laptop, a computer in a cluster or a cloud sandbox. Each machine has one ID (`~/.vibebook/machine.json`, or `sb_<id>` for a sandbox).
2. **Each agent belongs to a machine.** Each `vibebook listen` goes through the hub of its machine. The pane groups agents by machine. There is no "Other agents" group.
3. **The hub knows which agents are alive.** It only observes. It does not start or stop Claudes. The herdr runner continues to start and stop Claudes.
4. **The hub delivers.** A room event goes to each agent of the machine that listens to that room, if the machine is on in that room.
5. **The hub reports changes immediately.** When an agent starts, dies or disconnects, the hub tells the server.
6. **One switch for each machine in each room.** The switch has one current value. There is no history. Off: the hub does not wake the agents of that machine for that room, and their read cursor in that room does not advance. No process stops.

## Transport

- One hibernating WebSocket for each machine, for events only (`{t:"me"}`, `{t:"agents"}`, `{t:"focus"}`, and new presence events). A hibernating socket costs almost nothing when there is no event.
- Data goes in a separate HTTP request (`wait_for_messages`, `read_room`, `claude_rooms`).
- Presence is real-time state. It is not history.

## Not supported

- The long-poll fallback of the CLI (Node < 22, `VIBEBOOK_NO_HUB`).

## Changes (first estimate)

- **Done (CLI 1.7.3):** each CLI call sends the machine ID and the computer name (`x-vibebook-machine`, `x-vibebook-machine-name`). The server registers the machine for the person, keeps it online while its agents call, and relates each agent to it. The pane shows agents only under their machine. There is no "Other agents" group.

- **Done (agents as people, step 1, Gimenes #6327):** the runner's check-in (`claude_rooms`) sends `machine.kinds`: the agent CLIs that it finds on the computer (`claude`, `codex`, `agy`, `opencode`) and their versions, never a path. The server keeps them in `machines.kinds` (`shared/agentKinds.ts`).

- **Done (agents as people, step 2):** an agent is a record of its person (`agent_personas`: name, machine, kind) with a switch in each room (`persona_rooms`), in `src/personas.ts`.
  - A process that runs an agent (`agents.persona_id`) wakes only where that agent is on (`DELIVERS`, `src/delivery.ts`), and its @name is the agent's name (`src/agentNames.ts`).
  - Migration: a runner that checks in on a machine with no agent of its kind gets a main agent (`claude`, then `claude-2` for a second machine). Its switches are copied from `machine_rooms`. In a room with no switch, it follows "Ligar Claude" (`members.claude_on`), as the machine did.
  - `claude_rooms` takes `persona` (the agent that a runner runs) or `machine.agent` (its kind). It answers `agents`: the machine's agents. An older runner sends neither, and each room is on when any agent of the machine is on there.
  - The app: `POST /api/personas`, `PATCH` and `DELETE /api/personas/:id`, and `POST /api/books/:id/delivery` with `{ persona }`. The machine switch also sets the switches of the machine's agents.

- **CLI, `vibebook listen`:** send the agent ID and the PID of its Claude to the hub (`/wait?book=…&agent=…&pid=…`).
- **CLI, `vibebook hub`:** keep a table of agents (agent ID, Claude PID, room, `listening` or `working`). Check the PIDs every few seconds. Send the table to the server when it changes. Stay alive while a Claude in the table is alive.
- **Server:** keep presence in the Durable Object of the person channel (memory and storage), keyed by machine. Write to D1 only the switch (`machine_rooms`) and the relation agent → machine. When the socket of a machine closes, its agents are offline.
- **Pane:** a machine row with its switch, then one row for each live agent (model, room or folder, `listening` or `working`, context %). No switch for each agent.

## Decisions

- Switch: one for each machine in each room. Default: off. The person turns it on manually for a room. There is no fallback to `members.claude_on`.
- A listen always goes through the hub, so its machine is always connected. A Claude that listens to a room where the switch of its machine is off shows in the pane under its machine. The hub does not wake it. The CLI prints one line that tells this.
- Pane: one row for each live agent under its machine, with its name.
- Delivery: the current behavior is sufficient. A listener that works gets the event on its next `/wait`, through `since`.
- Off stops only the delivery: the hub does not wake the agents, and their read cursor in the room does not advance. When the switch is on again, they get the messages that they did not read. Nothing stops a process, also not the herdr runner. This replaces the behavior of CLI 1.7.1, which closes the Claude of the runner.
- On does not start a second Claude. The herdr runner starts a Claude for a room only when the machine runs in herdr mode and no live agent of that machine listens to that room.
- MCP clients without the CLI: the current behavior stays. They can call the tools. They have no machine, so they do not show in the pane and the hub does not wake them.
- Migration: none. At the release, the default is off for each machine in each room that has no value. The person turns on the rooms that they want.
