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
  onlanguage: (lang: HomeLanguage) => void;
  lang: HomeLanguage;
  ago: (time: number) => string;
  onnavigate: (target: RoomTarget) => void;
  onhome: () => void;
  onarchived: () => void;
  onnew: (trigger?: HTMLElement) => void;
  onroomsettings: (roomId: string, trigger?: HTMLElement) => void;
  onsearch: () => void;
  oninbox?: (trigger?: HTMLElement) => void;
  /** Answers a room invite: the phone's home shows invites over its list. */
  onjoin?: (room: string, yes: boolean) => Promise<void>;
  /** Answers a message request: the phone's home shows them over its list. */
  onanswer?: (email: string, accept: boolean) => Promise<void>;
};
