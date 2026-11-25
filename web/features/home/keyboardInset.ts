/**
 * Keeps a bar docked at the foot of a phone's screen above the on-screen
 * keyboard: the node moves up by as much of the layout viewport's foot as the
 * keyboard covers (the visual viewport ends above it), played as a held Web
 * Animation so no inline style is written, and `data-keyboard` is set while
 * it is up (the bar then drops its safe-area padding). The room's layout reads the same visual viewport for its
 * composer (room-layout/geometry.ts).
 */
export function keyboardInset(node: HTMLElement) {
  const viewport = window.visualViewport;
  if (!viewport) return;
  let frame = 0,
    lift: Animation | null = null,
    last = -1;
  const measure = () => {
    frame = 0;
    const inset = Math.max(
      0,
      Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
    );
    if (inset !== last) {
      last = inset;
      lift?.cancel();
      lift = inset
        ? node.animate([{ transform: `translateY(-${inset}px)` }], {
            duration: 0,
            fill: "forwards",
          })
        : null;
    }
    node.toggleAttribute("data-keyboard", inset > 80);
  };
  const changed = () => {
    if (!frame) frame = requestAnimationFrame(measure);
  };
  measure();
  viewport.addEventListener("resize", changed);
  viewport.addEventListener("scroll", changed);
  return {
    destroy() {
      cancelAnimationFrame(frame);
      lift?.cancel();
      viewport.removeEventListener("resize", changed);
      viewport.removeEventListener("scroll", changed);
    },
  };
}
