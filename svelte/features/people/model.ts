import type { Room } from "../../../shared/room";
export type PeopleRoom = Pick<
  Room,
  | "id"
  | "me"
  | "book"
  | "members"
  | "online"
  | "pending"
  | "invited"
  | "declined"
  | "requests"
  | "names"
  | "avatars"
>;
export type PeopleAction = "invite" | "resend" | "remove" | "approve" | "deny";
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const isEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
/** On the room's People list: a member, or invited (waiting or declined). */
export const isListed = (room: PeopleRoom, email: string) =>
  room.members.includes(email) || !!room.invited?.includes(email);
/** Invited and not in yet: waiting for their yes, or they said no. */
export const isInvited = (room: PeopleRoom, email: string) =>
  !!room.pending?.includes(email) || !!room.declined?.includes(email);
export function canRemove(room: PeopleRoom, email: string) {
  return (
    (room.members.includes(email) || !!room.invited?.includes(email)) &&
    email !== room.book.owner &&
    !(room.declined?.includes(email) && !room.pending?.includes(email)) &&
    (isInvited(room, email) || room.me === room.book.owner)
  );
}
export function canAct(room: PeopleRoom, action: PeopleAction, email: string) {
  if (!room.members.includes(room.me)) return false;
  if (action === "remove") return !!canRemove(room, email);
  if (action === "resend") return !!room.pending?.includes(email);
  if (action === "invite" && room.invited?.includes(email))
    return !!room.pending?.includes(email);
  if (action === "approve" || action === "deny")
    return !!room.requests?.some((r) => r.email === email);
  return isEmail(email) && !room.members.includes(email);
}
export function peopleModel(room: PeopleRoom, friends: readonly string[]) {
  const joined = room.members.filter((email) => !isInvited(room, email));
  const online = joined.filter(
    (email) => email === room.me || room.online.includes(email),
  );
  return {
    online,
    offline: joined.filter((email) => !online.includes(email)),
    /** "Convidados": old never-signed-in members, then invites waiting for a yes, then the ones who said no. */
    invited: [
      ...room.members.filter((email) => isInvited(room, email)),
      ...(room.invited ?? []).filter((email) => !room.members.includes(email)),
    ],
    friends: friends.filter(
      (email) =>
        !room.members.includes(email) && !room.invited?.includes(email),
    ),
  };
}
export function inviteMessage(
  room: PeopleRoom,
  email: string,
  origin: string,
  t: (text: string, vars?: Record<string, string | number>) => string,
) {
  const url = `${origin}/b/${room.id}`;
  return `${t('Te convidei pro vibebook "{title}": {url}', { title: room.book.title, url })}\n\n${t("1. Entra com {email} (o convite chegou nesse email).", { email })}\n${t("2. Manda isto pro seu Claude Code:")}\n\nRead ${origin}/llms.txt and set up vibebook for this project. Room: ${url}`;
}
