export const TIMELINE_MS = 1000,
  DOCUMENT_MIN = 260,
  DOCUMENT_DEFAULT = 380,
  CHAT_MIN = 320,
  SIDEBAR_WIDTH = 272,
  SIDEBAR_RAIL_WIDTH = 68,
  DRAG_THRESHOLD = 6;
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
export function sheetProgress(
  initial: 0 | 1,
  start: number,
  position: number,
  height: number,
) {
  return height > 0
    ? clamp(initial + (position - start) / height, 0, 1)
    : initial;
}
export function sheetEndpoint(
  initial: 0 | 1,
  start: number,
  position: number,
  height: number,
): 0 | 1 {
  if (!(height > 0) || Math.abs(position - start) < DRAG_THRESHOLD)
    return initial;
  return initial === 0
    ? position - start > height / 4
      ? 1
      : 0
    : position - start < -height / 4
      ? 0
      : 1;
}
/** A full open slide (ms). The sheet is most of the screen tall, so it needs a bit more than 300 ms to read as a slide. */
export const SHEET_OPEN_MS = 360;
/** A full close slide (ms): shorter than the open, so closing feels quick. */
export const SHEET_CLOSE_MS = 260;
/** Existing .32,.72,0,1 release curve, evaluated only for playback seeking. */
export function sheetEasing(progress: number) {
  const x = clamp(progress, 0, 1);
  if (x === 0 || x === 1) return x;
  const cubic = (t: number, a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0,
    high = 1;
  for (let i = 0; i < 20; i++) {
    const middle = (low + high) / 2;
    if (cubic(middle, 0.32, 0) < x) low = middle;
    else high = middle;
  }
  return cubic((low + high) / 2, 0.72, 1);
}
