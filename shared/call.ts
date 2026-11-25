// The call's recorder (recorder/): a browser in a container that joins a room's call as one more participant.
// Its identity is not a person: no one can sign in as it, and it is a member of its one room only.
// Browser-safe: no Worker types.
const RECORDER_DOMAIN = "call-recorder.invalid";
export const recorderEmail = (room: string) =>
  `gravador-${room}@${RECORDER_DOMAIN}`;
export const isRecorder = (email: string) =>
  email.endsWith(`@${RECORDER_DOMAIN}`);
/** The recorder of this room, and of no other room. */
export const isRecorderOf = (email: string, room: string) =>
  email === recorderEmail(room);
/** Is the person of this tab in the room? The room's recorder is, with no row in the members. */
export const isRoomMember = (room: {
  me: string;
  members: readonly string[];
}) => room.members.includes(room.me) || isRecorder(room.me);
/** The room's call chat: the thread id of the chat beside the call's stage, one per room for every call. It is not
 *  an epic: no listing of threads shows it (the sidebar, Open/Done, read_room's epics). A DM's call uses "main". */
export const CALL_THREAD = "call";
/** A thread of this room that a person can open and write in: main, the call chat (not in a DM), an epic. */
export const roomHasThread = (
  room: { book: { dm?: boolean | null }; epics: readonly { id: string }[] },
  thread: string,
) =>
  thread === "main" ||
  (thread === CALL_THREAD && !room.book.dm) ||
  room.epics.some((epic) => epic.id === thread);

// ---- ringing (a DM's call rings the other person) and the call's line in the chat ----
/** How long a DM's call rings the other person, like a phone. */
export const RING_MS = 30_000;
/** The call's line in main (a message with tag "call", by who started it). Its text is what agents read; the app
 *  draws it from what parseCallLine finds. "on": the call goes on. "ended": it had more than its starter. "missed":
 *  a DM's call that nobody answered. */
export type CallLine =
  { state: "on" } | { state: "ended"; minutes: number } | { state: "missed" };
export function callLineText(line: CallLine, en: boolean): string {
  switch (line.state) {
    case "on":
      return en ? "📞 started a call." : "📞 iniciou uma call.";
    case "ended":
      return en
        ? `📞 Call, ${line.minutes} min.`
        : `📞 Call de ${line.minutes} min.`;
    case "missed":
      return en ? "📞 Missed call." : "📞 Call não atendida.";
    default: {
      const never: never = line;
      return never;
    }
  }
}
export function parseCallLine(text: string): CallLine | null {
  if (/^📞 (started a call|iniciou uma call)\.$/.test(text))
    return { state: "on" };
  if (/^📞 (Missed call|Call não atendida)\.$/.test(text))
    return { state: "missed" };
  const ended = /^📞 Call(?:,| de) (\d+) min\.$/.exec(text);
  return ended ? { state: "ended", minutes: Number(ended[1]) } : null;
}
/** A call's minutes for its line: at least 1. */
export const callMinutes = (from: number, to: number) =>
  Math.max(1, Math.round((to - from) / 60_000));
