// One phone drawer for the whole app (Gimenes #6174, #6221): one engine (createDrawerMotion), one gesture for the
// panel, the grab bar and the scrim, on any side. Drawer + DrawerContent render it; the room's threads drawer is one
// of them. Only the side changes the look.

import { tv } from "tailwind-variants";
import { createSeekPlayback } from "./seekPlayback";

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
    /** As tall as it may be, not as tall as its content (the room's threads). */
    fill: { true: {}, false: {} },
  },
  compoundVariants: [
    { side: "top", fill: true, class: { place: "h-[88dvh]" } },
    { side: "bottom", fill: true, class: { place: "h-[85dvh]" } },
  ],
});

/** The paused keyframe of each side (web/styles/tailwind.css): progress 0 is closed, 1 is open. */
export const DRAWER_ANIMATION = {
  top: "animate-drawer-top",
  bottom: "animate-drawer-bottom",
  left: "animate-drawer-left",
  right: "animate-drawer-right",
} as const;

/** What `Drawer` gives its content: whether it is open, and how to ask it to close. */
export const DRAWER_CONTEXT = Symbol("drawer");
export type DrawerContext = { open: () => boolean; close: () => void };

/** A full open slide (ms). A drawer is most of the screen, so it needs a bit more than 300 ms to read as a slide. */
export const DRAWER_OPEN_MS = 360;
/** A full close slide (ms): shorter than the open, so closing feels quick. */
export const DRAWER_CLOSE_MS = 260;
/** Pixels a finger moves before it is a drag and not a tap. */
export const DRAWER_DRAG_THRESHOLD = 6;
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

export type DrawerRole = "panel" | "handle" | "scrim";

/**
 * The engine of every phone drawer. One progress value (0 closed, 1 open) seeks the panel's keyframe and the scrim's.
 * `sync(open)` slides it there; a finger on the panel, the grab bar or the scrim drags it the same way, and past a
 * quarter of its size the release asks the owner to close (`request(false)`). The owner decides and calls `sync`
 * again. `presented(false)` says it is fully closed, so the owner can unmount it.
 */
