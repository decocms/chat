/** Places the canvas (shared/canvas.ts) the way zoomStyle moves an image: only the custom properties in
 *  scripts/style-policy.ts CANVAS_PROPERTIES are written; Tailwind classes in CanvasPlane read them. Svelte actions. */
type View = { x: number; y: number; zoom: number };
type Box = { x: number; y: number; w: number; h: number };

export function planeStyle(node: HTMLElement, view: View) {
  const apply = (v: View) => {
    node.style.setProperty("--cv-x", `${(-v.x).toFixed(1)}px`);
    node.style.setProperty("--cv-y", `${(-v.y).toFixed(1)}px`);
    node.style.setProperty("--cv-s", v.zoom.toFixed(4));
  };
  apply(view);
  return { update: apply };
}

export function cardStyle(node: HTMLElement, box: Box) {
  const apply = (b: Box) => {
    node.style.setProperty("--cv-l", `${b.x}px`);
    node.style.setProperty("--cv-t", `${b.y}px`);
    node.style.setProperty("--cv-w", `${b.w}px`);
    node.style.setProperty("--cv-h", `${b.h}px`);
  };
  apply(box);
  return { update: apply };
}
