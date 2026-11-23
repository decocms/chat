import type {
  AgentGrantsResult,
  AgentsResult,
  RoomMachine,
} from "../../../shared/schemas";
import type { Room } from "../../../shared/room";
import { messageById, permissionAsk } from "../chat/privacy";
import type { Wait } from "../home/model";
export type AgentPhase = "idle" | "pending" | "error" | "unconfirmed";
export const CONNECT_POLL = 4000,
  CONNECT_POLL_LIMIT = 150,
  RUNNER_TTL = 20_000;
export const SANDBOX_POLL = 5000,
  AGENT_REQUEST_TIMEOUT = 20_000,
  SETUP_TIMEOUT = 300_000;
export const connectPrompt = (origin: string, roomId?: string) =>
  `Read ${origin}/llms.txt and set up deco.chat for this project.${roomId ? ` Room: ${origin}/b/${roomId}` : ""}`;
export function grantGroups(result: AgentGrantsResult, now: number) {
  const groups = new Map<
    string,
    { grant: AgentGrantsResult["agents"][number]; stale: boolean }[]
  >();
  for (const grant of result.agents) {
    const rows = groups.get(grant.client) ?? [];
    rows.push({
      grant,
      stale: now - (grant.used_at ?? grant.connected_at) > 14 * 864e5,
    });
    groups.set(grant.client, rows);
  }
  return [...groups].map(([client, rows]) => ({
    client,
    rows: rows.sort(
      (a, b) =>
        (b.grant.used_at ?? b.grant.connected_at) -
        (a.grant.used_at ?? a.grant.connected_at),
    ),
  }));
}
export function agentQueue(room: Room, now: number) {
  const messages = [...room.messages, ...(room.origins ?? [])],
    seen = new Set<number>();
  return messages
    .filter((message) => {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      const parent = message.reply_to
        ? messageById(room, message.reply_to)
        : undefined;
      return (
        message.author === room.me &&
        !message.kind &&
        !message.answers_ask &&
        !!message.text &&
        message.ts > now - 48 * 3600e3 &&
        !(parent && permissionAsk(parent))
      );
    })
    .map((message) => {
      const acks = (room.acks ?? []).filter(
        (ack) => ack.email === room.me && ack.msg_id === message.id,
      );
      const phase = acks.some(
        (ack) =>
          ack.status === "done" ||
          ack.status === "idle" ||
          ack.status === "dismissed",
      )
        ? null
        : acks.some((ack) => ack.status === "blocked")
          ? "blocked"
          : acks.some((ack) => ack.status === "doing")
            ? "doing"
            : "queued";
      return { message, phase };
    })
    .filter((item) => item.phase !== null);
}
export function agentPresence(
  data: AgentsResult | null,
  account: string,
  now: number,
) {
  const mine = data?.agents.filter((agent) => agent.email === account) ?? [],
    live = mine.some((agent) => agent.listening),
    around =
      live || mine.some((agent) => now - (agent.seen_at ?? 0) < 30 * 60e3);
  return { mine, live, around, on: data?.claude_on ?? false };
}
export const pendingAsk = (
  waits: readonly Wait[],
  roomId: string,
  thread: string,
) =>
  waits.find(
    (wait) =>
      wait.book_id === roomId &&
      /^a\d+$/.test(wait.ref) &&
      wait.thread !== thread,
  );
export const askPreview = (text: string | null | undefined) =>
  (text ?? "")
    .replace(/^(⏸|❓)\s*Seu (?:Claude|agent)\s*/, "")
    .replace(/[*`]/g, "")
    .slice(0, 160);
export const preparing = (state: string, ready: boolean) =>
  !ready || (state !== "running" && /ing$/.test(state));
/** A create/setup error can follow external VM effects. Only these established pre-handler/pre-create refusals are definite. */
export const knownCreateRefusal = (status: number, error: string) =>
  status === 401 ||
  status === 403 ||
  error === "Conecte sua conta do freestyle.sh primeiro." ||
  error === "No máximo 3 sandboxes seus por sala.";
/** One word for where your agent stands in this room: the header icon's dot and the quiet line follow it. */
export type AgentStatus =
  "none" | "off" | "opening" | "late" | "listening" | "working";
export function agentStatus(
  presence: ReturnType<typeof agentPresence>,
  hasAgent: boolean | null,
  askedAt: number,
  now: number,
): AgentStatus {
  if (presence.live) return "listening";
  if (hasAgent === false) return "none";
  if (!presence.on) return "off";
  if (presence.around) return "working";
  return askedAt && now - askedAt <= 180_000 ? "opening" : "late";
}
/**
 * The one ✻ state (header, doc tabs, phone bar): presence and the queue merged,
 * highest priority first. Blocked wins over everything; work waiting on the agent
 * (busy, queued) over plain presence.
 */
export type AgentMarkState = "blocked" | "busy" | "queued" | AgentStatus;
export type AgentMarkView = {
  state: AgentMarkState;
  count: number;
  on: boolean;
};
export function agentMark(
  status: AgentStatus,
  queue: readonly { phase: string | null }[],
): AgentMarkView {
  const count = queue.length,
    on = status !== "none" && status !== "off";
  const state: AgentMarkState = queue.some((item) => item.phase === "blocked")
    ? "blocked"
    : count &&
        (status === "working" || queue.some((item) => item.phase === "doing"))
      ? "busy"
      : count
        ? "queued"
        : status;
  return { state, count, on: on || state === "blocked" };
}
/** True when this computer's local runner (its machine id, from its /ping) is one of your machines in the list.
 * Then "Add an agent" does not offer "This computer": the list shows it already. Without the id (no local network
 * permission, or a CLI older than 1.7.8) it is false: the page cannot tell which machine it runs on. */
export const thisComputerListed = (
  machines: readonly RoomMachine[],
  runnerMachine: string | null,
) =>
  !!runnerMachine &&
  machines.some((m) => m.id === runnerMachine && m.kind !== "sandbox");
