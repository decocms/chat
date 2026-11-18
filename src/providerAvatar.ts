import type { Env } from "./index";

/** Where a profile picture came from: the person's own upload, or the provider they last signed in with. */
export type AvatarSource = "own" | "google" | "github";
type Provider = Exclude<AvatarSource, "own">;

// The providers' own picture hosts, nothing else: the URL comes from their API, but it's still a server-side fetch.
const HOSTS: Record<Provider, RegExp> = {
  google: /^lh\d\.googleusercontent\.com$/,
  github: /^avatars\.githubusercontent\.com$/,
};
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 1024 * 1024;

/** The provider's picture URL at 256px, or null when it isn't one of that provider's picture hosts. */
export function providerAvatarUrl(provider: Provider, raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !HOSTS[provider].test(url.hostname)) return null;
  if (provider === "google") url.pathname = url.pathname.replace(/=s\d+(-c)?$/, "") + "=s256-c";
  else url.searchParams.set("s", "256");
  return url.href;
}

/** Copy the sign-in provider's picture into R2 as the person's avatar, unless they uploaded their own. An avatar
 * with no source predates this and was an upload, so it counts as theirs. The latest provider sign-in wins. */
export async function syncProviderAvatar(env: Pick<Env, "DB" | "FILES">, email: string, provider: Provider, raw: unknown) {
  const url = providerAvatarUrl(provider, raw);
  if (!url) return false;
  email = email.toLowerCase();
  const own = async () => {
    const row = await env.DB.prepare(`SELECT avatar, avatar_src FROM users WHERE email = ?`)
      .bind(email)
      .first<{ avatar: number | null; avatar_src: string | null }>();
    return !!row?.avatar && row.avatar_src !== "google" && row.avatar_src !== "github";
  };
  if (await own()) return false;
  const res = await fetch(url, { redirect: "manual" });
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!res.ok || !TYPES.has(type) || Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return false;
  const bytes = await res.arrayBuffer();
  if (!bytes.byteLength || bytes.byteLength > MAX_BYTES) return false;
  if (await own()) return false; // they uploaded one while this fetched
  await env.FILES.put(`avatars/${email}`, bytes, { httpMetadata: { contentType: type } });
  // The WHERE checks once more, in the same statement as the write.
  await env.DB.prepare(
    `INSERT INTO users (email, created_at, avatar, avatar_src) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET avatar = excluded.avatar, avatar_src = excluded.avatar_src
     WHERE users.avatar IS NULL OR users.avatar_src IN ('google', 'github')`,
  )
    .bind(email, Date.now(), Date.now(), provider)
    .run();
  return true;
}
