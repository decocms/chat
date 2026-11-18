import type { Room, Message } from "../../../shared/room";
import type { MeResult } from "../../../shared/schemas";
import { fold } from "../composer/model";
import { newestVersion, personVersion } from "../home/model";
export function roomMessages(room: Room): Message[] {
  return [
    ...room.messages,
    ...(room.origins ?? []).filter(
      (origin) => !room.messages.some((message) => message.id === origin.id),
    ),
  ];
}
export function roomName(room: Room, me: MeResult | null, email: string) {
  return email === "ai"
    ? "@vibe"
    : room.names?.[email] ||
        (me?.email === email
          ? me.name
          : me?.friends.find((friend) => friend.email === email)?.name) ||
        email.split("@")[0]!;
}
/** The version of someone's picture in a room (PersonAvatar draws it): yours is always `me.avatar`, so your face
 *  matches the home's; anyone else's is the newest the room or your home knows (versions are timestamps). */
export function roomAvatarVersion(
  room: Room | null | undefined,
  me: MeResult | null,
  email: string,
) {
  return me?.email === email
    ? me.avatar
    : newestVersion([room?.avatars?.[email], personVersion(me, email)]);
}
/** A DM's other person: yourself only in your own DM ("Você", every member is you); undefined while the other one
 *  isn't known (the caller draws its non-person fallback); null in a room. */
export const dmPeer = (room: Room) =>
  room.book.dm
    ? (room.members.find((email) => email !== room.me) ??
      (room.members.length ? room.me : undefined))
    : null;
export function roomMention(room: Room, me: MeResult | null, handle: string) {
  const key = fold(handle);
  if (key === "vibe" || key === "ai") return "ai";
  return (
    room.members.find((email) => {
      const local = email.split("@")[0]!;
      const display =
        room.names?.[email] ||
        (me?.email === email
          ? me.name
          : me?.friends.find((friend) => friend.email === email)?.name) ||
        "";
      return [
        fold(display.split(/\s+/)[0] || ""),
        fold(local.split(/[._+-]/)[0]!),
        fold(local),
      ]
        .filter(Boolean)
        .includes(key);
    }) ?? null
  );
}
