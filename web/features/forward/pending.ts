/**
 * A forward on its way to the composer of another room or thread. The room you forward from writes it and goes
 * there; the room scope of the destination takes it when it syncs that thread, puts the text and the files in its
 * composer (`composeIn`) and focuses it. Nothing is sent: the person presses Enter. Memory only: a reload drops it.
 */
export type PendingForward = Readonly<{
  account: string;
  roomId: string;
  thread: string;
  text: string;
  files: readonly File[];
  at: number;
}>;
/** A forward that did not arrive in this time (the room did not open) is dropped. */
export const FORWARD_PENDING_MS = 60_000;
let pending: PendingForward | null = null;

export function holdForward(value: PendingForward) {
  pending = value;
}

/** The forward for this account, room and thread, once: it is removed when it is taken. */
export function takeForward(
  account: string,
  roomId: string,
  thread: string,
  now = Date.now(),
): PendingForward | null {
  const value = pending;
  if (!value) return null;
  if (now - value.at > FORWARD_PENDING_MS) {
    pending = null;
    return null;
  }
  if (
    value.account !== account ||
    value.roomId !== roomId ||
    value.thread !== thread
  )
    return null;
  pending = null;
  return value;
}
