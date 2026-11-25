import { get, writable } from "svelte/store";
import type { ChatMessage } from "../../app/chatTypes";
import { pickMessage } from "./model";

/**
 * Selection mode of "Encaminhar" (forward), like WhatsApp: the messages picked in one thread. A store, as
 * `editingMessage` is, because each message draws its own checkbox and the bar is in the chat.
 * `messages` keeps each picked message as it was when it was picked: an old message can leave the loaded window
 * while the person scrolls, and the package still needs its text. `ranged`: a Shift+click was used (for the event).
 */
export type ForwardSelection = Readonly<{
  room: string;
  thread: string;
  ids: readonly number[];
  anchor: number | null;
  messages: Readonly<Record<number, ChatMessage>>;
  ranged: boolean;
}>;
export const forwardSelection = writable<ForwardSelection | null>(null);
/** The destination picker ("Encaminhar para…") is open. The bar (in the composer's place) opens it; the chat draws it. */
export const forwardPicking = writable(false);

/** "Encaminhar" on a message: selection mode starts with that message picked. */
export function startForward(message: ChatMessage, room: string) {
  forwardSelection.set({
    room,
    thread: message.thread,
    ids: [message.id],
    anchor: message.id,
    messages: { [message.id]: message },
    ranged: false,
  });
}

export function stopForward() {
  forwardSelection.set(null);
  forwardPicking.set(false);
}

/** A click (or a tap) on a message while selection mode is on. `list` is the thread's loaded messages, oldest
 *  first, that can be picked. */
export function clickForward(
  list: readonly ChatMessage[],
  id: number,
  shift: boolean,
) {
  const current = get(forwardSelection);
  if (!current) return;
  const order = list.map((message) => message.id);
  const next = pickMessage(current, order, id, shift);
  if (next === current) return;
  const messages: Record<number, ChatMessage> = {};
  for (const each of next.ids) {
    const message =
      list.find((item) => item.id === each) ?? current.messages[each];
    if (message) messages[each] = message;
  }
  forwardSelection.set({
    ...current,
    ...next,
    messages,
    ranged: current.ranged || (shift && current.anchor !== null),
  });
}
