import type { DocumentPane } from "../documents/types";

/** Whether a key press is the right panel's toggle: ⌥⌘B on a Mac, Ctrl+Alt+B elsewhere. */
export function isPanelToggleKey(event: KeyboardEvent, mac: boolean) {
  return (
    event.code === "KeyB" &&
    event.altKey &&
    !event.shiftKey &&
    (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey)
  );
}

/** The panes a desktop room's top bar offers, in its order (DocumentToolbar). */
const roomPanes = [
  "doc",
  "files",
  "apps",
  "decisions",
  "reminders",
  "people",
  "agents",
] as const satisfies readonly DocumentPane[];

/**
 * A phone room's panes: the drawer's tab row and the doc sheet's, the same
 * panes in the same order as the desktop (Gimenes #4076, #4088). A DM has no
 * doc, people or agents.
 */
export function phonePanes(dm: boolean): readonly DocumentPane[] {
  return dm
    ? roomPanes.filter(
        (pane) => pane !== "doc" && pane !== "people" && pane !== "agents",
      )
    : roomPanes;
}
