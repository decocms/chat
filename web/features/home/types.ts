import type { PwaService } from "../pwa/service";
import type { PersonalSession } from "./personal";
import type { RoomsSession } from "../rooms/session";
import type { HomeLanguage } from "./copy";
import type { RoomTarget } from "./model";
import type { AccountSession } from "../account/session";
import type { NewRoomSession } from "./session";
export type HomeBridge = {
  pwa: PwaService;
  personal: PersonalSession;
  rooms: RoomsSession;
  profile: AccountSession;
  creator: NewRoomSession;
  lang: HomeLanguage;
  ago: (time: number) => string;
  onnavigate: (target: RoomTarget) => void;
  onhome: () => void;
  onarchived: () => void;
  onnew: (trigger?: HTMLElement) => void;
  /** Opens a room's menu (a right-click, a long press, Shift+F10) at `point`, else under `trigger`. */
  onroommenu: (
    roomId: string,
    trigger?: HTMLElement,
    point?: { x: number; y: number },
  ) => void;
  onsearch: () => void;
  oninbox?: (trigger?: HTMLElement) => void;
  /** Answers a room invite: the phone's home shows invites over its list. */
  onjoin?: (room: string, yes: boolean) => Promise<void>;
  /** Answers a message request: the phone's home shows them over its list. */
  onanswer?: (email: string, accept: boolean) => Promise<void>;
  /** The phone's `+` opens a DM: resolves with its id, or nothing when it went as a message request. */
  onconnect?: (email: string, text?: string) => Promise<string | undefined>;
  ondismiss?: (email: string) => Promise<void>;
};
