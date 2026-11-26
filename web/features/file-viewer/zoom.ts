/** The zoom of the full-screen image viewer (Gimenes #5961, option B): "fit" shows the whole image in its box (never
 *  bigger than its own size), and the person zooms from there up to 8×, at the point under the cursor. Offsets are
 *  from the center of the box, in screen pixels. Pure, so the browser and the tests share it. */
export type ZoomView = { scale: number; x: number; y: number; fit: number };
export const MAX_ZOOM = 8;
const near = (a: number, b: number) => Math.abs(a - b) < 0.001;

export function fitScale(
  box: { width: number; height: number },
  image: { width: number; height: number },
) {
  if (!box.width || !box.height || !image.width || !image.height) return 1;
  return Math.min(box.width / image.width, box.height / image.height, 1);
}

export const fitted = (fit: number): ZoomView => ({
  scale: fit,
  x: 0,
  y: 0,
  fit,
});

export const isFitted = (view: ZoomView) =>
  near(view.scale, view.fit) && !view.x && !view.y;

/** Zoom to `scale` with the point (cx, cy), from the box center, staying still on screen. At fit, the image centers. */
export function zoomTo(
  view: ZoomView,
  scale: number,
  cx = 0,
  cy = 0,
): ZoomView {
  const next = Math.min(
    Math.max(scale, view.fit),
    Math.max(MAX_ZOOM, view.fit),
  );
  if (near(next, view.fit)) return fitted(view.fit);
  const ratio = next / view.scale;
  return {
    ...view,
    scale: next,
    x: cx - (cx - view.x) * ratio,
    y: cy - (cy - view.y) * ratio,
  };
}

/** A click: from fit to 2× fit (at least the image's own size), at the click; else back to fit. */
export function toggle(view: ZoomView, cx = 0, cy = 0): ZoomView {
  return isFitted(view)
    ? zoomTo(view, Math.max(1, view.fit * 2), cx, cy)
    : fitted(view.fit);
}

export const pan = (view: ZoomView, dx: number, dy: number): ZoomView =>
  isFitted(view) ? view : { ...view, x: view.x + dx, y: view.y + dy };

/** The label between the zoom buttons: "fit" at fit, else the percent of the image's own size. */
export const zoomLabel = (view: ZoomView) =>
  isFitted(view) ? null : `${Math.round(view.scale * 100)}%`;
