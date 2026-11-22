import { MOBILE_QUERY } from "../../lib/breakpoints";
import { createRoomPlayback, type RoomPlayback } from "./playback";
import {
  clamp,
  documentMaximum,
  documentProgress,
  documentWidth,
  preferredDocumentWidth,
  DOCUMENT_WIDTH_KEY,
  sheetEndpoint,
  sheetEasing,
  SHEET_OPEN_MS,
  SHEET_CLOSE_MS,
  DRAG_THRESHOLD,
  hasSheetSurface,
} from "./model";
import type {
  RoomLayoutBrowser,
  RoomLayoutCells,
  RoomLayoutState,
  RoomSheet,
} from "./types";

/** One mounted layout owns its observers, pending pointers and genuine CSS playback. */
export function createRoomGeometry(options: {
  cells: RoomLayoutCells;
  browser: RoomLayoutBrowser;
  current(): boolean;
  read(): RoomLayoutState;
  changed(patch: Partial<RoomLayoutState>): void;
  settled(sheet: RoomSheet, open: boolean): void;
  mobile(value: boolean): void;
}) {
  const { cells, browser } = options,
    candidateWindow = cells.root.ownerDocument.defaultView;
  if (!candidateWindow) throw Error("Missing room layout window");
  const win: Window = candidateWindow;
  const media = win.matchMedia(MOBILE_QUERY),
    reduced = win.matchMedia("(prefers-reduced-motion: reduce)");
  let active = true,
    rootWidth = cells.root.clientWidth,
    preferred = 380,
    shown: RoomSheet | null = null,
    lastSheet: RoomSheet | null = null,
    motion: number | null = null,
    motionRevision = 0,
    syncRevision = 0;
  const positions: Record<RoomSheet, number> = { doc: 0, side: 0 };
  let opener: HTMLElement | null = null;
  const current = () => active && options.current() && cells.root.isConnected;
  const issue = () => {
    if (current()) options.changed({ animationUnavailable: true });
  };
  const widthName = () =>
    options.read().sidebarCollapsed
      ? ("vb-room-document-width-rail" as const)
      : ("vb-room-document-width" as const);
  const sheetElement = (sheet: RoomSheet) =>
    sheet === "side"
      ? cells.sidebar
      : options.read().pane === "board"
        ? cells.board
        : cells.document;
  const viewport = createRoomPlayback(
      cells.viewport,
      () => "vb-room-viewport",
      issue,
    ),
    scrim = createRoomPlayback(cells.scrim, () => "vb-room-scrim", issue);
  const side = createRoomPlayback(cells.sidebar, () => "vb-room-sheet", issue),
    doc = createRoomPlayback(cells.document, () => "vb-room-pane", issue),
    board = createRoomPlayback(cells.board, () => "vb-room-pane", issue);
  const docWidth = createRoomPlayback(cells.document, widthName, issue),
    boardWidth = createRoomPlayback(cells.board, widthName, issue);
  const extraWidths = new Map<HTMLElement, RoomPlayback>();
  const all: RoomPlayback[] = [
    viewport,
    scrim,
    side,
    doc,
    board,
    docWidth,
    boardWidth,
  ];
  let drag: {
    id: number;
    handle: HTMLElement;
    sheet: RoomSheet;
    opening: boolean;
    initialSheet: RoomSheet | null;
    initialProgress: number;
    pane: RoomLayoutState["pane"];
    start: number;
    last: number;
    height: number;
    moving: boolean;
  } | null = null;
  let resize: {
    id: number;
    input: HTMLInputElement;
    x: number;
    width: number;
  } | null = null;
  const stops = new Set<() => void>();
  const sheetPlayback = (sheet: RoomSheet) =>
    sheet === "side" ? side : options.read().pane === "board" ? board : doc;
  const cancelMotion = () => {
    motionRevision++;
    if (motion !== null) win.cancelAnimationFrame(motion);
    motion = null;
  };
  function position(sheet: RoomSheet, value: number) {
    positions[sheet] = clamp(value, 0, 1);
    sheetPlayback(sheet).set(positions[sheet]);
    // During a swap (side → doc) one sheet is always over the room, so the
    // backdrop stays on; otherwise it follows the sheet.
    scrim.set(leaving ? 1 : Math.max(positions.doc, positions.side));
  }
  function present(sheet: RoomSheet | null) {
    shown = sheet;
    options.changed({ presentedSheet: sheet });
  }
  // A sheet slides for a time in proportion to the distance it has left, so a
  // short release does not crawl and a reversed slide keeps its speed.
  const slideTime = (target: 0 | 1, distance: number) =>
    (target ? SHEET_OPEN_MS : SHEET_CLOSE_MS) * Math.max(0.4, distance);
  let leaving: { sheet: RoomSheet; frame: number | null } | null = null;
  function stopLeaving() {
    if (!leaving) return;
    if (leaving.frame !== null) win.cancelAnimationFrame(leaving.frame);
    leaving = null;
    if (active) options.changed({ leavingSheet: null });
  }
  // The old sheet slides out while the new one slides in; it stays visible
  // (leavingSheet) until it is fully out.
  function slideOut(sheet: RoomSheet) {
    stopLeaving();
    const start = positions[sheet],
      time = win.performance.now(),
      duration = slideTime(0, start),
      own = { sheet, frame: null as number | null };
    leaving = own;
    options.changed({ leavingSheet: sheet });
    const run = () => {
      own.frame = null;
      if (!current() || leaving !== own) return;
      const fraction = reduced.matches
        ? 1
        : clamp((win.performance.now() - time) / duration, 0, 1);
      position(sheet, start * (1 - sheetEasing(fraction)));
      if (fraction < 1) own.frame = win.requestAnimationFrame(run);
      else stopLeaving();
    };
    run();
  }
  function settle(sheet: RoomSheet, target: 0 | 1) {
    cancelMotion();
    present(sheet);
    const start = positions[sheet],
      time = win.performance.now(),
      duration = slideTime(target, Math.abs(target - start)),
      ticket = motionRevision;
    const run = () => {
      motion = null;
      if (!current() || ticket !== motionRevision) return;
      const fraction = reduced.matches
        ? 1
        : clamp((win.performance.now() - time) / duration, 0, 1);
      position(sheet, start + (target - start) * sheetEasing(fraction));
      if (fraction < 1) motion = win.requestAnimationFrame(run);
      else if (!target) {
        present(null);
        const focused = cells.root.ownerDocument.activeElement;
        if (
          opener?.isConnected &&
          opener.getClientRects().length &&
          (focused === cells.root.ownerDocument.body ||
            (focused && sheetElement(sheet).contains(focused))) &&
          !cells.root.ownerDocument.querySelector(
            "dialog[open], [data-dialog-content], [data-alert-dialog-content]",
          )
        )
          opener.focus({ preventScroll: true });
        opener = null;
      }
    };
    run();
  }
  function releaseDrag() {
    const old = drag;
    drag = null;
    win.removeEventListener("pointermove", move);
    win.removeEventListener("pointerup", end);
    win.removeEventListener("pointercancel", cancel);
    if (old?.handle.hasPointerCapture(old.id))
      old.handle.releasePointerCapture(old.id);
    if (active) options.changed({ draggingSheet: null });
    return old;
  }
  function move(event: PointerEvent) {
    if (!drag || event.pointerId !== drag.id) return;
    if (!current() || !drag.handle.isConnected || !media.matches) {
      releaseDrag();
      return;
    }
    drag.last = event.clientY;
    if (!drag.moving && Math.abs(drag.last - drag.start) < DRAG_THRESHOLD)
      return;
    if (!drag.moving) {
      drag.handle.setPointerCapture(drag.id);
      drag.moving = true;
    }
    position(
      drag.sheet,
      drag.initialProgress + (drag.last - drag.start) / drag.height,
    );
  }
  function finish(event: PointerEvent, cancelled: boolean) {
    if (!drag || event.pointerId !== drag.id) return;
    const old = releaseDrag();
    if (!old || !current()) return;
    if (!old.moving) {
      if (old.initialSheet === null) settle(old.sheet, 0);
      // A tap during the slide stopped it; finish the slide to open.
      else if (options.read().sheet === old.sheet && positions[old.sheet] < 1)
        settle(old.sheet, 1);
      return;
    }
    suppress.set(old.handle, win.performance.now() + 400);
    const endpoint = sheetEndpoint(
      old.opening ? 0 : 1,
      old.start,
      cancelled ? old.last : event.clientY,
      old.height,
    );
    options.settled(old.sheet, endpoint === 1);
    // A drag only previews: its release always ends fully open or fully closed.
    // A short drag on an open sheet keeps the same sheet, so sync() does not
    // settle it; settle it back to open here.
    if (options.read().sheet === old.sheet) settle(old.sheet, 1);
    // A short opening drag creates no history entry; it still settles visibly.
    else if (endpoint === 0) settle(old.sheet, 0);
  }
  function end(event: PointerEvent) {
    finish(event, false);
  }
  function cancel(event: PointerEvent) {
    finish(event, true);
  }
  const suppress = new WeakMap<HTMLElement, number>();
  function releaseResize() {
    const old = resize;
    resize = null;
    win.removeEventListener("pointermove", resizeMove);
    win.removeEventListener("pointerup", resizeEnd);
    win.removeEventListener("pointercancel", resizeEnd);
    if (old?.input.hasPointerCapture(old.id))
      old.input.releasePointerCapture(old.id);
    if (active) options.changed({ resizing: false });
  }
  function save(value: number) {
    if (!current() || !Number.isFinite(value)) return;
    preferred = documentWidth(
      value,
      rootWidth,
      options.read().sidebarCollapsed,
    );
    try {
      browser.storage?.setItem(DOCUMENT_WIDTH_KEY, String(preferred));
    } catch {
      /* Visible resize remains usable. */
    }
    measure();
  }
  function resizeMove(event: PointerEvent) {
    if (resize?.id === event.pointerId) {
      if (!current() || !resize.input.isConnected) {
        releaseResize();
        return;
      }
      save(resize.width + resize.x - event.clientX);
    }
  }
  function resizeEnd(event: PointerEvent) {
    if (resize?.id === event.pointerId) releaseResize();
  }
  function measure() {
    if (!current()) return;
    rootWidth = cells.root.clientWidth;
    const value = options.read(),
      width = documentWidth(preferred, rootWidth, value.sidebarCollapsed);
    options.changed({
      documentWidth: width,
      documentMaximum: documentMaximum(rootWidth, value.sidebarCollapsed),
    });
    const available = cells.root.clientHeight,
      rect = cells.root.getBoundingClientRect(),
      visual = win.visualViewport;
    const visible = visual
      ? Math.min(
          available,
          Math.max(0, visual.offsetTop + visual.height - rect.top),
        )
      : available;
    viewport.set(available > 0 ? visible / available : 1);
    if (value.mobile) {
      docWidth.suspend();
      boardWidth.suspend();
    } else if (
      value.documentVisible &&
      !(value.boardFull && value.pane === "board")
    ) {
      const activeWidth = value.pane === "board" ? boardWidth : docWidth;
      (value.pane === "board" ? docWidth : boardWidth).suspend();
      activeWidth.set(
        documentProgress(width, rootWidth, value.sidebarCollapsed),
      );
    } else {
      docWidth.suspend();
      boardWidth.suspend();
    }
    if (value.mobile && win.scrollY) win.scrollTo(0, 0);
    for (const [node, player] of extraWidths) {
      if (value.mobile || !node.isConnected) player.suspend();
      else
        player.set(documentProgress(width, rootWidth, value.sidebarCollapsed));
    }
  }
  function sync(value: RoomLayoutState) {
    if (!current()) return;
    // Full Board replaces the document cell. There is no stylesheet-created
    // sheet animation on that hidden/full-width target to finish seeking.
    if (shown && !hasSheetSurface(shown, value)) {
      cancelMotion();
      stopLeaving();
      releaseDrag();
      doc.suspend();
      board.suspend();
      scrim.suspend();
      positions.doc = 0;
      lastSheet = null;
      present(null);
    }
    const interrupted =
      drag &&
      (drag.pane !== value.pane ||
        drag.initialSheet !== value.sheet ||
        !value.mobile);
    if (interrupted) {
      releaseDrag();
      if (value.mobile && shown) settle(shown, value.sheet === shown ? 1 : 0);
    }
    const target =
      value.mobile && value.sheet && hasSheetSurface(value.sheet, value)
        ? value.sheet
        : null;
    if (!value.mobile) {
      cancelMotion();
      stopLeaving();
      releaseResize();
      side.suspend();
      doc.suspend();
      board.suspend();
      scrim.suspend();
      if (shown) present(null);
      positions.doc = positions.side = 0;
      lastSheet = null;
    } else if (!drag && target !== lastSheet) {
      const previous = shown;
      lastSheet = target;
      if (target) {
        const focused = cells.root.ownerDocument.activeElement;
        if (
          !previous &&
          focused instanceof HTMLElement &&
          (focused instanceof HTMLButtonElement ||
            focused instanceof HTMLAnchorElement) &&
          !sheetElement(target).contains(focused)
        )
          opener = focused;
        if (previous && previous !== target) slideOut(previous);
        settle(target, 1);
      } else if (previous) settle(previous, 0);
    }
    const ticket = ++syncRevision;
    browser.enqueue(() => {
      if (current() && ticket === syncRevision) {
        measure();
        if (shown && value.mobile && !drag && motion === null)
          position(shown, positions[shown]);
      }
    });
  }
  const observer = new ResizeObserver(measure);
  observer.observe(cells.root);
  const viewportChanged = () => {
    if (current()) measure();
  };
  const mediaChanged = () => {
    if (!current()) return;
    options.mobile(media.matches);
    sync(options.read());
  };
  const motionChanged = () => {
    if (current() && reduced.matches && shown)
      settle(shown, options.read().sheet === shown ? 1 : 0);
  };
  const escape = (event: KeyboardEvent) => {
    const sheet = options.read().sheet;
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      !current() ||
      !sheet ||
      cells.root.ownerDocument.querySelector(
        // An open context menu (e.g. a pinned row's) owns Escape: it closes the menu, not the sheet.
        "dialog[open], [data-dialog-content], [data-alert-dialog-content], [data-context-menu-content]",
      )
    )
      return;
    event.preventDefault();
    options.settled(sheet, false);
  };
  win.visualViewport?.addEventListener("resize", viewportChanged);
  win.visualViewport?.addEventListener("scroll", viewportChanged);
  win.addEventListener("resize", viewportChanged);
  media.addEventListener("change", mediaChanged);
  reduced.addEventListener("change", motionChanged);
  cells.root.ownerDocument.addEventListener("keydown", escape);
  preferred = preferredDocumentWidth(browser.storage);
  options.mobile(media.matches);
  measure();
  return {
    sync,
    bindDocumentWidth(node: HTMLElement) {
      if (!current() || !node.isConnected) return () => {};
      extraWidths.get(node)?.dispose();
      const player = createRoomPlayback(node, widthName, issue);
      extraWidths.set(node, player);
      measure();
      return () => {
        if (extraWidths.get(node) === player) {
          extraWidths.delete(node);
          player.dispose();
        }
      };
    },
    cancelGestures() {
      releaseDrag();
      releaseResize();
    },
    bindHandle(node: HTMLElement, sheet: RoomSheet, opening: boolean) {
      let owned = true;
      const down = (event: PointerEvent) => {
        if (
          !owned ||
          !current() ||
          !node.isConnected ||
          !media.matches ||
          drag ||
          event.button !== 0 ||
          !event.isPrimary
        )
          return;
        const value = options.read();
        if (
          opening
            ? value.sheet !== null || value.boardFull
            : value.sheet !== sheet
        )
          return;
        // A closing handle is inside its sheet, or is the backdrop under the
        // title menu: a swipe up on the glass slides the menu away (#3786).
        if (
          !opening &&
          !sheetElement(sheet).contains(node) &&
          !(sheet === "side" && node === cells.scrim)
        )
          return;
        const height = sheetElement(sheet).getBoundingClientRect().height;
        if (!(height > 0)) return;
        cancelMotion();
        suppress.delete(node);
        drag = {
          id: event.pointerId,
          handle: node,
          sheet,
          opening,
          initialSheet: value.sheet,
          initialProgress: positions[sheet],
          pane: value.pane,
          start: event.clientY,
          last: event.clientY,
          height,
          moving: false,
        };
        present(sheet);
        options.changed({ draggingSheet: sheet });
        win.addEventListener("pointermove", move);
        win.addEventListener("pointerup", end);
        win.addEventListener("pointercancel", cancel);
      };
      const click = (event: MouseEvent) => {
        if (
          (suppress.get(node) ?? 0) >= win.performance.now() &&
          event.detail > 0
        ) {
          suppress.delete(node);
          event.preventDefault();
          event.stopPropagation();
        }
      };
      node.addEventListener("pointerdown", down);
      node.addEventListener("click", click, true);
      const stop = () => {
        if (!owned) return;
        owned = false;
        if (drag?.handle === node) releaseDrag();
        node.removeEventListener("pointerdown", down);
        node.removeEventListener("click", click, true);
        stops.delete(stop);
      };
      stops.add(stop);
      return stop;
    },
    bindWidthInput(node: HTMLInputElement) {
      let owned = true;
      const allowed = () =>
        owned &&
        current() &&
        node.isConnected &&
        !media.matches &&
        options.read().documentVisible &&
        !(options.read().boardFull && options.read().pane === "board");
      const down = (event: PointerEvent) => {
        if (
          !allowed() ||
          media.matches ||
          resize ||
          event.button !== 0 ||
          !event.isPrimary
        )
          return;
        event.preventDefault();
        node.focus({ preventScroll: true });
        node.setPointerCapture(event.pointerId);
        resize = {
          id: event.pointerId,
          input: node,
          x: event.clientX,
          width: options.read().documentWidth,
        };
        options.changed({ resizing: true });
        win.addEventListener("pointermove", resizeMove);
        win.addEventListener("pointerup", resizeEnd);
        win.addEventListener("pointercancel", resizeEnd);
      };
      const input = () => {
        if (allowed()) save(node.valueAsNumber);
      };
      const reset = () => {
        if (allowed()) save(380);
      };
      const key = (event: KeyboardEvent) => {
        if (
          !allowed() ||
          (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
        )
          return;
        event.preventDefault();
        save(
          options.read().documentWidth + (event.key === "ArrowLeft" ? 24 : -24),
        );
      };
      node.addEventListener("pointerdown", down);
      node.addEventListener("input", input);
      node.addEventListener("dblclick", reset);
      node.addEventListener("keydown", key);
      const stop = () => {
        if (!owned) return;
        owned = false;
        if (resize?.input === node) releaseResize();
        node.removeEventListener("pointerdown", down);
        node.removeEventListener("input", input);
        node.removeEventListener("dblclick", reset);
        node.removeEventListener("keydown", key);
        stops.delete(stop);
      };
      stops.add(stop);
      return stop;
    },
    dispose() {
      if (!active) return;
      active = false;
      syncRevision++;
      cancelMotion();
      if (leaving?.frame != null) win.cancelAnimationFrame(leaving.frame);
      leaving = null;
      releaseDrag();
      releaseResize();
      observer.disconnect();
      for (const stop of [...stops]) stop();
      for (const owner of all) owner.dispose();
      for (const owner of extraWidths.values()) owner.dispose();
      extraWidths.clear();
      win.visualViewport?.removeEventListener("resize", viewportChanged);
      win.visualViewport?.removeEventListener("scroll", viewportChanged);
      win.removeEventListener("resize", viewportChanged);
      media.removeEventListener("change", mediaChanged);
      reduced.removeEventListener("change", motionChanged);
      cells.root.ownerDocument.removeEventListener("keydown", escape);
    },
  };
}
export type RoomGeometry = ReturnType<typeof createRoomGeometry>;
