/** Length of every seeked timeline (ms): progress 0..1 maps to 0..TIMELINE_MS. */
export const TIMELINE_MS = 1000;

/**
 * Seeks a paused CSS animation that Tailwind declares (`animate-…: <name> 1s linear both paused`). The look stays in
 * the stylesheet; this sets only where on the timeline it is. Used by every phone drawer (drawer.ts) and by the room
 * layout's width and viewport.
 */
export function createSeekPlayback(
  element: HTMLElement,
  name: () => string,
  unavailable: () => void,
) {
  let active = true,
    sequence = 0,
    wanted = 0,
    frame: number | null = null,
    deadline = 0;
  const find = () => {
    if (!active || !element.isConnected || typeof CSSAnimation === "undefined")
      return null;
    return (
      element
        .getAnimations()
        .find(
          (animation): animation is CSSAnimation =>
            animation instanceof CSSAnimation &&
            animation.animationName === name() &&
            animation.effect instanceof KeyframeEffect &&
            animation.effect.target === element,
        ) ?? null
    );
  };
  function cancel() {
    sequence++;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  }
  function seek(ticket: number) {
    frame = null;
    if (!active || sequence !== ticket || !element.isConnected) return;
    const animation = find();
    if (animation) {
      animation.pause();
      animation.currentTime = wanted * TIMELINE_MS;
      return;
    }
    if (performance.now() >= deadline) {
      unavailable();
      return;
    }
    frame = requestAnimationFrame(() => seek(ticket));
  }
  return {
    set(progress: number) {
      if (!active || !Number.isFinite(progress)) return;
      wanted = Math.max(0, Math.min(1, progress));
      const animation = find();
      if (animation) {
        cancel();
        animation.pause();
        animation.currentTime = wanted * TIMELINE_MS;
        return;
      }
      if (frame !== null || !element.isConnected) return;
      deadline = performance.now() + 30_000;
      seek(++sequence);
    },
    suspend: cancel,
    dispose() {
      active = false;
      cancel();
    },
  };
}
export type SeekPlayback = ReturnType<typeof createSeekPlayback>;
