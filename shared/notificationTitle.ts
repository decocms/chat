// The title of a notification (the app's own and the web push), like Discord's "person (#channel)" (Gimenes #4253).
// Browser-safe, no backend imports.

export type NotificationFrom = "person" | "agent" | "vibe";

/** Who wrote, then the room: "Ana · Produto" for a person, "Agente · Produto" for an agent (its full name is too long
 *  for a notification), "@vibe · Produto". A DM has no room: only who wrote. */
export function notificationTitle(o: {
  from: NotificationFrom;
  name: string;
  room: string | null;
  en: boolean;
}) {
  const who =
    o.from === "agent"
      ? o.en
        ? "Agent"
        : "Agente"
      : o.from === "vibe"
        ? "@vibe"
        : o.name;
  return o.room ? `${who} · ${o.room}` : who;
}

/** Who a message is from, for its notification. */
export const notificationFrom = (message: {
  author: string;
  kind?: string | null;
}): NotificationFrom =>
  message.author === "ai"
    ? "vibe"
    : message.kind === "agent"
      ? "agent"
      : "person";
