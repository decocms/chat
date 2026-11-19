import { Hono } from "hono";
import * as z from "zod/mini";
import { reqLang } from "./lang";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import type { Env } from "./index";
import { track } from "./track";
import { syncStudioAvatar } from "./studioAvatar";
import { DEFAULT_ORIGIN, mailFrom, publicOrigin } from "./host";
import type { AuthFail, AuthServices } from "./api";

const COOKIE = "vb_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const SessionPayload = z.object({ email: z.string(), iat: z.number() });
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// deco Studio is the identity provider (OAuth 2.1 + PKCE, public client: no secret here).
const StudioClient = z.object({ client_id: z.string().check(z.minLength(1)) });
const StudioToken = z.object({ id_token: z.string().check(z.minLength(1)), access_token: z.optional(z.string()) });
// Who signed in. Studio's userinfo (GET /api/auth/mcp/userinfo, Bearer access token) is the source when it answers.
// Before Studio had it (404), the id_token claims were the only source: Studio signs that token with a throwaway key,
// so the signature can't be checked, but it comes straight from Studio's token endpoint over TLS for a PKCE-bound
// code, which OIDC Core 3.1.3.7 accepts in place of the signature. `aud` must be our client.
const studioClaims = {
  email: z.string().check(z.regex(EMAIL_RE)),
  // A Studio account with an unverified email must not become that email here.
  email_verified: z.literal(true),
  name: z.optional(z.nullable(z.string())),
  // userinfo says `picture`; Better Auth's id_token puts the picture in `profile`.
  picture: z.optional(z.nullable(z.string())),
  profile: z.optional(z.nullable(z.string())),
};
const StudioUserinfo = z.object(studioClaims);
const StudioIdToken = z.object({ aud: z.string(), ...studioClaims });
const InvitePayload = z.object({
  e: z.string().check(z.regex(EMAIL_RE)),
  b: z.string().check(z.regex(/^[a-z0-9]+$/)),
  x: z.number(),
});

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf))))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export async function hmac(secret: string, data: string) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
export const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
};

/** Email of the signed-in user, or null. */
export async function sessionEmail<E extends { Bindings: Env }>(c: Context<E>): Promise<string | null> {
  const env = c.env;
  const raw = getCookie(c, COOKIE);
  if (!raw || !env.SESSION_SECRET) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || !safeEqual(sig, await hmac(env.SESSION_SECRET, payload))) return null;
  try {
    const parsed = SessionPayload.safeParse(JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))));
    if (!parsed.success) return null;
    const { email, iat } = parsed.data;
    if (Date.now() - iat >= MAX_AGE * 1000) return null;
    // "Sair de todos os aparelhos" sets users.session_after: older cookies stop working (within a minute per server).
    return iat > (await sessionAfter(env, email)) ? email : null;
  } catch {
    return null;
  }
}
const afterSeen = new Map<string, { after: number; at: number }>();
async function sessionAfter(env: Env, email: string) {
  const hit = afterSeen.get(email);
  if (hit && hit.at > Date.now() - 60_000) return hit.after;
  const row = await env.DB.prepare(`SELECT session_after FROM users WHERE email = ?`).bind(email).first<{ session_after: number | null }>().catch(() => null);
  if (afterSeen.size > 20_000) afterSeen.clear();
  afterSeen.set(email, { after: row?.session_after ?? 0, at: Date.now() });
  return row?.session_after ?? 0;
}

