// Direct messages: one room per pair of people, plus "Você", the room you have with yourself (and your Claude).
// Both sides work out the same id, an HMAC of the sorted pair (unguessable from the two emails). Opening the DM
// makes its rows (`openDm`); it stays out of every list until someone writes in it (`/api/me` hides a DM with no
// message), so the other person sees nothing before the first message. The pair is kept on the row (`books.dm`),
// so a DM made under one SESSION_SECRET keeps working after the secret rotates.
import type { Env } from "./index";

const te = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();
const key = (secret: string) => {
  let k = keys.get(secret);
  if (!k)
    keys.set(
      secret,
      (k = crypto.subtle.importKey(
        "raw",
        te.encode(`dm:${secret}`),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      )),
    );
  return k;
};

import { isDmId, MUTUAL, pairKey } from "../shared/dm";
import { corporateDomain } from "../shared/org";
export { isDmId, pairKey };

/** The DM room id for two people (the same whichever asks); `dmId(env, me, me)` is your own. */
export async function dmId(
  env: Pick<Env, "SESSION_SECRET">,
  a: string,
  b: string,
) {
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await key(env.SESSION_SECRET),
      te.encode(pairKey(a, b)),
    ),
  );
  return (
    "dm" +
    [...sig.slice(0, 10)].map((x) => x.toString(16).padStart(2, "0")).join("")
  );
}

/** The id of each of your DMs, by the other person's email (yours for "Você"): the stored row when it exists, else the HMAC. */
export async function dmIds(
  env: Pick<Env, "SESSION_SECRET" | "DB">,
  email: string,
  peers: string[],
) {
  const me = email.toLowerCase();
  const pairs = [me, ...peers].map((p) => pairKey(me, p));
  const made = await env.DB.prepare(
    `SELECT id, dm FROM books WHERE dm IN (SELECT value FROM json_each(?))`,
  )
    .bind(JSON.stringify(pairs))
    .all<{ id: string; dm: string }>();
  const byPair = new Map(made.results.map((r) => [r.dm, r.id]));
  return new Map(
    await Promise.all(
      [me, ...peers].map(
        async (p) =>
          [
            p.toLowerCase(),
            byPair.get(pairKey(me, p)) ?? (await dmId(env, me, p)),
          ] as const,
      ),
    ),
  );
}

/** A DM's name for one side: the other person (their name, else their email), or "Você"/"You" in your own. */
export async function dmTitle(
  env: Pick<Env, "DB">,
  pair: string,
  viewer: string,
  en: boolean,
) {
  const other = pair.split("\n").find((e) => e !== viewer.toLowerCase());
  if (!other) return en ? "You" : "Você";
  const u = await env.DB.prepare(`SELECT name FROM users WHERE email = ?`)
    .bind(other)
    .first<{ name: string | null }>();
  return u?.name || other;
}

/** Who you can DM without asking: yourself, a connection (you accepted each other's message), anyone you share a
 *  room with (both joined: an invite you haven't answered doesn't count), or a colleague: someone with an account and
 *  your company email domain (not a free provider, shared/org.ts). Everyone else gets a message request. */
export async function canDm(db: D1Database, a: string, b: string) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  if (a === b) return true;
  const domain = corporateDomain(a);
  if (domain && domain === corporateDomain(b) && (await db.prepare(`SELECT 1 FROM users WHERE email = ?`).bind(b).first()))
    return true;
  return !!(await db
    .prepare(
      `SELECT 1 WHERE EXISTS (SELECT 1 FROM friends f WHERE f.a = ?1 AND f.b = ?2 AND ${MUTUAL})
          OR EXISTS (SELECT 1 FROM members x JOIN members y ON y.book_id = x.book_id JOIN books k ON k.id = x.book_id AND k.dm IS NULL
                      WHERE x.email = ?1 AND y.email = ?2)`,
    )
    .bind(a, b)
    .first());
}

