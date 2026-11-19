import { authClient } from "../../lib/client/api";
import { ProfileResult } from "../../../shared/schemas";
import type { FetchLike } from "../../app/transport";

/** A profile by handle or (someone you share a room with) by email; null = not found or not yours to see. Cached per
 *  page for a minute, so hovering the same avatar again doesn't refetch. */
const cache = new Map<
  string,
  { at: number; value: Promise<ProfileResult | null> }
>();
export function fetchProfile(
  who: string,
  fetcher?: FetchLike,
): Promise<ProfileResult | null> {
  const hit = cache.get(who);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = authClient("/", fetcher)
    .auth.profile[":who"].$get({ param: { who } })
    .then(async (r) => {
      if (!r.ok) return null;
      const p = ProfileResult.safeParse(await r.json());
      return p.success ? p.data : null;
    })
    .catch(() => null);
  cache.set(who, { at: Date.now(), value });
  return value;
}

/** Drop a cached profile (after you change your own settings, so the next read is fresh). */
export function forgetProfile(who: string) {
  cache.delete(who);
}