async function startSession<E extends { Bindings: Env }>(c: Context<E>, email: string) {
  const payload = b64url(enc.encode(JSON.stringify({ email: email.toLowerCase(), iat: Date.now() })));
  setCookie(c, COOKIE, `${payload}.${await hmac(c.env.SESSION_SECRET, payload)}`, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

// Only follow same-site relative paths after login.
// /authorize?… is the agent-connect consent page (OAuth), reached through login.
const safeNext = (next: string | undefined) => (next && /^\/($|\?|b\/[a-z0-9]+|archived(?:$|\?)|authorize\?|api\/books\/[a-z0-9]+\/files\/[a-z0-9]+$)/.test(next) ? next : "/");

/** The login page for an error or a retry. */
const loginUrl = (query: string) => `/login${query}`;

// Cheap filter in front of email sends; not a security boundary.
const sameOrigin = (c: Context) => {
  const origin = c.req.header("origin");
  return !origin || origin === new URL(c.req.url).origin;
};

/** Signed-in email; in local dev (DEV_EMAIL) the dev_as cookie picks the identity so two browsers can be two people. */
export async function identify<E extends { Bindings: Env }>(c: Context<E>): Promise<string | null> {
  const email = await sessionEmail(c);
  const env = c.env;
  // DEV_EMAIL is local dev only: even if it ever reached production config, it works on loopback alone.
  if (email || !env.DEV_EMAIL || !/^(127\.0\.0\.1|localhost)$/.test(new URL(c.req.url).hostname)) return email;
  const as = getCookie(c, "dev_as");
  return (as && EMAIL_RE.test(as) ? as : env.DEV_EMAIL).toLowerCase();
}

/** The public auth routes' side (src/api.ts authApi): every check and write, answering a value
 *  or { error, status }. Built per request; the route only validates the body and turns the answer into JSON. */
export function authServices<E extends { Bindings: Env }>(c: Context<E>, deps: Pick<AuthServices, "roomAccess">): AuthServices {
  const fail = (error: string, status: AuthFail["status"]): AuthFail => ({ error, status });
  const OK = { ok: true as const };
  return {
    ...deps,
    sameOrigin: sameOrigin(c),
    safeNext,
    loginUrl: (_next, query) => loginUrl(query),
    logout: () => deleteCookie(c, COOKIE, { path: "/" }),
    async logoutAll() {
      const email = await sessionEmail(c);
      if (!email) return fail("unauthenticated", 401);
      await c.env.DB.prepare(`UPDATE users SET session_after = ? WHERE email = ?`).bind(Date.now(), email).run();
      afterSeen.delete(email);
      deleteCookie(c, COOKIE, { path: "/" });
      c.executionCtx.waitUntil(track(c.env, "logout_all", { user: email }));
      return OK;
    },
  };
}

export const auth = new Hono<{ Bindings: Env }>();

export const studioOrigin = (env: Pick<Env, "STUDIO_ORIGIN">) => (env.STUDIO_ORIGIN || "https://studio.decocms.com").replace(/\/+$/, "");
const studioCallback = (origin: string) => `${origin}/auth/studio/callback`;

/** This origin's client id at Studio. Each origin (production, a branch preview, local dev) registers itself once
 *  (OAuth dynamic client registration, a public client: no secret) and keeps the id in KV. */
export async function studioClient(env: Pick<Env, "OAUTH_KV" | "STUDIO_ORIGIN">, origin: string): Promise<string | null> {
  const key = `studio-client:${origin}`;
  const known = await env.OAUTH_KV.get(key);
  if (known) return known;
  const res = await fetch(`${studioOrigin(env)}/api/auth/mcp/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "deco chat",
      redirect_uris: [studioCallback(origin)],
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: "openid profile email",
    }),
  }).then(async (r) => (r.ok ? StudioClient.safeParse(await r.json()) : null)).catch(() => null);
  if (!res?.success) return null;
  await env.OAUTH_KV.put(key, res.data.client_id);
  return res.data.client_id;
}

const sha256 = async (s: string) => b64url(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const random = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

auth.get("/studio/start", async (c) => {
  const origin = new URL(c.req.url).origin;
  const clientId = await studioClient(c.env, origin);
  if (!clientId) return c.redirect(loginUrl("?error=studio"));
  const state = random(), verifier = random();
  setCookie(c, "vb_oauth", `${state}|${safeNext(c.req.query("next"))}|${verifier}`, { httpOnly: true, secure: true, sameSite: "Lax", path: "/auth", maxAge: 600 });
  const url = new URL(`${studioOrigin(c.env)}/api/auth/mcp/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: studioCallback(origin),
    scope: "openid profile email",
    state,
    code_challenge: await sha256(verifier),
    code_challenge_method: "S256",
  }).toString();
  return c.redirect(url.toString());
});