export function createDrawerMotion(options: {
  side: () => DrawerSide;
  panel: HTMLElement;
  scrim: HTMLElement | null;
  request(open: boolean): void;
  presented(shown: boolean): void;
}) {
  const doc = options.panel.ownerDocument,
    win = doc.defaultView;
  if (!win) throw Error("Missing drawer window");
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  // No CSS animation (a test DOM): the slide still runs in time; there is just nothing to seek.
  const panel = createSeekPlayback(
    options.panel,
    () => `vb-drawer-${options.side()}`,
    () => {},
  );
  const scrim = options.scrim
    ? createSeekPlayback(
        options.scrim,
        () => "vb-drawer-scrim",
        () => {},
      )
    : null;
  let active = true,
    progress = 0,
    target: 0 | 1 | null = null,
    frame: number | null = null,
    shown = false;
  let drag: {
    id: number;
    node: HTMLElement;
    role: DrawerRole;
    x: number;
    y: number;
    size: number;
    initial: number;
    distance: number;
    moving: boolean;
  } | null = null;
  const quiet = new WeakMap<HTMLElement, number>();
  const stops = new Set<() => void>();

  function position(value: number) {
    progress = clamp(value, 0, 1);
    panel.set(progress);
    scrim?.set(progress);
  }
  function show(value: boolean) {
    if (shown === value) return;
    shown = value;
    options.presented(value);
  }
  function stop() {
    if (frame !== null) win!.cancelAnimationFrame(frame);
    frame = null;
  }
  // A slide lasts in proportion to the distance it has left, never under 0.4 of a full one.
  function settle(to: 0 | 1) {
    stop();
    target = to;
    if (to) show(true);
    const from = progress,
      start = win!.performance.now(),
      duration = reduced.matches
        ? 0
        : (to ? DRAWER_OPEN_MS : DRAWER_CLOSE_MS) *
          Math.max(0.4, Math.abs(to - from));
    const run = () => {
      frame = null;
      if (!active || target !== to) return;
      const fraction =
        duration > 0
          ? clamp((win!.performance.now() - start) / duration, 0, 1)
          : 1;
      position(from + (to - from) * drawerEasing(fraction));
      if (fraction < 1) frame = win!.requestAnimationFrame(run);
      else if (!to) show(false);
    };
    run();
  }

  function release() {
    const old = drag;
    drag = null;
    win!.removeEventListener("pointermove", move);
    win!.removeEventListener("pointerup", up);
    win!.removeEventListener("pointercancel", cancel);
    if (old?.node.hasPointerCapture?.(old.id))
      old.node.releasePointerCapture(old.id);
    return old;
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    const side = options.side(),
      dx = event.clientX - drag.x,
      dy = event.clientY - drag.y,
      distance = closingDistance(side, dx, dy),
      across =
        side === "top" || side === "bottom" ? Math.abs(dx) : Math.abs(dy);
    if (!drag.moving) {
      if (Math.max(Math.abs(distance), across) < DRAWER_DRAG_THRESHOLD) return;
      // Sideways is not ours (a swipe on a row); in the panel, towards opening is a scroll.
      if (
        across > Math.abs(distance) ||
        (drag.role === "panel" && distance < 0)
      ) {
        release();
        return;
      }
      stop();
      drag.moving = true;
      try {
        drag.node.setPointerCapture(drag.id);
      } catch {
        /* A synthetic pointer: window listeners still follow it. */
      }
    }
    drag.distance = distance;
    position(drag.initial - distance / drag.size);
  }
  function finish(event: PointerEvent, cancelled: boolean) {
    if (!drag || event.pointerId !== drag.id) return;
    const old = release();
    if (!old?.moving || !active) return;
    quiet.set(old.node, win!.performance.now() + 400);
    const distance = cancelled
      ? old.distance
      : closingDistance(
          options.side(),
          event.clientX - old.x,
          event.clientY - old.y,
        );
    if (drawerEndpoint(1, 0, -distance, old.size) === 0) {
      settle(0);
      options.request(false);
    } else settle(1);
  }
  function up(event: PointerEvent) {
    finish(event, false);
  }
  function cancel(event: PointerEvent) {
    finish(event, true);
  }
  const motionChanged = () => {
    if (active && reduced.matches && target !== null) settle(target);
  };
  reduced.addEventListener("change", motionChanged);

  return {
    /** Slide to open or closed; during a drag it waits for the release. */
    sync(open: boolean) {
      if (!active || drag?.moving) return;
      const to = open ? 1 : 0;
      if (to !== target) settle(to);
    },
    /** The same drag for every part of the drawer. A tap stays a tap (its own click handler acts). */
    bind(node: HTMLElement, role: DrawerRole) {
      const down = (event: PointerEvent) => {
        if (
          !active ||
          drag ||
          target !== 1 ||
          event.button !== 0 ||
          !event.isPrimary
        )
          return;
        const side = options.side();
        if (role === "panel" && scrolledAway(event.target, options.panel, side))
          return;
        const size = axisSize(side, options.panel.getBoundingClientRect());
        if (!(size > 0)) return;
        quiet.delete(node);
        drag = {
          id: event.pointerId,
          node,
          role,
          x: event.clientX,
          y: event.clientY,
          size,
          initial: progress,
          distance: 0,
          moving: false,
        };
        win!.addEventListener("pointermove", move);
        win!.addEventListener("pointerup", up);
        win!.addEventListener("pointercancel", cancel);
      };
      // The click that ends a drag is not a tap.
      const click = (event: MouseEvent) => {
        if (
          (quiet.get(node) ?? 0) >= win!.performance.now() &&
          event.detail > 0
        ) {
          quiet.delete(node);
          event.preventDefault();
          event.stopPropagation();
        }
      };
      node.addEventListener("pointerdown", down);
      node.addEventListener("click", click, true);
      const off = () => {
        if (drag?.node === node) release();
        node.removeEventListener("pointerdown", down);
        node.removeEventListener("click", click, true);
        stops.delete(off);
      };
      stops.add(off);
      return off;
    },
    dispose() {
      if (!active) return;
      active = false;
      stop();
      release();
      for (const off of [...stops]) off();
      panel.dispose();
      scrim?.dispose();
      reduced.removeEventListener("change", motionChanged);
    },
  };
}
export type DrawerMotion = ReturnType<typeof createDrawerMotion>;
