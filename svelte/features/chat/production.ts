import type { Room } from "../../../shared/room";
export type ProductionStatus = "changes" | "verified" | "live";
/** Same loaded-message and origin precedence as the default reader's allMsgs.
 * This is a presentation cue, never a mutation of an agent's deploy record. */
export function productionStatuses(
  room: Pick<Room, "me" | "epics" | "messages" | "origins">,
): ReadonlyMap<string, ProductionStatus> {
  const seen = new Set<number>(),
    updates = new Map<string, number>();
  for (const message of [...room.messages, ...(room.origins ?? [])]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    if (!message.kind && message.author === room.me)
      updates.set(
        message.thread,
        Math.max(updates.get(message.thread) ?? -Infinity, message.ts),
      );
  }
  const result = new Map<string, ProductionStatus>();
  for (const epic of room.epics) {
    const prod = epic.prod;
    if (!prod) continue;
    const changed =
      !epic.archived &&
      typeof prod.at === "number" &&
      (updates.get(epic.id) ?? -Infinity) > prod.at;
    result.set(
      epic.id,
      changed ? "changes" : prod.stage === "verified" ? "verified" : "live",
    );
  }
  return result;
}
