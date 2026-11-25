import { writable } from "svelte/store";

/**
 * The Home's open item shows a thing beside its thread (an app, a file, the
 * doc): the shell folds the DM list away so the Inbox list, the thing and the
 * thread fit side by side. It comes back when the thing closes or the Home
 * goes. Desktop only.
 */
export const homeArtifactOpen = writable(false);
