import type { Room } from "../../../shared/room";
import type { ChatBridge } from "../../chatTypes";
import type { SidebarBridge } from "../../sidebar";
import type { RoomMutations } from "./session";
export type ThreadHeaderProps = {
  room: Room;
  thread: string;
  owner: RoomMutations;
  vb: SidebarBridge;
  onopenside: () => void;
  onrenameroom: () => void;
  titleId?: string;
  /** Phone top bar: keeps the title and drops the epic actions (the sheet header has them). */
  compact?: boolean;
  /** Desktop: set while the board or inbox fills the middle; the title brings the chat back instead of renaming. */
  onhome?: () => void;
  roomIcon?: string;
};
export type SuggestionPreviewProps = {
  room: Room;
  index: number;
  owner: RoomMutations;
  vb: ChatBridge;
};
