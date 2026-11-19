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
6. **One switch for each machine in each room.** The switch has one current value. There is no history. Off: the hub does not wake the agents of that machine for that room. The agents stay alive. The herdr runner closes the Claude that it opened for that room (CLI 1.7.1).

## Transport

- One hibernating WebSocket for each machine, for events only (`{t:"me"}`, `{t:"agents"}`, `{t:"focus"}`, and new presence events). A hibernating socket costs almost nothing when there is no event.
- Data goes in a separate HTTP request (`wait_for_messages`, `read_room`, `claude_rooms`).
- Presence is real-time state. It is not history.

## Not supported

- Clients that do not have a hub. This includes the long-poll fallback of the CLI (Node < 22, `VIBEBOOK_NO_HUB`) and MCP clients without the CLI.

## Changes (first estimate)

- **CLI, `vibebook listen`:** send the agent ID and the PID of its Claude to the hub (`/wait?book=…&agent=…&pid=…`).
- **CLI, `vibebook hub`:** keep a table of agents (agent ID, Claude PID, room, `listening` or `working`). Check the PIDs every few seconds. Send the table to the server when it changes. Stay alive while a Claude in the table is alive.
- **Server:** keep presence in the Durable Object of the person channel (memory and storage), keyed by machine. Write to D1 only the switch (`machine_rooms`) and the relation agent → machine. When the socket of a machine closes, its agents are offline.
- **Pane:** a machine row with its switch, then one row for each live agent (model, room or folder, `listening` or `working`, context %). No switch for each agent.

## Open questions

1. MCP clients without the CLI: can they still call the tools (but never show in the pane and never wake), or does deco.chat refuse them?
2. A Claude starts `vibebook listen` in a room where its machine is off: does that turn the machine on for that room, or does the Claude stay muted? Must the CLI tell the person?
3. Pane: a row for each live agent under its machine, or only a machine row with a count?
4. The default value of the switch when a machine has no value for a room: on, off or `members.claude_on`?
5. Delivery: is the current behavior enough? Today a listener that works (not waiting) gets the event on its next `/wait`, through `since`.
