// Shapes that a room and its loading state (RoomSkeleton) draw the same way,
// so nothing moves when the room finishes loading (Gimenes #3938). The real
// components and the skeleton both import these; change a shape here, not in
// one of them. The composer's shape is in composer/shape.ts.

/** A message (chat/Message.svelte): the avatar column, then the body. */
export const MESSAGE_ROW = "flex items-start gap-4";
/** The avatar column of a message: 40px, also when a follow-up shows only the time. */
export const MESSAGE_AVATAR = "w-10 shrink-0";

/** An epic row's task progress (navigation/EpicTree.svelte): a 2px bar under the title, on a gray track. */
export const EPIC_PROGRESS =
  "pointer-events-none absolute right-3 bottom-1 left-11 h-[3px] w-auto rounded-full bg-foreground/10";
