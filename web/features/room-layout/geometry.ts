import { MOBILE_QUERY } from "../../lib/breakpoints";
import { createRoomPlayback, type RoomPlayback } from "./playback";
import {
  clamp,
  documentMaximum,
  documentProgress,
  documentWidth,
  preferredDocumentWidth,
  DOCUMENT_WIDTH_KEY,
  sheetEasing,
  SHEET_OPEN_MS,
  SHEET_CLOSE_MS,
} from "./model";
import type {
  RoomLayoutBrowser,
  RoomLayoutCells,
  RoomLayoutState,
} from "./types";

/**
 * One mounted layout owns its observers, the width resize and genuine CSS playback. On phones it fades the doc pane
 * in where the chat was. The threads drawer is not here: it is a Drawer (lib/studio/drawer.ts), like every phone
 * drawer (Gimenes #6221).
 */
export function createRoomGeometry(options: {
  cells: RoomLayoutCells;
  browser: RoomLayoutBrowser;
  current(): boolean;
  read(): RoomLayoutState;
  changed(patch: Partial<RoomLayoutState>): void;
  /** Escape on the open pane: close it. */
  escaped(): void;
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
    shown = false,
    last = false,
    motion: number | null = null,
    motionRevision = 0,
    syncRevision = 0;
  let position = 0;
  let opener: HTMLElement | null = null;
  const current = () => active && options.current() && cells.root.isConnected;
  const issue = () => {
    if (current()) options.changed({ animationUnavailable: true });
  };
  const widthName = () =>
    options.read().sidebarCollapsed
      ? ("vb-room-document-width-rail" as const)
      : ("vb-room-document-width" as const);
  const viewport = createRoomPlayback(
      cells.viewport,
      () => "vb-room-viewport",
      issue,
    ),
    doc = createRoomPlayback(cells.document, () => "vb-room-pane", issue);
  const docWidth = createRoomPlayback(cells.document, widthName, issue);
  const extraWidths = new Map<HTMLElement, RoomPlayback>();
  const all: RoomPlayback[] = [viewport, doc, docWidth];
  let resize: {
    id: number;
    input: HTMLInputElement;
    x: number;
    width: number;
  } | null = null;
  const stops = new Set<() => void>();
  const cancelMotion = () => {
    motionRevision++;
    if (motion !== null) win.cancelAnimationFrame(motion);
    motion = null;
  };
  function place(value: number) {
    position = clamp(value, 0, 1);
    doc.set(position);
  }
  function present(value: boolean) {
    shown = value;
    options.changed({ presentedSheet: value ? "doc" : null });
  }
  // A slide lasts in proportion to the distance it has left, so a reversed one keeps its speed.
  const slideTime = (target: 0 | 1, distance: number) =>
    (target ? SHEET_OPEN_MS : SHEET_CLOSE_MS) * Math.max(0.4, distance);
  function settle(target: 0 | 1) {
    cancelMotion();
    present(true);
    const start = position,
      time = win.performance.now(),
      duration = slideTime(target, Math.abs(target - start)),
      ticket = motionRevision;
    const run = () => {
      motion = null;
      if (!current() || ticket !== motionRevision) return;
      const fraction = reduced.matches
        ? 1
        : clamp((win.performance.now() - time) / duration, 0, 1);
      place(start + (target - start) * sheetEasing(fraction));
      if (fraction < 1) motion = win.requestAnimationFrame(run);
      else if (!target) {
        present(false);
        const focused = cells.root.ownerDocument.activeElement;
        if (
          opener?.isConnected &&
          opener.getClientRects().length &&
          (focused === cells.root.ownerDocument.body ||
            (focused && cells.document.contains(focused))) &&
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
    if (!value.mobile && value.documentVisible)
      docWidth.set(documentProgress(width, rootWidth, value.sidebarCollapsed));
    else docWidth.suspend();
    if (value.mobile && win.scrollY) win.scrollTo(0, 0);
    for (const [node, player] of extraWidths) {
      if (value.mobile || !node.isConnected) player.suspend();
      else
        player.set(documentProgress(width, rootWidth, value.sidebarCollapsed));
    }
  }
  function sync(value: RoomLayoutState) {
    if (!current()) return;
    const target =
      value.mobile && value.sheet === "doc" && value.documentVisible;
    if (!value.mobile) {
      cancelMotion();
      releaseResize();
      doc.suspend();
      if (shown) present(false);
      position = 0;
      last = false;
    } else if (shown && !value.documentVisible) {
      // The pane closed under it: nothing left to fade.
      cancelMotion();
      doc.suspend();
      position = 0;
      last = false;
      present(false);
    } else if (target !== last) {
      last = target;
      if (target) {
        const focused = cells.root.ownerDocument.activeElement;
        if (
          !shown &&
          focused instanceof HTMLElement &&
          (focused instanceof HTMLButtonElement ||
            focused instanceof HTMLAnchorElement) &&
          !cells.document.contains(focused)
        )
          opener = focused;
        settle(1);
      } else if (shown) settle(0);
    }
    const ticket = ++syncRevision;
    browser.enqueue(() => {
      if (current() && ticket === syncRevision) {
        measure();
        if (shown && value.mobile && motion === null) place(position);
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
      settle(options.read().sheet === "doc" ? 1 : 0);
  };
  const escape = (event: KeyboardEvent) => {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      !current() ||
      options.read().sheet !== "doc" ||
      cells.root.ownerDocument.querySelector(
        // An open context menu (e.g. a pinned row's) owns Escape: it closes the menu, not the sheet.
        "dialog[open], [data-dialog-content], [data-alert-dialog-content], [data-context-menu-content]",
      )
    )
      return;
    event.preventDefault();
    options.escaped();
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
      releaseResize();
    },
    bindWidthInput(node: HTMLInputElement) {
      let owned = true;
      const allowed = () =>
        owned &&
        current() &&
        node.isConnected &&
        !media.matches &&
        options.read().documentVisible;
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
