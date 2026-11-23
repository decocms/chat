import type { MeResult } from "../../../shared/schemas";
export type WaitReference = Pick<MeResult["waits"][number], "ref">;
/** The server decides who was asked. Each wait is one thing for you to do (an ask, a question or a permission of your
 *  Claude, a task of yours in review), so the one number on a room counts them all, in one colour. */
export const waitCount = (waits: readonly WaitReference[]) => waits.length;
