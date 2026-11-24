import type { Room } from "../../../shared/room";
import { isRecorder } from "../../../shared/call";

/** A Google Meet link, or "" when the text is not one. */
export const meetLink = (text: string) =>
  /^https:\/\/meet\.google\.com\/[a-z0-9-]{3,40}(\?[\w=&%.-]*)?$/i.exec(
    text.trim(),
  )?.[0] ?? "";

/** The room message that takes a screen share to Google Meet: it mentions everyone else in the call. */
export function meetMessage(
  room: Pick<Room, "me" | "call" | "handles">,
  link: string,
  t: (text: string, vars?: Record<string, string | number>) => string,
) {
  const mentions = (room.call ?? [])
    .filter((peer) => peer.email !== room.me && !isRecorder(peer.email))
    .map(
      (peer) =>
        `@${(room.handles?.[peer.email] ?? peer.email.split("@")[0] ?? "").replace(/^@/, "")}`,
    );
  return [t("Tela no Google Meet: {link}", { link }), ...mentions].join(" ");
}
