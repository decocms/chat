import type { AppNavigationSession } from "../features/app-navigation/controller";
import type { HomeLanguage } from "../features/home/copy";
import type { Room, Epic, Attachment } from "../../shared/room";
import type { RequestRoomCommand } from "./roomConnection";
import type { SendRoomCommand } from "../../shared/commands";
import type { NavigationSession } from "../features/navigation/session";
import type { PinsSession } from "../features/pins/session";
import type { PinAppTarget } from "../features/pins/model";

/** Formatting and canonical status data only; the sidebar never accepts HTML. */
export type SidebarBridge = {
  t: (text: string, vars?: Record<string, string | number>) => string;
  ago: (ts: number) => string;
  name: (email: string) => string;
  avatarVersion: (email: string) => number | null | undefined;
  epicBusy: (epic: Epic) => string | null;
  waitsIn: (
    thread: string,
  ) => readonly import("../features/waits/model").WaitReference[];
  /** Everything waiting on you in this room (the Inbox's "this room" count). */
  waitsInRoom?: () => readonly import("../features/waits/model").WaitReference[];
};

export type SidebarProps = {
  appNavigation?: { controller: AppNavigationSession; lang: HomeLanguage };
  room: Room;
  thread: string;
  collapsed?: boolean;
  roomIcon?: string;
  locale?: string;
  mutations?: import("../features/room-sidebar/session").RoomMutations;
  presence?: import("../features/room-sidebar/model").Presence;
  ontogglerail?: () => void;
  onrenameroom?: () => void;
  onopenside?: () => void;
  oninbox?: (trigger?: HTMLElement) => void;
  inboxOpen?: boolean;
  /** Desktop: the room's views under the main thread (chat, inbox, board); toggles the full board. */
  onboard?: () => void;
  boardOpen?: boolean;
  /** Your open tasks here (the board row's count) and what waits on you (the inbox row's). */
  boardCount?: number | string;
  inboxCount?: number;
  onthreadintent?: () => boolean;
  /** Desktop: the room's name or icon at the top brings the chat back. */
  onroomhome?: () => void;
  /** Mounts the phone sheet's grab handle; returns its cleanup. */
  mountSheetHandle?: (node: HTMLElement) => () => void;
  /** RoomLayout draws the phone grab handle itself. */
  hideSheetHandle?: boolean;
  /** Desktop: pinned to the bottom of the sidebar (you and your Claude). */
  /** The foot: your agent, then (desktop) `rows` = your agents' rows, then you. */
  footer?: import("svelte").Snippet<
    [collapsed: boolean, rows?: import("svelte").Snippet]
  >;
  friends?: string[];
  vb: SidebarBridge;
  send: SendRoomCommand;
  request: RequestRoomCommand;
  onopen: (id: string) => void;
  onarchchange: (archived: boolean) => void;
  navigation: NavigationSession;
  pins: PinsSession;
  onopenpinfile: (file: Attachment) => void;
  onopenpinapp: (app: PinAppTarget) => void;
  /** The app shown in the right pane right now, so its pin can read as selected. */
  activePinApp?: import("svelte/store").Readable<{
    connection: string;
    tool: string;
  } | null>;
};
