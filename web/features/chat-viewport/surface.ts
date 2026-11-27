import type { ChatSurface } from "./controller";
/** Hover-only elements (`data-chat-hover-only`, the floating message toolbar): their mount does not move the reader. */
const HOVER_ONLY = "[data-chat-hover-only]";
function hoverOnly(record: MutationRecord) {
  const inside = (node: Node) =>
    node.nodeType === 1
      ? (node as Element).closest(HOVER_ONLY) !== null
      : node.parentElement?.closest(HOVER_ONLY) != null;
  if (record.type !== "childList") return inside(record.target);
  const nodes = [...record.addedNodes, ...record.removedNodes];
  // A removed node is detached, so it is checked by its own attribute (closest() includes the node itself).
  return (
    nodes.length > 0 &&
    nodes.every(
      (node) =>
        inside(record.target) ||
        (node.nodeType === 1 && (node as Element).matches(HOVER_ONLY)) ||
        // Svelte anchors and whitespace around the toolbar block.
        (node.nodeType !== 1 && !node.textContent?.trim()),
    )
  );
}
/** How far from the chat's middle a revealed message may sit and still count as centered (px). */
const CENTER_SLACK = 24;
/** Scroll/measurement interop only: no first-party style or DOM presentation builder. */
export function createChatSurface(element: HTMLElement): ChatSurface {
  const reducedMotion = () =>
    !!element.ownerDocument.defaultView?.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  const visible = () =>
    element.isConnected &&
    element.clientHeight > 0 &&
    element.getClientRects().length > 0;
  return {
    connected: visible,
    metrics: () => ({
      top: element.scrollTop,
      height: element.scrollHeight,
      client: element.clientHeight,
    }),
    top(value) {
      if (visible()) element.scrollTop = value;
    },
    message(id) {
      const target = element.querySelector<HTMLElement>(`#m${id}`);
      return target
        ? {
            reveal(instant = false) {
              if (visible() && target.isConnected && element.contains(target))
                target.scrollIntoView({
                  block: "center",
                  behavior: instant || reducedMotion() ? "instant" : "smooth",
                });
            },
            centered() {
              if (!visible() || !target.isConnected) return true;
              const box = target.getBoundingClientRect(),
                frame = element.getBoundingClientRect(),
                offset =
                  box.top + box.height / 2 - (frame.top + frame.height / 2),
                room = element.scrollHeight - element.clientHeight;
              // As close as the scroll goes: a message near either end of the history cannot reach the middle.
              return (
                Math.abs(offset) <= CENTER_SLACK ||
                (offset < 0 && element.scrollTop <= 0) ||
                (offset > 0 && element.scrollTop >= room - 1)
              );
            },
            highlight() {
              if (visible() && target.isConnected && element.contains(target))
                target.dispatchEvent(new CustomEvent("vb:message-highlight"));
            },
          }
        : null;
    },
    listen(scroll, growth, older) {
      let active = true;
      // The "Carregando…" line at the top loads older messages when it comes within 150px of view (Gimenes #6078).
      // It is observed again after each change, so a window that does not fill the chat keeps loading by itself.
      // The test DOM has no IntersectionObserver; every supported browser does.
      const near =
        typeof IntersectionObserver === "undefined"
          ? null
          : new IntersectionObserver(
              (entries) => {
                if (
                  active &&
                  element.isConnected &&
                  entries.some((entry) => entry.isIntersecting)
                )
                  older();
              },
              { root: element, rootMargin: "150px 0px 0px 0px" },
            );
      const resized = () => {
        if (active && element.isConnected) growth();
      };
      // A message under the pointer grows because its hover opened the reaction row: following the bottom then
      // moved the whole conversation up under the pointer, and a tall image left the hover and came back in a loop
      // (Gui #5740). The room opens below it instead.
      // ponytail: a message that streams while hovered does not follow the bottom until the pointer leaves it.
      const resize = new ResizeObserver((entries) => {
        if (
          !entries.every(
            (entry) =>
              entry.target !== element && entry.target.matches(":hover"),
          )
        )
          resized();
      });
      const observe = () => {
        resize.disconnect();
        resize.observe(element);
        for (const child of element.children) resize.observe(child);
        near?.disconnect();
        const line = element.querySelector("[data-chat-older]");
        if (line) near?.observe(line);
      };
      const mutation = new MutationObserver((records) => {
        if (!active || !element.isConnected) return;
        // A message's hover toolbar mounts while a wheel moves messages under the pointer, before the scroll
        // event unpins the chat: growth() then pulled the reader back to the bottom.
        if (records.every(hoverOnly)) return;
        observe();
        growth();
      });
      observe();
      mutation.observe(element, { childList: true, subtree: true });
      element.addEventListener("scroll", scroll);
      element.ownerDocument.fonts?.addEventListener("loadingdone", resized);
      return () => {
        if (!active) return;
        active = false;
        resize.disconnect();
        near?.disconnect();
        mutation.disconnect();
        element.removeEventListener("scroll", scroll);
        element.ownerDocument.fonts?.removeEventListener(
          "loadingdone",
          resized,
        );
      };
    },
  };
}
