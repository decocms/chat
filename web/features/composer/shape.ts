// The composer's shape, in one place for two components: the composer itself
// (ComposerForm, ChatField) and the room's loading state (RoomSkeleton), so the
// room does not jump when it finishes loading (Gimenes #3905). A change here
// changes both. Do not give either component its own copy of these classes.

/** Desktop: the room's composer cell, inset from the chat's edge (RoomLayoutFrame). */
export const COMPOSER_SLOT = "mr-2 px-2";

/** The strip at the foot of the chat that holds the box. */
export const COMPOSER_FRAME = "px-3 pt-1 pb-3 md:px-2 md:pb-2";

/** The box: its corners and its fill. */
export const COMPOSER_BOX = "rounded-3xl bg-composer md:rounded-xl";

/** The box's row of controls: 56px tall with one line (12px + a 32px control + 12px). */
export const COMPOSER_ROW = "min-h-14 px-1.5 py-3";
