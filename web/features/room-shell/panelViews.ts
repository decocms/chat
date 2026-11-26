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

/**
 * A phone room's panes behind the top bar's ⋮ (B, Gimenes #6052): Doc, Arquivos, Decisões and Lembretes (they were a
 * strip under the bar, A2). A DM has no doc.
 */
export function phoneStripPanes(dm: boolean): readonly DocumentPane[] {
  return phonePanes(dm).filter(
    (pane) =>
      pane === "doc" ||
      pane === "files" ||
      pane === "decisions" ||
      pane === "reminders",
  );
}

/** The phone top bar's ⋮: the panes above, then Pessoas (not in a DM). */
export function phoneMenuPanes(dm: boolean): readonly DocumentPane[] {
  return dm ? phoneStripPanes(dm) : [...phoneStripPanes(dm), "people"];
}

/** The phone drawer's tab row keeps only what ⋮ does not show: Apps and Agents. */
export function phoneDrawerPanes(dm: boolean): readonly DocumentPane[] {
  const strip = phoneStripPanes(dm);
  return phonePanes(dm).filter(
    (pane) => pane !== "people" && !strip.includes(pane),
  );
}
