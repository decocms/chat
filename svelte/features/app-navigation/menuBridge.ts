import { getContext, setContext } from "svelte";
import type { AccountSection } from "../account/session";
import type { PwaService } from "../pwa/service";
import type { HomeLanguage } from "../home/copy";

export type UserMenuTheme = "auto" | "light" | "dark";

/** What the avatar menu needs from the application, wherever it is drawn (the
 * rail on Home and in a room, and the phone room sheet's strip). */
export type UserMenuActions = {
  /** Opens account settings at a section; `trigger` gets focus back on close. */
  onaccount?: (section: AccountSection, trigger?: HTMLElement) => void;
  /** This device's notification switch (vb.mute + browser permission). */
  pwa?: PwaService;
  /** The application's ordinary sign-out (push cleanup warning included). */
  onlogout?: () => void;
};

export type UserMenuBridge = UserMenuActions & {
  lang: HomeLanguage;
  /** A getter so the menu follows the shell's current theme. */
  theme(): UserMenuTheme;
  onsettheme(theme: UserMenuTheme): void;
  onlanguage(lang: HomeLanguage): void;
};

/** The context key, exported for mounts that supply the bridge directly. */
export const userMenuKey = Symbol("vb-user-menu");
export const provideUserMenu = (bridge: UserMenuBridge) =>
  setContext(userMenuKey, bridge);
export const userMenuBridge = () =>
  getContext<UserMenuBridge | undefined>(userMenuKey);
