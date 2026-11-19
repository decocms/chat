import type { Room } from "../../../shared/room";
import type { ChatBridge } from "../../app/chatTypes";
import type { SidebarBridge } from "../../app/sidebar";
import type { RoomMutations } from "./session";
export type ThreadHeaderProps = {
  room: Room;
  thread: string;
  owner: RoomMutations;
  vb: SidebarBridge;
  onopenside: () => void;
  onrenameroom: () => void;
  titleId?: string;
  roomIcon?: string;
};
export type SuggestionPreviewProps = {
  room: Room;
  index: number;
  owner: RoomMutations;
  vb: ChatBridge;
};
