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
