import type { Room, Attachment } from "../../../shared/room";
import type { ChatEmbedControls } from "../../chatTypes";
import type { RequestRoomCommand } from "../../roomConnection";
import type { AppsAuthority } from "./authority";
import type { AppsApi, createAppMetrics } from "./api";

export type NativeChatAppOptions = {
  frame: HTMLIFrameElement;
  file: Attachment;
  controls: ChatEmbedControls;
  authority: AppsAuthority | null;
  room(): Room | null;
  current(): boolean;
  request: RequestRoomCommand;
  name(email: string): string;
  t(text: string, vars?: Record<string, string | number>): string;
  locale: string;
  open(url: string): void;
  api?: AppsApi;
  metrics?: ReturnType<typeof createAppMetrics>;
};

/** Shared before and after module loading: document intent is narrower than
 * the room lease while an old iframe remains connected before a DOM flush. */
export function chatAppCurrent(
  options: NativeChatAppOptions,
  roomId: string,
  account: string,
) {
  const room = options.room();
  return (
    options.authority?.current() === true &&
    options.current() &&
    options.controls.current?.() !== false &&
    options.frame.isConnected &&
    room?.id === roomId &&
    room.me === account &&
    room.members.includes(account) &&
    [
      ...(room.files || []),
      ...room.messages.flatMap((message) => message.files || []),
    ].some(
      (file) =>
        file.embed === true &&
        file.id === options.file.id &&
        file.name === options.file.name &&
        file.type === options.file.type &&
        file.ts === options.file.ts &&
        file.size === options.file.size &&
        file.author === options.file.author,
    )
  );
}
