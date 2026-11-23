import {
  EPIC_STATUSES,
  type Epic,
  type EpicStatus,
  type Room,
  type Suggestion,
} from "../../../shared/room";
import type { IconName } from "../../lib/studio/icons";
import { prettyModel } from "../chat/model";
export { epicStatus } from "../../../shared/epicStatus";
/** How each epic status looks: the epic bar's pill and menu, and the sidebar's icon. `text` tints the icon alone. */
const epicStatusLooks = {
  todo: {
    label: "A fazer",
    icon: "circle",
    pill: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
  doing: {
    label: "Fazendo",
    icon: "clock",
    pill: "bg-warning/15 text-warning",
    text: "text-warning",
  },
  review: {
    label: "Esperando OK",
    icon: "eye",
    pill: "bg-brand-purple-tint text-brand-purple-text",
    text: "text-brand-purple-text",
  },
  done: {
    label: "Feito",
    icon: "check-circle",
    pill: "bg-success/15 text-success",
    text: "text-success",
  },
  dismissed: {
    label: "Arquivado",
    icon: "archive",
    pill: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
} satisfies Record<
  EpicStatus,
  { label: string; icon: IconName; pill: string; text: string }
>;
export const epicStatusLook = (status: EpicStatus) => epicStatusLooks[status];
/** The status menu, in this order. */
export const epicStatusChoices = EPIC_STATUSES.map((value) => ({
  value,
  ...epicStatusLooks[value],
}));
import type { AgentsResult } from "../../../shared/schemas";
export type Presence = Pick<AgentsResult, "agents" | "sandboxes">;
export { suggestionIdentity } from "../../../shared/suggestions";
export { sandboxCost } from "../../../shared/sandboxCost";
export const epicIdentity = (value: Epic) => JSON.stringify(value);
export function suggestionAt(room: Room, thread: string) {
  if (!/^pre:\d+$/.test(thread)) return undefined;
  return room.suggestions[Number(thread.slice(4))];
}
/** The open thread's own title (a suggestion or an epic); undefined for the main thread or a thread that is gone. */
export function threadTitle(room: Room, thread: string) {
  return (
    suggestionAt(room, thread)?.title ??
    room.epics.find((epic) => epic.id === thread)?.title
  );
}
export function messageCount(
  room: Pick<Room, "messages" | "counts" | "countsAt">,
  thread: string,
) {
  const loaded = room.messages.filter((message) => message.thread === thread);
  return room.counts
    ? (room.counts[thread] ?? 0) +
        loaded.filter((message) => message.id > (room.countsAt ?? 0)).length
    : loaded.length;
}
/** Preserve loaded newest-message precedence, descendant traversal cap and summarized versions. */
export function treeFiles(
  room: Pick<Room, "epics" | "messages">,
  epicId: string,
) {
  const ids = [epicId],
    children = new Map<string, string[]>();
  for (const epic of room.epics)
    if (epic.parent)
      children.set(epic.parent, [
        ...(children.get(epic.parent) ?? []),
        epic.id,
      ]);
  for (let index = 0; index < ids.length && ids.length < 60; index++)
    for (const child of children.get(ids[index]) ?? [])
      if (!ids.includes(child)) ids.push(child);
  type File = NonNullable<Epic["files"]>[number];
  const names = new Map<
    string,
    { file: File; seen: Set<string>; count: number }
  >();
  for (let index = room.messages.length - 1; index >= 0; index--) {
    const message = room.messages[index]!;
    if (!ids.includes(message.thread)) continue;
    for (const file of message.files ?? []) {
      const previous = names.get(file.name);
      if (previous) previous.seen.add(file.id);
      else
        names.set(file.name, {
          file: { id: file.id, name: file.name, type: file.type, n: 1 },
          seen: new Set([file.id]),
          count: 0,
        });
    }
  }
  for (const id of ids)
    for (const file of room.epics.find((epic) => epic.id === id)?.files ?? []) {
      const previous = names.get(file.name);
      if (previous)
        previous.count = Math.max(previous.count, file.n, previous.seen.size);
      else
        names.set(file.name, { file, seen: new Set([file.id]), count: file.n });
    }
  return [...names.values()].map(({ file, seen, count }) => ({
    ...file,
    n: Math.max(count, seen.size),
  }));
}
/** Dedicated Fire Haiku and all-room listeners are not duplicate room workers. */
export function roomListenerCount(presence: Presence, email: string) {
  return presence.agents.filter(
    (agent) =>
      agent.email === email &&
      agent.listening &&
      !agent.all_rooms &&
      !/haiku/i.test(agent.who || ""),
  ).length;
}
export function agentRows(presence: Presence, email: string) {
  const seen = new Set<string>();
  return presence.agents
    .filter((agent) => agent.email === email)
    .sort((a, b) => Number(b.listening) - Number(a.listening))
    .filter((agent) => {
      const id = prettyModel(agent.who) + agent.repo;
      if (agent.listening) {
        seen.add(id);
        return true;
      }
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, Math.max(3, roomListenerCount(presence, email)));
}
export function contextPercent(tokens: number, window: number) {
  return Number.isFinite(tokens) && Number.isFinite(window) && window > 0
    ? Math.max(0, Math.min(100, Math.round((tokens / window) * 100)))
    : 0;
}
/** The context bar's color: green, yellow from 60%, red from 80%
 * (the runner compacts a free Claude at 75%). */
export const contextTone = (percent: number) =>
  percent >= 80 ? "hot" : percent >= 60 ? "mid" : "ok";
/** Short token counts: 1.2M, 180k. */
export const compactTokens = (value: number) =>
  value >= 1e6
    ? `${+(value / 1e6).toFixed(1)}M`
    : `${Math.round(value / 1000)}k`;
export type AgentRow = Presence["agents"][number];
export type ContextSection = {
  key: "context" | "five_hour" | "seven_day";
  label: string;
  percent: number;
  detail: string;
};
/** The hover card's meters: context, then the plan's limits that
 * are present and not yet reset. Empty when the agent reports no context. */
export function contextSections(
  context: AgentRow["context"],
  t: (text: string, vars?: Record<string, string | number>) => string,
  locale: string,
  now = Date.now(),
): ContextSection[] {
  if (!context) return [];
  const percent = contextPercent(context.tokens, context.window);
  const sections: ContextSection[] = [
    {
      key: "context",
      label: t("Contexto"),
      percent,
      detail: `${percent}% · ${compactTokens(context.tokens)}/${compactTokens(context.window)}`,
    },
  ];
  for (const key of ["five_hour", "seven_day"] as const) {
    const limit = context.limits?.[key];
    if (!limit || limit.r * 1000 < now) continue;
    const date = new Date(limit.r * 1000),
      time = date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      });
    const at =
      key === "five_hour"
        ? time
        : `${date.toLocaleDateString(locale, { weekday: "short" }).replace(".", "")} ${time}`;
    sections.push({
      key,
      label: t(key === "five_hour" ? "Sessão de 5h" : "Semana"),
      percent: Math.max(0, Math.min(100, Math.round(limit.p))),
      detail: t("{p}% · reseta {at}", { p: Math.round(limit.p), at }),
    });
  }
  return sections;
}
