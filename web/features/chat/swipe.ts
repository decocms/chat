/** Lifecycle-owned touch gestures. Finite Tailwind steps replace host-authored inline transforms. */
import { fromRoomEdge } from "../room-shell/edgeBack";
import { MOBILE_QUERY } from "../../lib/breakpoints";
/** How far right a swipe goes to reply. */
const REPLY_DX = 60;
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
    start: { x: number; y: number; dx: number; locked: boolean } | null = null;
  const classes = ["translate-x-5", "translate-x-10", "translate-x-20"];
  const reset = () => {
    node.classList.remove(...classes);
    node.removeAttribute("data-swipe");
    node.removeAttribute("data-swipe-dir");
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
    reset();
    navigator.vibrate?.(10);
    callbacks.hold();
  };
  const begin = (event: TouchEvent) => {
    start = null;
    held = false;
    stopHold();
    reset();
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
    };
    if (callbacks.hold) holdTimer = setTimeout(fireHold, HOLD_MS);
  };
  const move = (event: TouchEvent) => {
    if (!start) return;
    if (event.touches.length !== 1) {
      start = null;
      stopHold();
      reset();
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
    }
    event.preventDefault();
    start.dx = Math.max(0, dx);
    reset();
    node.classList.add(
      classes[start.dx > REPLY_DX ? 2 : start.dx > 30 ? 1 : 0],
    );
    // The swipe shows what letting go does (Gui #2668): "Reply →" past the left edge.
    node.dataset.swipeDir = "right";
    node.dataset.swipe = start.dx > REPLY_DX ? "reply" : "tracking";
  };
  const end = (event: TouchEvent) => {
    const gesture = start;
    start = null;
    stopHold();
    reset();
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
    reset();
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
      cancel();
      node.removeEventListener("touchstart", begin);
      node.removeEventListener("touchmove", move);
      node.removeEventListener("touchend", end);
      node.removeEventListener("touchcancel", cancel);
      node.removeEventListener("contextmenu", context);
    },
  };
}
