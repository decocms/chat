import { get, writable } from "svelte/store";

/** The one message being edited in place, like Discord (only one at a time). A store because the composer opens it
 *  too (ArrowUp in an empty composer edits your last message), and the composer is not inside the message list.
 *  `returnTo` is what had focus before: closing the editor gives focus back to it (the composer, after ArrowUp). */
export type MessageEdit = {
  room: string;
  id: number;
  returnTo: HTMLElement | null;
};
export const editingMessage = writable<MessageEdit | null>(null);

export function startEditing(room: string, id: number) {
  const focused = document.activeElement;
  editingMessage.set({
    room,
    id,
    returnTo: focused instanceof HTMLElement ? focused : null,
  });
}

/** Closes the editor of this message (none other), and gives focus back to where it came from. */
export function stopEditing(id: number) {
  const current = get(editingMessage);
  if (current?.id !== id) return;
  editingMessage.set(null);
  if (current.returnTo?.isConnected) current.returnTo.focus();
}