auth.get("/studio/callback", async (c) => {
  const [state, next, verifier] = (getCookie(c, "vb_oauth") ?? "").split("|");
  deleteCookie(c, "vb_oauth", { path: "/auth" });
  // The step that failed goes to the Worker log; the person sees one message.
  const fail = (step: string) => {
    console.warn("studio login failed", { step });
    return c.redirect(loginUrl("?error=studio"));
  };
  if (!state || !verifier || state !== c.req.query("state") || !c.req.query("code")) return fail("state");
  const origin = new URL(c.req.url).origin, studio = studioOrigin(c.env);
  const clientId = await c.env.OAUTH_KV.get(`studio-client:${origin}`);
  if (!clientId) return fail("client");
  const tok = await fetch(`${studio}/api/auth/mcp/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: c.req.query("code")!,
      redirect_uri: studioCallback(origin),
      client_id: clientId,
      code_verifier: verifier,
    }),
  }).then(async (r) => (r.ok ? StudioToken.safeParse(await r.json()) : null)).catch(() => null);
  if (!tok?.success) return fail("token");
  const info = (() => {
    try {
      const part = tok.data.id_token.split(".")[1] ?? "";
      const bytes = Uint8Array.from(atob(part.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0));
      return StudioIdToken.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    } catch {
      return null;
    }
  })();
  if (!info?.success) return fail(info?.error.issues.some((i) => i.path[0] === "email_verified") ? "unverified" : "id_token");
  if (info.data.aud !== clientId) return fail("aud");
  let who: z.output<typeof StudioUserinfo> = info.data;
  if (tok.data.access_token) {
    const res = await fetch(`${studio}/api/auth/mcp/userinfo`, {
      headers: { authorization: `Bearer ${tok.data.access_token}`, accept: "application/json" },
    }).catch(() => null);
    // 404: a Studio without userinfo yet; the id_token claims stay. Any other answer must be a valid identity.
    if (res && res.status !== 404) {
      const parsed = res.ok ? StudioUserinfo.safeParse(await res.json().catch(() => null)) : null;
      if (!parsed?.success) return fail(parsed?.error.issues.some((i) => i.path[0] === "email_verified") ? "unverified" : "userinfo");
      who = parsed.data;
    }
  }
  const email = who.email.toLowerCase();
  await startSession(c, email);
  c.executionCtx.waitUntil(track(c.env, "login", { user: email, dims: { method: "studio" } }));
  const name = (who.name || "").trim().slice(0, 60);
  if (name)
    await c.env.DB.prepare(`INSERT INTO users (email, created_at, name) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = COALESCE(users.name, excluded.name)`)
      .bind(email, Date.now(), name)
      .run()
      .catch(() => {});
  const picture = who.picture || who.profile;
  if (picture)
    c.executionCtx.waitUntil(
      syncStudioAvatar(c.env, email, picture)
        .then(async (ok) => {
          if (ok) await (await import("./person")).pokeRoommates(c.env, email, { t: "me" });
        })
        .catch(() => {}),
    );
  return c.redirect(safeNext(next));
});

// Magic link in invite emails: signed, 24h, logs in as the invited email only.
const INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export async function inviteLink(env: Env, origin: string, email: string, bookId: string) {
  const payload = b64url(enc.encode(JSON.stringify({ e: email, b: bookId, x: Date.now() + INVITE_TTL_MS })));
  return `${origin}/auth/invite?t=${payload}.${await hmac(env.SESSION_SECRET, `invite:${payload}`)}`;
}

auth.get("/invite", async (c) => {
  const [payload, sig] = (c.req.query("t") ?? "").split(".");
  if (!payload || !sig || !safeEqual(sig, await hmac(c.env.SESSION_SECRET, `invite:${payload}`))) return c.redirect("/login");
  let t: z.output<typeof InvitePayload>;
  try {
    const parsed = InvitePayload.safeParse(JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))));
    if (!parsed.success) return c.redirect("/login");
    t = parsed.data;
  } catch {
    return c.redirect("/login");
  }
  const next = `/b/${t.b}`;
  // Expired link: still useful, just log in normally and come back to the book.
  if (!t.x || t.x < Date.now()) return c.redirect(`/login?next=${encodeURIComponent(next)}`);
  // The link signs in only a first-timer, once (security review, Nov 2026): it reached whole accounts, could be
  // forwarded or quoted back in a reply, and swapped the session of whoever was signed in (login CSRF).
  // Someone already signed in goes to the room as they are; an existing account logs in the normal way.
  const current = await sessionEmail(c);
  if (current) return c.redirect(safeNext(next));
  const known = await c.env.DB.prepare(`SELECT 1 FROM users WHERE email = ?`).bind(t.e).first();
  const used = !known && (await c.env.DB.prepare(`INSERT INTO invite_used (sig, ts) VALUES (?, ?) ON CONFLICT DO NOTHING`).bind(sig, Date.now()).run()).meta.changes === 0;
  if (known || used) return c.redirect(`/login?next=${encodeURIComponent(next)}`);
  await startSession(c, t.e);
  c.executionCtx.waitUntil(track(c.env, "login", { user: t.e, dims: { method: "invite" } }));
  return c.redirect(safeNext(next));
});

// Every browser signed in as you (phone, laptop, a stolen cookie) is signed out; your Claudes' logins are separate.

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

// Every deco.chat email: centered table layout (Gmail/Outlook ignore most CSS), the real logo as a PNG (no SVG in
// mail clients), brand blue, Caprasimo-like title with safe fallbacks, white card on the app's background.
/** `origin`: where the logo and the footer link point (publicOrigin of the Worker that sends it). */
export const emailHtml = (title: string, body: string, origin = DEFAULT_ORIGIN) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="light"><link href="https://fonts.googleapis.com/css2?family=Caprasimo&display=swap" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:#eef3fa">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fa"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a2130;font-size:15px;line-height:1.55">
<tr><td style="padding:0 4px 20px"><a href="${origin}" style="text-decoration:none"><img src="${origin}/email-logo.png" width="128" height="26" alt="deco.chat" style="display:block;border:0;width:128px;height:26px"></a></td></tr>
<tr><td style="background:#ffffff;border-radius:18px;padding:32px 32px 28px;border:1px solid #dfe6f1">
<h1 style="margin:0 0 10px;font-family:Caprasimo,Georgia,'Times New Roman',serif;font-weight:400;font-size:24px;line-height:1.25;color:#14203a">${title}</h1>${body}</td></tr>
<tr><td style="padding:18px 4px 0;font-size:12px;color:#7a8496"><a href="${origin}" style="color:#1d5fc4;text-decoration:none;font-weight:600">${new URL(origin).host}</a> · pensa junto, a AI organiza</td></tr>
</table></td></tr></table></body></html>`;