/** Makes (or reopens) your DM with `peer` and returns its id; null when you can't DM them without asking. */
export async function openDmWith(
  env: Pick<Env, "SESSION_SECRET" | "DB">,
  email: string,
  peer: string,
) {
  const me = email.toLowerCase();
  peer = peer.toLowerCase();
  if (!(await canDm(env.DB, me, peer))) return null;
  const row = await env.DB.prepare(`SELECT id FROM books WHERE dm = ?`)
    .bind(pairKey(me, peer))
    .first<{ id: string }>();
  const id = row?.id ?? (await dmId(env, me, peer));
  if (row)
    await env.DB.batch(
      [me, peer].map((e) =>
        env.DB.prepare(
          `INSERT OR IGNORE INTO members (book_id, email) VALUES (?, ?)`,
        ).bind(id, e),
      ),
    );
  else await makeDm(env, id, me, peer);
  return id;
}

async function makeDm(env: Pick<Env, "DB">, id: string, me: string, peer: string) {
  const now = Date.now();
  const names = await env.DB.prepare(
    `SELECT email, name FROM users WHERE email IN (?, ?)`,
  )
    .bind(me, peer)
    .all<{ email: string; name: string | null }>();
  const first = (e: string) =>
    names.results.find((u) => u.email === e)?.name?.split(" ")[0] ||
    e.split("@")[0];
  // The row's own title is only a fallback (e-mails): each side sees the DM under the other person's name.
  const title = peer === me ? first(me) : `${first(me)} · ${first(peer)}`;
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO books (id, title, folder, summary, owner, created_at, updated_at, dm) VALUES (?, ?, NULL, '', ?, ?, ?, ?)`,
    ).bind(id, title.slice(0, 120), me, now, now, pairKey(me, peer)),
    env.DB.prepare(
      `INSERT OR IGNORE INTO members (book_id, email) VALUES (?, ?)`,
    ).bind(id, me),
    env.DB.prepare(
      `INSERT OR IGNORE INTO members (book_id, email) VALUES (?, ?)`,
    ).bind(id, peer),
  ]);
}

/**
 * Called for someone who isn't a member of `id` (the /b/* page and the room socket): when `id` is their DM with
 * someone they can DM (or their own), makes its rows or puts them back in it. Anyone else gets nothing.
 */
export async function openDm(
  env: Pick<Env, "SESSION_SECRET" | "DB">,
  id: string,
  email: string,
) {
  if (!isDmId(id)) return false;
  const me = email.toLowerCase();
  const row = await env.DB.prepare(`SELECT dm FROM books WHERE id = ?`)
    .bind(id)
    .first<{ dm: string | null }>();
  if (row) {
    const pair = row.dm?.split("\n") ?? [];
    if (!pair.includes(me)) return false;
    return !!(await openDmWith(env, me, pair.find((e) => e !== me) ?? me));
  }
  if ((await dmId(env, me, me)) === id) return !!(await openDmWith(env, me, me));
  // Not made yet: find who it's with among the people you can DM (connections, people in your rooms, colleagues).
  const domain = corporateDomain(me);
  const peers = await env.DB.prepare(
    `SELECT f.b AS e FROM friends f WHERE f.a = ?1 AND ${MUTUAL}
     UNION SELECT y.email FROM members x JOIN members y ON y.book_id = x.book_id JOIN books k ON k.id = x.book_id AND k.dm IS NULL
      WHERE x.email = ?1 AND y.email != ?1
     UNION SELECT u.email FROM users u WHERE ?2 IS NOT NULL AND u.email LIKE '%@' || ?2 AND u.email != ?1`,
  )
    .bind(me, domain)
    .all<{ e: string }>();
  const ids = await Promise.all(peers.results.map(({ e }) => dmId(env, me, e)));
  const peer = peers.results[ids.indexOf(id)]?.e;
  return peer ? !!(await openDmWith(env, me, peer)) : false;
}
