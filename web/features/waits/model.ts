import type { MeResult } from "../../../shared/schemas";
export type WaitReference = Pick<MeResult["waits"][number], "ref">;
/** A message that asks or mentions you (m<id>): a notification, gone once you read the message (src/book.ts markRead). */
export const messageWait = (wait: WaitReference) => wait.ref.startsWith("m");
/** The red number on a room, a thread or a room's tab: the messages there that ask you something and you haven't read.
 *  Work (a task of yours in review, your Claude's questions) is not a notification: it stays in the Inbox until done
 *  (PO #5172), so the Inbox counts every wait and a room only its messages. */
export const waitCount = (waits: readonly WaitReference[]) =>
  waits.filter(messageWait).length;
