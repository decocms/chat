import { createSeekPlayback } from "../../lib/studio/seekPlayback";
export type RoomAnimation =
  | "vb-room-pane"
  | "vb-room-document-width"
  | "vb-room-document-width-rail"
  | "vb-room-viewport";
/** Authored presentation remains in the sole Tailwind entry. This owns playback only (lib/studio/seekPlayback.ts). */
export const createRoomPlayback = (
  element: HTMLElement,
  name: () => RoomAnimation,
  unavailable: () => void,
) => createSeekPlayback(element, name, unavailable);
export type RoomPlayback = ReturnType<typeof createRoomPlayback>;
