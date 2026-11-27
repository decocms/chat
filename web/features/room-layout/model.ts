import { DRAWER_DRAG_THRESHOLD } from "../../lib/studio/drawer";
export const TIMELINE_MS = 1000,
  DOCUMENT_MIN = 260,
  DOCUMENT_DEFAULT = 380,
  CHAT_MIN = 320,
  SIDEBAR_WIDTH = 272,
  SIDEBAR_RAIL_WIDTH = 68,
  DRAG_THRESHOLD = DRAWER_DRAG_THRESHOLD;
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function hasSheetSurface(
  sheet: "side" | "doc",
  state: { documentVisible: boolean },
) {
  return sheet === "side" || state.documentVisible;
}
export function documentMaximum(containerWidth: number, collapsed: boolean) {
  return Math.max(
    DOCUMENT_MIN,
    Math.round(containerWidth) -
      (collapsed ? SIDEBAR_RAIL_WIDTH : SIDEBAR_WIDTH) -
      CHAT_MIN,
  );
}
export function documentWidth(
  value: number,
  containerWidth: number,
  collapsed: boolean,
) {
  return clamp(
    Math.round(Number.isFinite(value) ? value : DOCUMENT_DEFAULT),
    DOCUMENT_MIN,
    documentMaximum(containerWidth, collapsed),
  );
}
export function documentProgress(
  value: number,
  containerWidth: number,
  collapsed: boolean,
) {
  const maximum = documentMaximum(containerWidth, collapsed);
  return maximum === DOCUMENT_MIN
    ? 0
    : (documentWidth(value, containerWidth, collapsed) - DOCUMENT_MIN) /
        (maximum - DOCUMENT_MIN);
}
/** The doc width someone dragged, per browser. */
export const DOCUMENT_WIDTH_KEY = "vb.docW";
export function storedDocumentWidth(value: string | null) {
  const parsed = Number(value);
  return value !== null && value.trim() && parsed && Number.isFinite(parsed)
    ? Math.round(parsed)
    : DOCUMENT_DEFAULT;
}
/** The preferred width as both the room and its loading skeleton read it. */
export function preferredDocumentWidth(
  storage: Pick<Storage, "getItem"> | null | undefined,
) {
  try {
    return storedDocumentWidth(storage?.getItem(DOCUMENT_WIDTH_KEY) ?? null);
  } catch {
    return DOCUMENT_DEFAULT;
  }
}
/** Whether you closed the side pane last time (per browser): a room opens it
 * as you left it. Read by the room (controller.ts) and by its loading state
 * (RoomSkeleton via preview.ts), so the skeleton draws the pane open or
 * closed as the room will open (Gimenes #3938). Change both through here. */
export const DOCUMENT_CLOSED_KEY = "vb.docClosed";
export function documentClosedBefore(
  storage: Pick<Storage, "getItem"> | null | undefined,
) {
  try {
    return storage?.getItem(DOCUMENT_CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}
// The room drawer slides and drags like every phone drawer (web/lib/studio/drawer.ts).
export {
  drawerProgress as sheetProgress,
  drawerEndpoint as sheetEndpoint,
  drawerEasing as sheetEasing,
  DRAWER_OPEN_MS as SHEET_OPEN_MS,
  DRAWER_CLOSE_MS as SHEET_CLOSE_MS,
} from "../../lib/studio/drawer";
