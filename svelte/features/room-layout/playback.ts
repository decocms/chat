import { clamp, TIMELINE_MS } from "./model";
export type RoomAnimation =
  | "vb-room-sheet"
  | "vb-room-scrim"
  | "vb-room-document-width"
  | "vb-room-document-width-rail"
  | "vb-room-viewport";
/** Authored presentation remains in the sole Tailwind entry. This owns playback only. */
export function createRoomPlayback(
  element: HTMLElement,
  name: () => RoomAnimation,
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
  function apply(animation: CSSAnimation) {
    // Discovery still runs for every request: a replacement CSSAnimation at
    // the same progress must be paused and sought independently.
    if (animation.playState !== "paused") animation.pause();
    const time = wanted * TIMELINE_MS;
    if (animation.pending || animation.currentTime !== time)
      animation.currentTime = time;
  }
  function seek(ticket: number) {
    frame = null;
    if (!active || sequence !== ticket || !element.isConnected) return;
    const animation = find();
    if (animation) {
      apply(animation);
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
      wanted = clamp(progress, 0, 1);
      const animation = find();
      if (animation) {
        cancel();
        apply(animation);
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
export type RoomPlayback = ReturnType<typeof createRoomPlayback>;
