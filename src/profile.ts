// Profile stats (Gui #3526): tokens your Claudes spent, messages, deploys and plan limits hit, summed per person and
// UTC day in D1 `user_stats`, shown as a profile with titles (shared/titles.ts). A profile never carries the email.
// Who can see one: yourself, anyone who shares a room with you (the hover card), and anyone at all once you turn the
// public page on (/u/<handle>).
import type { ProfileResult, ProfileSettingsResult } from "../shared/schemas";

type Db = D1Database;
export type StatField = "messages" | "deploys";
const today = () => new Date().toISOString().slice(0, 10);

/** One more message or deploy for this person today. */
export function bumpStat(db: Db, email: string, field: StatField) {
  return db
    .prepare(`INSERT INTO user_stats (email, day, ${field}) VALUES (?, ?, 1) ON CONFLICT(email, day) DO UPDATE SET ${field} = ${field} + 1`)
    .bind(email, today())
    .run()
    .catch(() => {});
}

/** x-vibebook-usage from the CLI: "<session id>:<tokens so far in that session>". Adds what's new since the last
 *  report of that session (an agent's sessions only grow; a smaller number is ignored). */
export function recordUsage(db: Db, email: string, agent: string, header: string | null) {
  const m = header?.match(/^([\w-]{8,80}):(\d{1,13})$/);
  if (!m) return Promise.resolve();
  const sid = m[1]!, total = Number(m[2]);
  return db
    .batch([
      db
        .prepare(
          `INSERT INTO user_stats (email, day, tokens) VALUES (?1, ?2, max(0, ?3 - coalesce((SELECT tokens FROM usage_sessions WHERE agent = ?4 AND sid = ?5), 0)))
           ON CONFLICT(email, day) DO UPDATE SET tokens = tokens + excluded.tokens`,
        )
        .bind(email, today(), total, agent, sid),
      db
        .prepare(`INSERT INTO usage_sessions (agent, sid, tokens) VALUES (?, ?, ?) ON CONFLICT(agent, sid) DO UPDATE SET tokens = max(tokens, excluded.tokens)`)
        .bind(agent, sid, total),
    ])
    .then(() => {})
    .catch(() => {});
}

/** usage_backfill from the CLI: tokens per UTC day from this machine's Claude Code transcripts older than the live
 *  counter. Set per (person, machine, day) to the largest value seen: rerunning never adds twice. Only the last 2 years,
 *  no future days, at most 1e11 a day (a model can't spend more). Returns how many days were kept. */
export async function recordBackfill(db: Db, email: string, machine: string, days: unknown): Promise<number> {
  if (!Array.isArray(days)) throw new Error("days must be a list of {day, tokens}");
  const oldest = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10), newest = today();
  const ok = days.slice(0, 800).flatMap((d) => {
    const day = typeof d?.day === "string" ? d.day : "", tokens = Number(d?.tokens);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= oldest && day <= newest && Number.isInteger(tokens) && tokens > 0 && tokens <= 1e11 ? [{ day, tokens }] : [];
  });
  for (let i = 0; i < ok.length; i += 50)
    await db.batch(
      ok.slice(i, i + 50).map((d) =>
        db
          .prepare(`INSERT INTO usage_backfill (email, machine, day, tokens) VALUES (?, ?, ?, ?) ON CONFLICT(email, machine, day) DO UPDATE SET tokens = max(tokens, excluded.tokens)`)
          .bind(email, machine, d.day, d.tokens),
      ),
    );
  return ok.length;
}

/** A plan limit at 100% counts once per window (its reset time). `limits` = the validated JSON the agent row keeps. */
export async function recordLimits(db: Db, email: string, limits: string | null) {
  if (!limits) return;
  try {
    const parsed = JSON.parse(limits) as Record<string, { p: number; r: number }>;
    for (const [kind, { p, r }] of Object.entries(parsed)) {
      if (p < 100) continue;
      const ins = await db.prepare(`INSERT OR IGNORE INTO limit_hits (email, kind, reset, at) VALUES (?, ?, ?, ?)`).bind(email, kind, r, Date.now()).run();
      if (ins.meta.changes)
        await db
          .prepare(`INSERT INTO user_stats (email, day, limits_hit) VALUES (?, ?, 1) ON CONFLICT(email, day) DO UPDATE SET limits_hit = limits_hit + 1`)
          .bind(email, today())
          .run();
    }
  } catch {}
}

/** A post whose card title starts with 🚀 is a deploy banner. */
export function isLaunchCard(card: unknown) {
  if (!card || typeof card !== "object") return false;
  const c = card as { root?: unknown; elements?: Record<string, { props?: { title?: unknown } }> };
  const title = typeof c.root === "string" ? c.elements?.[c.root]?.props?.title : undefined;
  return typeof title === "string" && title.trimStart().startsWith("🚀");
}

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24) || "pessoa";

