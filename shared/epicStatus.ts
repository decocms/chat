// The status a thread shows (the pill in the thread bar, the icon in the sidebar). Browser-safe, no backend imports.
import type { Epic, EpicStatus } from "./room";

/** A thread has one stored status (Gimenes #4247): todo, doing, review or done. done is the archive (the Done tab),
 *  so the icon and the tab always agree. Tasks and production do not make it done; only a person does. */
export function epicStatus(
  epic: Pick<Epic, "status" | "archived">,
): EpicStatus {
  if (epic.archived || epic.status === "done" || epic.status === "dismissed")
    return "done";
  return epic.status === "doing" || epic.status === "review"
    ? epic.status
    : "todo";
}

/** What a person sends to mark a thread done (Gimenes #4249): the composer offers it once the tasks are all done. */
export const MARK_DONE = {
  pt: "Marcar como concluída",
  en: "Mark as done",
} as const;

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/[.!]+$/, "")
    .toLowerCase();

/** The message is "Marcar como concluída" or "Mark as done" (any case, accents and a final period optional). */
export const isMarkDone = (text: string) =>
  [MARK_DONE.pt, MARK_DONE.en].some((phrase) => fold(phrase) === fold(text));
