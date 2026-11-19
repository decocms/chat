/** Which of Doc / People & agents you left open (per browser): every room opens on the same one. */
const RESTING_PANE_KEY = "vb.restingPane";

type PaneStorage = Pick<Storage, "getItem" | "setItem"> | null | undefined;

export function restingPane(storage: PaneStorage): "doc" | "people" {
  try {
    return storage?.getItem(RESTING_PANE_KEY) === "people" ? "people" : "doc";
  } catch {
    return "doc";
  }
}

/** Only Doc and People are remembered: the other panes are things you open for a moment. */
export function rememberPane(storage: PaneStorage, pane: string) {
  if (pane !== "doc" && pane !== "people") return;
  try {
    storage?.setItem(RESTING_PANE_KEY, pane);
  } catch {
    /* Private window or blocked storage: rooms open on the doc. */
  }
}
