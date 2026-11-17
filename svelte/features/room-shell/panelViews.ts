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

/** The phone room's bottom bar: five tabs over the room's panes. */
export type PhoneTab = "chat" | "doc" | "board" | "files" | "claude";

/** The panes each phone tab holds; the doc sheet's tab row shows only these. */
export const phoneTabPanes: Record<
  Exclude<PhoneTab, "chat" | "board">,
  readonly DocumentPane[]
> = {
  doc: ["doc", "decisions"],
  files: ["files", "apps", "view"],
  claude: ["agents", "reminders"],
};

/** Which tab a pane belongs to (the board is its own full-screen tab). */
export function phoneTabOf(pane: DocumentPane): PhoneTab {
  if (pane === "board") return "board";
  for (const tab of ["doc", "files", "claude"] as const)
    if (phoneTabPanes[tab].includes(pane)) return tab;
  return "doc";
}

/** The tab shown as selected for a phone layout state. */
export function phoneTab(state: {
  boardFull: boolean;
  sheet: "side" | "doc" | null;
  pane: DocumentPane;
}): PhoneTab {
  if (state.boardFull) return "board";
  if (state.sheet === "doc") return phoneTabOf(state.pane);
  return "chat";
}
