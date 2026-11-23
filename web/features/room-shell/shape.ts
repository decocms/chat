// Shapes that a room and its loading state (RoomSkeleton) draw the same way,
// so nothing moves when the room finishes loading (Gimenes #3938). The real
// components and the skeleton both import these; change a shape here, not in
// one of them. The composer's shape is in composer/shape.ts.

/** A message (chat/Message.svelte): the avatar column, then the body. */
export const MESSAGE_ROW = "flex items-start gap-4";
/** The avatar column of a message: 40px, also when a follow-up shows only the time. */
export const MESSAGE_AVATAR = "w-10 shrink-0";
