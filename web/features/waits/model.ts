import type { MeResult } from "../../../shared/schemas";
import { threadWait, type ThreadWait } from "../../../shared/threadWait";
export type WaitReference = Pick<MeResult["waits"][number], "ref">;
/** A message that asks or mentions you (m<id>): a notification, gone once you read the message (src/book.ts markRead). */
export const messageWait = (wait: WaitReference) => wait.ref.startsWith("m");
/** The red number on a room, a thread or a room's tab: the messages there that ask you something and you haven't read.
 *  Work (a task of yours in review, your Claude's questions) is not a notification: it stays in the Inbox until done
 *  (PO #5172), so the Inbox counts every wait and a room only its messages. */
export const waitCount = (waits: readonly WaitReference[]) =>
  waits.filter(messageWait).length;
export type WaitCopy = (
  pt: string,
  vars?: Record<string, string | number>,
) => string;
/** An open thread of yours (e<epic>) in words: why it is here, before how far its tasks went. */
export const threadWaitLabel = (thread: ThreadWait) =>
  thread.stale
    ? "Parada há 3 dias"
    : thread.ready
      ? "Pronta pra fechar"
      : thread.status === "doing"
        ? "Em andamento"
        : "A fazer";
/** A wait's line: its text, or for an open thread of yours its state ("Pronta pra fechar · 3/3 tarefas"); the
 *  stored line of a thread wait is machine-readable (shared/threadWait.ts), never shown. */
export function waitText(
  wait: Pick<MeResult["waits"][number], "ref" | "text" | "author">,
  t: WaitCopy,
) {
  const thread = threadWait(wait);
  if (!thread) return wait.text;
  const label = t(threadWaitLabel(thread));
  return thread.total
    ? `${label} · ${t("{done}/{total} tarefas", { done: thread.done, total: thread.total })}`
    : label;
}
