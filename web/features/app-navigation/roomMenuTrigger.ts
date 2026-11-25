import type { Action } from "svelte/action";
/** Where a room's menu opens: the pointer, or nothing (the keyboard: under the row). */
export type MenuPoint = { x: number; y: number };
export type OpenRoomMenu = (trigger: HTMLElement, point?: MenuPoint) => void;
const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 8;
/**
 * A room's row or tile opens the room's menu (like Discord's): a right-click,
 * a ~500 ms touch long press, or Shift+F10 / the ContextMenu key. The
 * trigger is the row's link, so focus goes back to it when the menu closes.
 * A long press that opened the menu is not also a tap on the row.
 */
export const roomMenuTrigger: Action<HTMLElement, OpenRoomMenu | undefined> = (
  node,
  initial,
) => {
  let open = initial;
  let press: {
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null = null;
  let swallowClick = false;
  const target = (event: Event) =>
    (event.target instanceof Element &&
      event.target.closest<HTMLElement>("a,button")) ||
    node.querySelector<HTMLElement>("a,button") ||
    node;
  const cancel = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  const contextmenu = (event: MouseEvent) => {
    if (!open || !node.isConnected) return;
    event.preventDefault();
    // A platform long press (Android) also fires contextmenu: one menu, and no tap after it.
    if (press) swallowClick = true;
    cancel();
    open(target(event), { x: event.clientX, y: event.clientY });
  };
  const pointerdown = (event: PointerEvent) => {
    swallowClick = false;
    cancel();
    if (event.pointerType === "mouse" || !open) return;
    const { clientX: x, clientY: y } = event,
      trigger = target(event);
    press = {
      x,
      y,
      timer: setTimeout(() => {
        press = null;
        if (!open || !node.isConnected) return;
        swallowClick = true;
        open(trigger, { x, y });
      }, LONG_PRESS_MS),
    };
  };
  const pointermove = (event: PointerEvent) => {
    if (
      press &&
      Math.hypot(event.clientX - press.x, event.clientY - press.y) >
        LONG_PRESS_SLOP
    )
      cancel();
  };
  const keydown = (event: KeyboardEvent) => {
    if (!(event.key === "F10" && event.shiftKey) && event.key !== "ContextMenu")
      return;
    if (!open || !node.isConnected) return;
    event.preventDefault();
    open(target(event));
  };
  const click = (event: MouseEvent) => {
    // Keyboard activation (Enter/Space) is never the end of a press.
    if (!swallowClick || event.detail === 0) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  };
  node.addEventListener("contextmenu", contextmenu);
  node.addEventListener("pointerdown", pointerdown);
  node.addEventListener("pointermove", pointermove);
  node.addEventListener("pointerup", cancel);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("keydown", keydown);
  node.addEventListener("click", click, true);
  return {
    update(next) {
      open = next;
    },
    destroy() {
      cancel();
      open = undefined;
      node.removeEventListener("contextmenu", contextmenu);
      node.removeEventListener("pointerdown", pointerdown);
      node.removeEventListener("pointermove", pointermove);
      node.removeEventListener("pointerup", cancel);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("keydown", keydown);
      node.removeEventListener("click", click, true);
    },
  };
};
