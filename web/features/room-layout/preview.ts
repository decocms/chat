import { createRoomLayoutBrowser } from "./browser";
import {
  documentClosedBefore,
  documentProgress,
  preferredDocumentWidth,
} from "./model";
import { createRoomPlayback } from "./playback";
import { MOBILE_QUERY } from "../../lib/breakpoints";

/** A loading room's doc cell at the width the room will open with: the same
 * stored preference (vb.docW), clamp and CSS width animation as the real
 * layout's document cell (sidebar expanded, as a room always opens), so the
 * panels don't jump when the state lands. The node carries
 * `animate-room-document-width` and sits right in its inline-size container. */
/** Whether a loading room draws its pane: closed when you left it closed, the
 * same stored choice the room's layout opens with (model.ts). */
export function roomDocumentOpen(win: Window | null | undefined) {
  if (!win) return true;
  return !documentClosedBefore(createRoomLayoutBrowser(win).storage);
}
export function roomDocumentWidth(node: HTMLElement) {
  const win = node.ownerDocument.defaultView,
    root = node.parentElement;
  if (!win || !root) return {};
  const preferred = preferredDocumentWidth(
      createRoomLayoutBrowser(win).storage,
    ),
    playback = createRoomPlayback(
      node,
      () => "vb-room-document-width",
      () => {},
    );
  // Phones hide the cell (no animation to seek), like geometry's mobile branch.
  const media = win.matchMedia(MOBILE_QUERY);
  const measure = () => {
    if (media.matches) playback.suspend();
    else playback.set(documentProgress(preferred, root.clientWidth, false));
  };
  const observer = new ResizeObserver(measure);
  observer.observe(root);
  media.addEventListener("change", measure);
  measure();
  return {
    destroy() {
      observer.disconnect();
      media.removeEventListener("change", measure);
      playback.dispose();
    },
  };
}
