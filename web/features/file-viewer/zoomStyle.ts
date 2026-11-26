import type { ZoomView } from "./zoom";

/** Moves and scales the full-screen image (Gimenes #5961). Only the custom properties in scripts/style-policy.ts
 *  ZOOM_PROPERTIES are written; the image's Tailwind classes read them. A Svelte action. */
export function zoomStyle(
  image: HTMLElement,
  value: { view: ZoomView; width: number },
) {
  const apply = ({ view, width }: { view: ZoomView; width: number }) => {
    image.style.setProperty("--zoom-x", `${view.x.toFixed(1)}px`);
    image.style.setProperty("--zoom-y", `${view.y.toFixed(1)}px`);
    image.style.setProperty("--zoom-s", view.scale.toFixed(4));
    image.style.setProperty("--zoom-w", width ? `${width}px` : "auto");
  };
  apply(value);
  return { update: apply };
}
