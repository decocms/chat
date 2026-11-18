import "server-only";

/**
 * Where this Worker lives, for what can't read it from the request: emails, push, links in the alarm.
 * vibebook.dev sets nothing and keeps these defaults; the deco account's Worker (wrangler.deco.jsonc) sets
 * PUBLIC_ORIGIN = https://chat.decocms.com and MAIL_DOMAIN to the domain Email Sending is set up for.
 */
type HostEnv = { PUBLIC_ORIGIN?: string; MAIL_DOMAIN?: string };

export const DEFAULT_ORIGIN = "https://vibebook.dev";
export const publicOrigin = (env: HostEnv) => (env.PUBLIC_ORIGIN || DEFAULT_ORIGIN).replace(/\/+$/, "");
export const publicHost = (env: HostEnv) => new URL(publicOrigin(env)).host;
/** `login`, `mention`, `convite` … @ the mail domain. */
export const mailFrom = (env: HostEnv, local: string) => `${local}@${env.MAIL_DOMAIN || publicHost(env)}`;

/**
 * Every host this app is served from, old and new (the move to deco's account, Nov 2026). The Worker never fetches
 * them for someone (`checkUrl`), and a referrer from them is not an external visit (analytics).
 */
export const OWN_HOSTS = ["vibebook.dev", "chat.decocms.com"];
export const isOwnHost = (host: string) => OWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
