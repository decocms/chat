/** The settings page's sections, in page order: each is an anchor (`/settings#cloud`) and a row in its sidebar. */
export const SETTINGS_SECTIONS = [
  "profile",
  "agents",
  "cloud",
  "device",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const pt = {
  title: "Configurações",
  profile: "Perfil",
  agents: "Agents",
  cloud: "Agents na nuvem",
  device: "Este aparelho",
};
const en: Record<keyof typeof pt, string> = {
  title: "Settings",
  profile: "Profile",
  agents: "Agents",
  cloud: "Cloud agents",
  device: "This device",
};
export const settingsText = (lang: "pt" | "en", key: keyof typeof pt) =>
  (lang === "en" ? en : pt)[key];

/** The page's address: a section anchor, and the room to show cloud agents for (`?room=`). */
export const settingsHref = (section?: SettingsSection, room?: string) =>
  `/settings${room ? `?room=${encodeURIComponent(room)}` : ""}${section ? `#${section}` : ""}`;
