import { writable } from "svelte/store";

/** How long a thread that you just started from a message offers "Desfazer" (Gimenes #4310). */
export const THREAD_UNDO_MS = 5_000;

/** The thread that you just started with "Criar thread" on a message. The message view sets it, and the new
 *  thread's view shows "Thread criada · Desfazer" while it is set, younger than THREAD_UNDO_MS and still empty.
 *  It is a store because the click opens the thread: the message that you clicked is no longer on the screen. */
export const startedThread = writable<{ id: string; at: number } | null>(null);
