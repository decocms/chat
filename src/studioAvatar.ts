import type { Env } from "./index";

// Studio's picture is the Google or GitHub photo of the account. Only those picture hosts are fetched: the URL comes
// from Studio, but it is still a server-side fetch.
const GOOGLE = /^lh\d\.googleusercontent\.com$/;
const GITHUB = /^avatars\.githubusercontent\.com$/;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 1024 * 1024;
/** Sources a sign-in may replace. "own" (an upload) and no source with a picture (an old upload) are kept. */
const SIGN_IN_SOURCES = ["google", "github", "studio"];

/** The picture URL at 256px, or null when it isn't a Google or GitHub picture host. */
export function studioAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (GOOGLE.test(url.hostname)) url.pathname = url.pathname.replace(/=s\d+(-c)?$/, "") + "=s256-c";
  else if (GITHUB.test(url.hostname)) url.searchParams.set("s", "256");
  else return null;
  return url.href;
}

/** Copy the Studio picture into R2 as the person's avatar, unless they uploaded their own. */
export async function syncStudioAvatar(env: Pick<Env, "DB" | "FILES">, email: string, raw: unknown) {
  const url = studioAvatarUrl(raw);
  if (!url) return false;
  email = email.toLowerCase();
  const own = async () => {
    const row = await env.DB.prepare(`SELECT avatar, avatar_src FROM users WHERE email = ?`)
      .bind(email)
      .first<{ avatar: number | null; avatar_src: string | null }>();
    return !!row?.avatar && !SIGN_IN_SOURCES.includes(row.avatar_src ?? "");
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
    `INSERT INTO users (email, created_at, avatar, avatar_src) VALUES (?, ?, ?, 'studio')
     ON CONFLICT(email) DO UPDATE SET avatar = excluded.avatar, avatar_src = excluded.avatar_src
     WHERE users.avatar IS NULL OR users.avatar_src IN ('google', 'github', 'studio')`,
  )
    .bind(email, Date.now(), Date.now())
    .run();
  return true;
}
