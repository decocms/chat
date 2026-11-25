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
