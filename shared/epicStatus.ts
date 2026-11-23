// The status an epic shows (the pill in the epic bar, the icon in the sidebar). Browser-safe, no backend imports.
import type { Epic, EpicStatus } from "./room";

/** The chosen status if there is one; else the deploy stage, the archive and the tasks decide.
 *  An archived epic's done tasks are not sent to the app (Book.wireEpics), so "all done" there means "none left open". */
export function epicStatus(
  epic: Pick<Epic, "status" | "prod" | "archived" | "tasks">,
): EpicStatus {
  if (epic.status) return epic.status;
  const stage = epic.prod?.stage;
  if (stage === "deployed" || stage === "verified") return "live";
  const tasks = epic.tasks;
  if (epic.archived)
    return tasks.every((task) => task.status === "done") ? "done" : "dismissed";
  if (tasks.some((task) => task.status === "review")) return "review";
  if (tasks.some((task) => task.status === "doing" || task.status === "done"))
    return "doing";
  return "todo";
}
