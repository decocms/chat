/** A per-person agent id for a session id that belongs to someone else: same shape, stable for the pair. Machine ids
 *  (`m_`) too: a computer whose rows came from another login (the vibebook.dev migration) gets its own machine. */
export async function ownSession(sid: string, email: string, prefix = "s_") {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${sid}|${email}`));
  return `${prefix}${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32)}`;
}
