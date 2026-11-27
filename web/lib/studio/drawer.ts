// One phone drawer for the whole app (Gimenes #6174): the same slide, curve and drag to close from any side. The room
// drawer (web/features/room-layout) seeks its own playback with these numbers; the Drawer molecule (Drawer.svelte)
// slides with the same durations and the `ease-drawer` token, and drags with `dragToClose`.

import { tv } from "tailwind-variants";

export type DrawerSide = "top" | "bottom" | "left" | "right";

/** The panel of a phone drawer on each side: the room drawer and the Drawer molecule have the same shape. */
// `place` puts it on its edge (and slides in and out); `surface` is what a finger drags.
export const drawerPanel = tv({
  slots: {
    place: "flex",
    surface:
      "flex min-h-0 w-full flex-1 flex-col bg-background text-foreground shadow-lg",
  },
  variants: {
    side: {
      top: {
        place: "inset-x-0 top-0 max-h-[88dvh]",
        surface: "rounded-b-surface pt-[env(safe-area-inset-top)]",
      },
      bottom: {
        place: "inset-x-0 bottom-0 max-h-[85dvh]",
        surface:
          "rounded-t-surface pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      },
      left: {
        place: "inset-y-0 left-0 w-[85%] max-w-sm",
        surface:
          "rounded-r-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
      },
      right: {
        place: "inset-y-0 right-0 w-[85%] max-w-sm",
        surface:
          "rounded-l-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
      },
    },
  },
});

/** What `Drawer` gives its content: how to close it (the drag and the grab bar use it). */
export const DRAWER_CONTEXT = Symbol("drawer");
export type DrawerContext = { close: () => void };

/** A full open slide (ms). A drawer is most of the screen, so it needs a bit more than 300 ms to read as a slide. */
export const DRAWER_OPEN_MS = 360;
/** A full close slide (ms): shorter than the open, so closing feels quick. */
export const DRAWER_CLOSE_MS = 260;
/** Pixels a finger moves before it is a drag and not a tap. */
export const DRAWER_DRAG_THRESHOLD = 6;
/** The curve of the `ease-drawer` token (web/styles/tailwind.css), for code that animates without a class. */
export const DRAWER_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** Progress (0 closed, 1 open, or the other way round) after a drag from `start` to `position` over `size` px. */
export function drawerProgress(
  initial: number,
  start: number,
  position: number,
  size: number,
) {
  return size > 0 ? clamp(initial + (position - start) / size, 0, 1) : initial;
}

/** Where a drag ends: past a quarter of the size it flips, else it goes back. A tap (under the threshold) stays. */
export function drawerEndpoint(
  initial: 0 | 1,
  start: number,
  position: number,
  size: number,
): 0 | 1 {
  if (!(size > 0) || Math.abs(position - start) < DRAWER_DRAG_THRESHOLD)
    return initial;
  return initial === 0
    ? position - start > size / 4
      ? 1
      : 0
    : position - start < -size / 4
      ? 0
      : 1;
}

/** The .32,.72,0,1 curve as a function, for playback that seeks a paused animation. */
export function drawerEasing(progress: number) {
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

/** How far a pointer moved towards closing a drawer on that side (negative: towards opening it more). */
export function closingDistance(side: DrawerSide, dx: number, dy: number) {
  return side === "top"
    ? -dy
    : side === "bottom"
      ? dy
      : side === "left"
        ? -dx
        : dx;
}

/** The drawer's size along the axis it slides on. */
const axisSize = (side: DrawerSide, rect: DOMRect) =>
  side === "top" || side === "bottom" ? rect.height : rect.width;

/** True when the touch started in content scrolled away from the drawer's closing edge: that drag scrolls. */
function scrolledAway(
  target: EventTarget | null,
  panel: HTMLElement,
  side: DrawerSide,
) {
  for (
    let node = target instanceof Element ? target : null;
    node && node !== panel.parentElement;
    node = node.parentElement
  ) {
    if (!(node instanceof HTMLElement)) continue;
    if (side === "bottom" && node.scrollTop > 0) return true;
    if (
      side === "top" &&
      node.scrollHeight - node.clientHeight - node.scrollTop > 1
    )
      return true;
    if (node === panel) break;
  }
  return false;
}

export type DragToCloseOptions = {
  side: DrawerSide;
  /** Called once the drawer has slid out under the finger. */
  onclose: () => void;
  /** Off: no drag (a desktop, or a drawer that must stay). */
  enabled?: boolean;
};

const reduceMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Svelte action: drag the drawer towards its edge to close it. The node is the drawer panel. The panel follows the
 * finger (a paused Web Animation, so no inline style); past a quarter of its size it slides out and `onclose` runs,
 * with `data-drag-closed` set so the close animation does not play again. A drag that starts in scrolled content
 * scrolls instead. A click right after a drag is dropped.
 */
export function dragToClose(node: HTMLElement, initial: DragToCloseOptions) {
  let options = initial;
  let pointer: number | null = null;
  let start = { x: 0, y: 0 };
  let size = 0;
  let dragging = false;
  let animation: Animation | null = null;
  let quietUntil = 0;

  const offset = (side: DrawerSide) =>
    side === "top"
      ? "0 -100%"
      : side === "bottom"
        ? "0 100%"
        : side === "left"
          ? "-100% 0"
          : "100% 0";

  const follow = (progress: number) => {
    animation ??= node.animate(
      [{ translate: "0 0" }, { translate: offset(options.side) }],
      { duration: 1000, fill: "both" },
    );
    animation.pause();
    animation.currentTime = progress * 1000;
  };

  const down = (event: PointerEvent) => {
    if (options.enabled === false || pointer !== null || event.button > 0)
      return;
    if (scrolledAway(event.target, node, options.side)) return;
    pointer = event.pointerId;
    start = { x: event.clientX, y: event.clientY };
    size = axisSize(options.side, node.getBoundingClientRect());
    dragging = false;
  };

  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    const distance = closingDistance(
      options.side,
      event.clientX - start.x,
      event.clientY - start.y,
    );
    if (!dragging) {
      const across = closingDistance(
        options.side === "top" || options.side === "bottom"
          ? "right"
          : "bottom",
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (Math.abs(distance) < DRAWER_DRAG_THRESHOLD) return;
      // Sideways, or towards opening: not ours (a scroll, or a swipe on a row).
      if (distance < 0 || Math.abs(across) > Math.abs(distance)) {
        pointer = null;
        return;
      }
      dragging = true;
      try {
        node.setPointerCapture(event.pointerId);
      } catch {}
    }
    event.preventDefault();
    follow(drawerProgress(0, 0, Math.max(0, distance), size));
  };

  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    if (!dragging || !animation) return;
    dragging = false;
    quietUntil = Date.now() + 400;
    const distance = closingDistance(
      options.side,
      event.clientX - start.x,
      event.clientY - start.y,
    );
    const progress = drawerProgress(0, 0, Math.max(0, distance), size);
    const close = drawerEndpoint(0, 0, Math.max(0, distance), size) === 1;
    const done = animation;
    const time = reduceMotion()
      ? 0
      : close
        ? DRAWER_CLOSE_MS * (1 - progress)
        : DRAWER_CLOSE_MS * progress;
    const from = progress;
    const to = close ? 1 : 0;
    done.cancel();
    animation = null;
    const slide = node.animate(
      [
        { translate: interpolate(options.side, from) },
        { translate: interpolate(options.side, to) },
      ],
      { duration: time, easing: DRAWER_EASING, fill: "forwards" },
    );
    if (close) {
      node.dataset.dragClosed = "";
      slide.onfinish = () => options.onclose();
    } else slide.onfinish = () => slide.cancel();
  };

  const interpolate = (side: DrawerSide, progress: number) => {
    const p = `${Math.round(progress * 1000) / 10}%`;
    return side === "top"
      ? `0 -${p}`
      : side === "bottom"
        ? `0 ${p}`
        : side === "left"
          ? `-${p} 0`
          : `${p} 0`;
  };

  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    dragging = false;
    animation?.cancel();
    animation = null;
  };

  const click = (event: MouseEvent) => {
    if (Date.now() < quietUntil) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("click", click, true);
  return {
    update(next: DragToCloseOptions) {
      options = next;
    },
    destroy() {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("click", click, true);
      animation?.cancel();
    },
  };
}
