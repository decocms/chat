/** Lifecycle-owned touch gestures. Finite Tailwind steps replace host-authored inline transforms. */
import { fromRoomEdge } from "../room-shell/edgeBack";
import { MOBILE_QUERY } from "../../lib/breakpoints";
/** How far right a swipe goes to reply. */
const REPLY_DX = 60;
/** The message follows the finger up to FREE_DX, then with resistance (like WhatsApp), up to the last step. */
const FREE_DX = 64;
const RESIST = 0.35;
/** One class per 4 px (Tailwind's spacing), 0 to 96 px: the message follows the finger in small steps. Written in
 *  full so Tailwind finds them. */
const STEPS = [
  "translate-x-0",
  "translate-x-1",
  "translate-x-2",
  "translate-x-3",
  "translate-x-4",
  "translate-x-5",
  "translate-x-6",
  "translate-x-7",
  "translate-x-8",
  "translate-x-9",
  "translate-x-10",
  "translate-x-11",
  "translate-x-12",
  "translate-x-13",
  "translate-x-14",
  "translate-x-15",
  "translate-x-16",
  "translate-x-17",
  "translate-x-18",
  "translate-x-19",
  "translate-x-20",
  "translate-x-21",
  "translate-x-22",
  "translate-x-23",
  "translate-x-24",
];
/** Letting go slides the message back (Gimenes #4533); while the finger moves, it follows with no delay. */
const SETTLE = [
  "transition-[translate,background-color]",
  "duration-200",
  "ease-out",
];
const SETTLE_MS = 220;
/** While a message moves, the timeline clips sideways: no horizontal scroll bar (Gimenes #4533). Only then, so the
 *  message toolbar and popovers are not cut at other times. */
const CLIP = "overflow-x-clip";
/** Where the finger is → where the message is, in px. */
export const swipeOffset = (dx: number) =>
  Math.min(
    96,
    dx <= FREE_DX ? Math.max(0, dx) : FREE_DX + (dx - FREE_DX) * RESIST,
  );
/** Holding a message this long, without moving more than HOLD_SLOP px, opens its actions (Gimenes #4402). */
export const HOLD_MS = 500;
const HOLD_SLOP = 8;
/** A message's touch gestures (Gimenes #4440): a right swipe replies; holding it opens the actions sheet, which has
 *  everything else (react, thread, copy, link, edit, delete). The left swipe (copy and link) and the long right swipe
 *  (thread) are gone: the sheet has them. */
export function swipeMessage(
  node: HTMLElement,
  callbacks: {
    reply: () => void;
    /** A long press (HOLD_MS) on a touch screen: the message's actions sheet. */
    hold?: () => void;
    enabled?: boolean;
  },
) {
  const phone = node.ownerDocument.defaultView?.matchMedia(MOBILE_QUERY);
  let active = true,
    held = false,
    holdTimer: ReturnType<typeof setTimeout> | undefined,
    settleTimer: ReturnType<typeof setTimeout> | undefined,
    start: {
      x: number;
      y: number;
      dx: number;
      locked: boolean;
      ready: boolean;
    } | null = null;
  const timeline = () => node.closest("[data-chat-timeline]");
  const reset = () => {
    node.classList.remove(...STEPS);
    node.removeAttribute("data-swipe");
    node.removeAttribute("data-swipe-dir");
  };
  /** Back to rest: with `animate`, the message slides back first. */
  const release = (animate: boolean) => {
    clearTimeout(settleTimer);
    if (animate && STEPS.slice(1).some((c) => node.classList.contains(c))) {
      node.classList.add(...SETTLE);
      reset();
      settleTimer = setTimeout(() => {
        node.classList.remove(...SETTLE);
        timeline()?.classList.remove(CLIP);
      }, SETTLE_MS);
      return;
    }
    node.classList.remove(...SETTLE);
    reset();
    timeline()?.classList.remove(CLIP);
  };
  const stopHold = () => {
    clearTimeout(holdTimer);
    holdTimer = undefined;
  };
  const fireHold = () => {
    stopHold();
    if (!active || held || !callbacks.hold) return;
    held = true;
    start = null;
    release(false);
    navigator.vibrate?.(10);
    callbacks.hold();
  };
  const begin = (event: TouchEvent) => {
    start = null;
    held = false;
    stopHold();
    release(false);
    const target = event.target;
    if (
      callbacks.enabled === false ||
      !(target instanceof Element) ||
      target.closest(
        "pre,table,iframe,[data-chat-embed],button,a,input,textarea,select",
      ) ||
      event.touches.length !== 1
    )
      return;
    if (fromRoomEdge(event.touches[0].clientX, phone?.matches ?? false)) return;
    start = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
      dx: 0,
      locked: false,
      ready: false,
    };
    if (callbacks.hold) holdTimer = setTimeout(fireHold, HOLD_MS);
  };
  const move = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length !== 1) {
      start = null;
      stopHold();
      release(true);
      return;
    }
    const dx = event.touches[0].clientX - start.x,
      dy = event.touches[0].clientY - start.y;
    if (Math.hypot(dx, dy) > HOLD_SLOP) stopHold();
    if (!start.locked) {
      if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
        start = null;
        return;
      }
      // Only a right swipe moves the message; a left one is left to the page (nothing to do there now).
      if (dx < 10 || dx <= Math.abs(dy)) return;
      start.locked = true;
      timeline()?.classList.add(CLIP);
    }
    event.preventDefault();
    start.dx = Math.max(0, dx);
    node.classList.remove(...STEPS);
    node.classList.add(STEPS[Math.round(swipeOffset(start.dx) / 4)]);
    // The swipe shows what letting go does (Gui #2668): the reply icon past the left edge grows, and fills at the
    // point where letting go replies, with one short vibration when it gets there (like WhatsApp).
    const ready = start.dx > REPLY_DX;
    if (ready && !start.ready) navigator.vibrate?.(8);
    start.ready = ready;
    node.dataset.swipeDir = "right";
    node.dataset.swipe = ready ? "reply" : "tracking";
  };
  const end = (event: TouchEvent) => {
    const gesture = start;
    start = null;
    stopHold();
    release(true);
    // The hold opened the sheet: lifting the finger is not also a tap on what is under it.
    if (held) {
      if (event.cancelable) event.preventDefault();
      return;
    }
    if (active && gesture && gesture.dx > REPLY_DX) callbacks.reply();
  };
  const cancel = () => {
    start = null;
    stopHold();
    release(true);
  };
  // Android's own long press is a contextmenu event: the same sheet, not the browser's menu, and only one of them.
  const context = (event: MouseEvent) => {
    if (!callbacks.hold || (!start && !held)) return;
    event.preventDefault();
    fireHold();
  };
  node.addEventListener("touchstart", begin, { passive: true });
  node.addEventListener("touchmove", move, { passive: false });
  node.addEventListener("touchend", end);
  node.addEventListener("touchcancel", cancel);
  node.addEventListener("contextmenu", context);
  return {
    update(next: typeof callbacks) {
      callbacks = next;
    },
    destroy() {
      active = false;
      start = null;
      stopHold();
      clearTimeout(settleTimer);
      release(false);
      node.removeEventListener("touchstart", begin);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", cancel);
      node.removeEventListener("contextmenu", context);
    },
  };
}
