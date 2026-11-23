/**
 * Press and hold a room on the rail, then move it: the tile lifts in place
 * and a line shows where it lands; letting go saves the new order
 * (Gimenes #3978). A plain click still opens the room. With a mouse, moving
 * a few pixels also starts the move; on a touch screen, moving before the
 * hold scrolls. Escape puts the room back. The browser's own drag (a ghost of
 * the link and a drop box) is not used.
 */
export type RailSortOptions = {
  /** Called once on letting go: put `from` before or after `to`. */
  onorder: (from: string, to: string, after: boolean) => void;
};

/** How long a press must last before the room moves. */
export const RAIL_SORT_HOLD_MS = 250;
const SLOP = 6;

/** Where a pointer at `y` lands among tiles (top, height, id), skipping the one that moves. */
export function railSortTarget(
  y: number,
  tiles: readonly { id: string; top: number; height: number }[],
  moving: string,
): { to: string; after: boolean } | null {
  const others = tiles.filter((tile) => tile.id !== moving);
  if (!others.length) return null;
  for (const tile of others)
    if (y < tile.top + tile.height / 2) return { to: tile.id, after: false };
  return { to: others.at(-1)!.id, after: true };
}

export function railSort(node: HTMLElement, options: RailSortOptions) {
  let current = options;
  let press: {
    id: string;
    tile: HTMLElement;
    pointer: number;
    x: number;
    y: number;
    touch: boolean;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  let moving: {
    id: string;
    tile: HTMLElement;
    pointer: number;
    y: number;
    target: { to: string; after: boolean } | null;
  } | null = null;

  const tiles = () =>
    [...node.querySelectorAll<HTMLElement>("[data-room-id]")].map((tile) => {
      const rect = tile.getBoundingClientRect();
      return {
        id: tile.dataset.roomId ?? "",
        top: rect.top,
        height: rect.height,
        tile,
      };
    });
  const mark = (target: { to: string; after: boolean } | null) => {
    for (const tile of node.querySelectorAll<HTMLElement>("[data-rail-drop]"))
      delete tile.dataset.railDrop;
    if (!target) return;
    const tile = [...node.querySelectorAll<HTMLElement>("[data-room-id]")].find(
      (item) => item.dataset.roomId === target.to,
    );
    if (tile) tile.dataset.railDrop = target.after ? "after" : "before";
  };
  const clearPress = () => {
    if (press) clearTimeout(press.timer);
    press = null;
  };
  const start = () => {
    if (!press) return;
    const { id, tile, pointer, y } = press;
    clearPress();
    moving = { id, tile, pointer, y, target: null };
    try {
      node.setPointerCapture(pointer);
    } catch {}
    node.dataset.railSorting = "";
    tile.dataset.railMoving = "";
  };
  const finish = (save: boolean) => {
    const done = moving;
    moving = null;
    clearPress();
    delete node.dataset.railSorting;
    mark(null);
    if (!done) return;
    delete done.tile.dataset.railMoving;
    // The press ends with a click on the tile's link: it must not open the
    // room. The click comes in the same task as the pointerup; a later one is
    // a new click.
    const guard = (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };
    node.addEventListener("click", guard, { capture: true, once: true });
    setTimeout(() => node.removeEventListener("click", guard, true), 0);
    if (save && done.target && done.target.to !== done.id)
      current.onorder(done.id, done.target.to, done.target.after);
  };
  const down = (event: PointerEvent) => {
    if (event.button !== 0 || moving) return;
    const tile = (event.target as Element | null)?.closest<HTMLElement>(
      "[data-room-id]",
    );
    if (!tile || !node.contains(tile)) return;
    clearPress();
    press = {
      id: tile.dataset.roomId ?? "",
      tile,
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      touch: event.pointerType === "touch",
      timer: setTimeout(start, RAIL_SORT_HOLD_MS),
    };
  };
  const move = (event: PointerEvent) => {
    if (press && event.pointerId === press.pointer) {
      const far =
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > SLOP;
      if (far) {
        if (press.touch) clearPress();
        else start();
      }
    }
    if (!moving || event.pointerId !== moving.pointer) return;
    event.preventDefault();
    moving.target = railSortTarget(event.clientY, tiles(), moving.id);
    mark(moving.target);
  };
  const up = (event: PointerEvent) => {
    if (press && event.pointerId === press.pointer) clearPress();
    if (moving && event.pointerId === moving.pointer) finish(true);
  };
  const cancel = (event: PointerEvent) => {
    if (press && event.pointerId === press.pointer) clearPress();
    if (moving && event.pointerId === moving.pointer) finish(false);
  };
  const key = (event: KeyboardEvent) => {
    if (moving && event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  };
  // The browser's own drag of the tile's link and picture.
  const nativeDrag = (event: DragEvent) => {
    if ((event.target as Element | null)?.closest("[data-room-id]"))
      event.preventDefault();
  };

  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", cancel);
  node.addEventListener("dragstart", nativeDrag);
  window.addEventListener("keydown", key);
  return {
    update(next: RailSortOptions) {
      current = next;
    },
    destroy() {
      finish(false);
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", cancel);
      node.removeEventListener("dragstart", nativeDrag);
      window.removeEventListener("keydown", key);
    },
  };
}