/** The person's handle, made once from their name (else the email's local part), unique with a number. */
async function ensureHandle(db: Db, email: string, name: string | null, handle: string | null) {
  if (handle) return handle;
  const base = slug(name || email.split("@")[0] || "");
  for (let i = 0; i < 20; i++) {
    const h = i ? `${base}-${i + 1}` : base;
    const r = await db.prepare(`UPDATE users SET handle = ? WHERE email = ? AND handle IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE handle = ?)`).bind(h, email, h).run().catch(() => null);
    if (r?.meta.changes) return h;
  }
  const h = `${base}-${crypto.randomUUID().slice(0, 6)}`;
  await db.prepare(`UPDATE users SET handle = ? WHERE email = ? AND handle IS NULL`).bind(h, email).run();
  return h;
}

type UserRow = { email: string; name: string | null; avatar: number | null; handle: string | null; profile_public: number | null; created_at: number | null };

/** The profile of `who` (a handle, or an email for someone you share a room with) as `viewer` (null = signed out) may
 *  see it; null = no such profile, or not yours to see. */
export async function profileFor(db: Db, viewer: string | null, who: string): Promise<ProfileResult | null> {
  const byEmail = who.includes("@");
  if (byEmail && !viewer) return null;
  const u = await db
    .prepare(`SELECT email, name, avatar, handle, profile_public, created_at FROM users WHERE ${byEmail ? "email" : "handle"} = ?`)
    .bind(who.toLowerCase())
    .first<UserRow>();
  if (!u) return null;
  const self = viewer === u.email;
  const shares =
    !self && viewer
      ? !!(await db.prepare(`SELECT 1 FROM members a JOIN members b ON a.book_id = b.book_id WHERE a.email = ? AND b.email = ? LIMIT 1`).bind(viewer, u.email).first())
      : false;
  if (!(self || shares || (!byEmail && u.profile_public === 1))) return null;
  const handle = await ensureHandle(db, u.email, u.name, u.handle);
  const since = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
  const [tot, days, agent, hits] = await Promise.all([
    // Tokens = the live counter plus what each machine's old transcripts had (usage_backfill).
    db.prepare(`SELECT coalesce(sum(tokens), 0) + coalesce((SELECT sum(tokens) FROM usage_backfill WHERE email = ?1), 0) AS tokens, sum(messages) AS messages, sum(deploys) AS deploys, sum(limits_hit) AS limits FROM user_stats WHERE email = ?1`).bind(u.email).first<Record<string, number | null>>(),
    db.prepare(`SELECT day, sum(tokens) AS tokens FROM (SELECT day, tokens FROM user_stats WHERE email = ?1 AND day >= ?2 UNION ALL SELECT day, tokens FROM usage_backfill WHERE email = ?1 AND day >= ?2) GROUP BY day`).bind(u.email, since).all<{ day: string; tokens: number }>(),
    db.prepare(`SELECT ctx_limits FROM agents WHERE email = ? AND ctx_limits IS NOT NULL AND ctx_at > ? ORDER BY ctx_at DESC LIMIT 1`).bind(u.email, Date.now() - 6 * 3600_000).first<{ ctx_limits: string }>(),
    db.prepare(`SELECT kind, at FROM limit_hits WHERE email = ? ORDER BY at DESC LIMIT 10`).bind(u.email).all<{ kind: string; at: number }>(),
  ]);
  const byDay = new Map(days.results.map((d) => [d.day, d.tokens]));
  let limits: ProfileResult["limits"] = null;
  try {
    limits = agent ? JSON.parse(agent.ctx_limits) : null;
  } catch {}
  return {
    handle,
    name: u.name || handle,
    avatar: u.avatar ? `/u/${handle}/avatar?v=${u.avatar}` : null,
    public: u.profile_public === 1,
    self,
    since: u.created_at ?? 0,
    totals: { tokens: tot?.tokens ?? 0, messages: tot?.messages ?? 0, deploys: tot?.deploys ?? 0, limits: tot?.limits ?? 0 },
    days: Array.from({ length: 30 }, (_, i) => {
      const day = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10);
      return { day, tokens: byDay.get(day) ?? 0 };
    }),
    limits,
    hits: hits.results,
  };
}

/** Turn your public page on or off; the handle is made the first time. */
export async function setProfilePublic(db: Db, email: string, on: boolean): Promise<ProfileSettingsResult> {
  const u = await db.prepare(`SELECT name, handle FROM users WHERE email = ?`).bind(email).first<{ name: string | null; handle: string | null }>();
  const handle = await ensureHandle(db, email, u?.name ?? null, u?.handle ?? null);
  await db.prepare(`UPDATE users SET profile_public = ? WHERE email = ?`).bind(on ? 1 : 0, email).run();
  return { handle, public: on };
}

/** Whose avatar a public /u/<handle>/avatar serves: only a profile the viewer may see. */
export async function avatarEmail(db: Db, viewer: string | null, handle: string) {
  const u = await db.prepare(`SELECT email, profile_public FROM users WHERE handle = ?`).bind(handle).first<{ email: string; profile_public: number | null }>();
  if (!u) return null;
  if (u.profile_public === 1 || viewer === u.email) return u.email;
  if (!viewer) return null;
  const shares = await db.prepare(`SELECT 1 FROM members a JOIN members b ON a.book_id = b.book_id WHERE a.email = ? AND b.email = ? LIMIT 1`).bind(viewer, u.email).first();
  return shares ? u.email : null;
}
