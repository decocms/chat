import { writable } from "svelte/store";

/**
 * Expand: the open pane (an app, a file) takes the whole room. The sidebar,
 * the top bar and the chat step aside and the composer floats at its foot, so
 * you keep prompting while you look (Leandro #4340). Desktop only; Esc or the
 * pane's own button puts the room back.
 */
export const paneFocus = writable(false);
