/** A per-person agent id for a session id that belongs to someone else: same shape, stable for the pair. */
export async function ownSession(sid: string, email: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sid}|${email}`));
  return `s_${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
}
