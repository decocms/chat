import type { DocumentPane } from "../documents/types";

/** The views the room's right panel offers, grouped as the views card lists them. */
export type PanelView = Exclude<DocumentPane, "view">;

export const PANEL_VIEW_GROUPS: readonly (readonly PanelView[])[] = [
  ["doc", "board", "files"],
  ["apps", "decisions", "reminders"],
  ["agents"],
];

/** A view's trailing meta: "waiting" is the lime count of what waits on you, "count" is muted. */
export type PanelViewMeta =
  | { kind: "count"; value: number | string }
  | { kind: "waiting"; value: number };

export function panelViewMeta(
  counts: Partial<Record<DocumentPane, number | string>>,
): Partial<Record<PanelView, PanelViewMeta>> {
  const meta: Partial<Record<PanelView, PanelViewMeta>> = {};
  for (const group of PANEL_VIEW_GROUPS)
    for (const view of group) {
      const value = counts[view];
      if (!value) continue;
      meta[view] =
        view === "board" && typeof value === "number"
          ? { kind: "waiting", value }
          : { kind: "count", value };
    }
  return meta;
}

/** Whether a key press is the right panel's toggle: ⌥⌘B on a Mac, Ctrl+Alt+B elsewhere. */
export function isPanelToggleKey(event: KeyboardEvent, mac: boolean) {
  return (
    event.code === "KeyB" &&
    event.altKey &&
    !event.shiftKey &&
    (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey)
  );
}
