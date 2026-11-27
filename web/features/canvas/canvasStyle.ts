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

export function cardStyle(node: HTMLElement | SVGElement, box: Box) {
  const apply = (b: Box) => {
    node.style.setProperty("--cv-l", `${b.x}px`);
    node.style.setProperty("--cv-t", `${b.y}px`);
    node.style.setProperty("--cv-w", `${b.w}px`);
    node.style.setProperty("--cv-h", `${b.h}px`);
  };
  apply(box);
  return { update: apply };
}

/** Each Claude's color on a canvas (shared/canvas.ts claudeColors picks the index): the bar beside its cards and the
 *  dot of its name. Whole class strings, so Tailwind finds them. */
export const CLAUDE_COLORS = [
  {
    bar: "border-team-1",
    dot: "bg-team-1",
    stroke: "stroke-team-1",
    fill: "fill-team-1",
  },
  {
    bar: "border-team-2",
    dot: "bg-team-2",
    stroke: "stroke-team-2",
    fill: "fill-team-2",
  },
  {
    bar: "border-special",
    dot: "bg-special",
    stroke: "stroke-special",
    fill: "fill-special",
  },
  {
    bar: "border-link",
    dot: "bg-link",
    stroke: "stroke-link",
    fill: "fill-link",
  },
  {
    bar: "border-success",
    dot: "bg-success",
    stroke: "stroke-success",
    fill: "fill-success",
  },
  {
    bar: "border-team-4",
    dot: "bg-team-4",
    stroke: "stroke-team-4",
    fill: "fill-team-4",
  },
] as const;
