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

/** The phone room's places: the chat and the shortcuts of the title menu (PhoneRoomMenu) over the room's panes. */
export type PhoneTab = "chat" | "doc" | "files" | "claude";

/** The panes each phone tab holds; the doc sheet's tab row shows only these. */
export const phoneTabPanes: Record<
  Exclude<PhoneTab, "chat">,
  readonly DocumentPane[]
> = {
  doc: ["doc", "decisions"],
  files: ["files", "apps", "view"],
  claude: ["agents", "reminders"],
};

/** Which tab a pane belongs to. */
export function phoneTabOf(pane: DocumentPane): PhoneTab {
  for (const tab of ["doc", "files", "claude"] as const)
    if (phoneTabPanes[tab].includes(pane)) return tab;
  return "doc";
}

/** The tab shown as selected for a phone layout state. */
export function phoneTab(state: {
  sheet: "side" | "doc" | null;
  pane: DocumentPane;
}): PhoneTab {
  if (state.sheet === "doc") return phoneTabOf(state.pane);
  return "chat";
}
