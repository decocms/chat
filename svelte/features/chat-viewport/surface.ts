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
/** Scroll/measurement interop only: no first-party style or DOM presentation builder. */
export function createChatSurface(element: HTMLElement): ChatSurface {
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
            reveal() {
              if (visible() && target.isConnected && element.contains(target))
                target.scrollIntoView({ block: "center", behavior: "smooth" });
            },
            highlight() {
              if (visible() && target.isConnected && element.contains(target))
                target.dispatchEvent(new CustomEvent("vb:message-highlight"));
            },
          }
        : null;
    },
    listen(scroll, growth) {
      let active = true;
      const resized = () => {
        if (active && element.isConnected) growth();
      };
      const resize = new ResizeObserver(resized);
      const observe = () => {
        resize.disconnect();
        resize.observe(element);
        for (const child of element.children) resize.observe(child);
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
