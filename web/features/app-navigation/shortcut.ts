/** The keys that open the search dialog, as this computer writes them. */
export const searchShortcut =
  typeof navigator !== "undefined" &&
  /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent)
    ? "⌘K"
    : "Ctrl+K";
