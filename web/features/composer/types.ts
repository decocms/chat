import type { Room } from "../../../shared/room";
import type { UploadFileResult, AgentsResult } from "../../../shared/schemas";
import type { ChatBridge } from "../../app/chatTypes";
import type { RequestRoomCommand } from "../../app/roomConnection";
import type { ComposerVoicePort } from "./voiceTypes";
import type { FireCaptureFactory } from "./fireAudio";
import type { SpeechFactory } from "./speech";
import type { ComposerDrafts } from "./drafts";
export type ComposerUpload = (
  input: { name: string; type: string; body: File },
  signal: AbortSignal,
) => Promise<UploadFileResult>;
export type ComposerAgent = Pick<
  AgentsResult["sandboxes"][number],
  "name" | "email"
>;
export type ComposerProps = {
  room: Room;
  thread: string;
  vb: ChatBridge;
  drafts: ComposerDrafts;
  request: RequestRoomCommand;
  upload: ComposerUpload;
  navigate: (id: number) => void;
  agents?: readonly ComposerAgent[];
  hidden?: boolean;
  speechFactory?: SpeechFactory | null;
  mediaFactory?: FireCaptureFactory | null;
  voice?: ComposerVoicePort;
  /** Called in the send gesture, before the send. The room uses it to ask for notifications on the first send. */
  onsend?: () => void;
};
/** A passage that an app put next to the draft (the content-os reader, for example). It shows as a chip above
 *  the field, and its `text` goes before the typed text when the message is sent. */
export type ComposerQuote = Readonly<{ label: string; text: string }>;
export type ComposerScope = Readonly<{
  account: string;
  roomId: string;
  thread: string;
}>;
