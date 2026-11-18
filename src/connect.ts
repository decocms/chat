// Connecting an agent: OAuth 2.1 (DCR + CIMD + PKCE, via workers-oauth-provider) in front of /mcp.
// /authorize signs the person in with the normal vibebook session and asks for consent; the grant's
// props carry only their email. The app lists and revokes grants through /api/agents.
import { reqLang } from "./lang";
import { nativeAuthPage, consentLoginUrl } from "./native-page";
import {
  AuthorizationError,
  CimdFetchError,
  type ConsentDescription,
  OAuthProvider,
} from "@cloudflare/workers-oauth-provider";
import { type Context, Hono } from "hono";
import { handleAgentMcp } from "./agent";
import { escapeHtml, identify } from "./auth";
import type { Env } from "./index";
import { track } from "./track";
import type {
  AgentGrantsResult,
  ConsentContext,
  ConsentError,
} from "../shared/schemas";
import { withAgentGrant, type AgentProps } from "./agentGrant";
import { grantMetadata } from "./grantMetadata";
export type { AgentProps } from "./agentGrant";

export const SCOPE = "rooms";

// The resource URL is the request's own origin, so local dev (http://localhost:8787) works like prod.
const providers = new Map<string, OAuthProvider<Env>>();
export function providerFor(
  origin: string,
  defaultHandler: ExportedHandler<Env>,
) {
  let p = providers.get(origin);
  if (!p) {
    p = new OAuthProvider<Env>({
      apiRoute: "/mcp",
      apiHandler: {
        fetch: (req: Request, env: Env, ctx: ExecutionContext) =>
          withAgentGrant(ctx.props, (props) =>
            handleAgentMcp(req, env, ctx, props),
          ),
      },
      defaultHandler,
      authorizeEndpoint: "/authorize",
      tokenEndpoint: "/oauth/token",
      clientRegistrationEndpoint: "/oauth/register",
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: [SCOPE, "offline_access"],
      requiredScopes: [SCOPE],
      resourceMetadata: {
        resource: `${origin}/mcp`,
        authorization_servers: [origin],
      },
      // A connection lives while the agent keeps using it; idle for 30 days, it has to reconnect.
      refreshTokenIdleTTL: 30 * 24 * 60 * 60,
    });
    providers.set(origin, p);
  }
  return p;
}

export const connect = new Hono<{ Bindings: Env }>();

// An error that carries its own redirect (back to the client) follows it; anything else is the Worker's error.
const fail = (c: Context, e: unknown) => {
  if (e instanceof AuthorizationError && e.redirectTo)
    return c.redirect(e.redirectTo, 302);
  throw e;
};

connect.get("/authorize", async (c) => {
  const email = await identify(c);
  const url = new URL(c.req.url);
  if (!email)
    return c.redirect(
      `/login?next=${encodeURIComponent(url.pathname + url.search)}`,
    );
  try {
    const oauth = c.env.OAUTH_PROVIDER;
    const request = await oauth.parseAuthRequest(c.req.raw);
    // Validate the original request before serving the page. Its typed context GET creates the consent transaction.
    await oauth.describeConsent(request);
    return nativeAuthPage(c.env, c.req.raw, "consent");
  } catch (e) {
    if (
      (e instanceof AuthorizationError || e instanceof CimdFetchError) &&
      !(e instanceof AuthorizationError && e.redirectTo)
    )
      return nativeAuthPage(c.env, c.req.raw, "consent", { status: 400 });
    return fail(c, e);
  }
});

connect.post("/authorize", async (c) => {
  const email = await identify(c);
  if (!email) return c.redirect(consentLoginUrl(c.req.url));
  try {
    const oauth = c.env.OAUTH_PROVIDER;
    const form = await c.req.raw.clone().formData();
    const handle = String(form.get("handle") ?? "");
    if (form.get("decision") !== "approve") {
      const denied = await oauth.denyConsent(c.req.raw, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const approved = await oauth.approveConsent(c.req.raw, handle, {
      scope: [SCOPE, "offline_access"],
    });
    const client = await oauth.lookupClient(approved.request.clientId);
    const clientName = (client?.clientName || approved.request.clientId).slice(
      0,
      80,
    );
    const gid = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const { redirectTo } = await oauth.completeAuthorization({
      request: approved.request,
      userId: email,
      metadata: { client: clientName, at: Date.now(), gid },
      scope: approved.request.scope,
      props: { email, client: clientName, gid } satisfies AgentProps,
    });
    c.executionCtx.waitUntil(
      track(c.env, "agent_connected", {
        user: email,
        dims: { client: clientName },
      }),
    );
    approved.headers.set("location", redirectTo);
    return new Response(null, { status: 302, headers: approved.headers });
  } catch (e) {
    if (!(e instanceof AuthorizationError && e.redirectTo)) {
      const known =
        e instanceof AuthorizationError || e instanceof CimdFetchError;
      // Presentation only: the provider still owns all validation/consumption and success headers.
      // Keep unexpected failures visible in server logs without disclosing details in the browser.
      if (!known) console.error("Native consent POST failed", e);
      return nativeAuthPage(c.env, c.req.raw, "consent", {
        status: known ? 400 : 500,
        consentFailure: true,
      });
    }
    return fail(c, e);
  }
});

// App side: which agents are connected, when each was last used, and revoke.
/** The consent page's context for a native page (src/api.ts GET /api/authorize/context): the same parse, description and
 *  consent transaction as GET /authorize, on a request rebuilt at /authorize with the query unchanged (the library only
 *  accepts requests at its authorize endpoint). The transaction's binding cookie goes back with the answer; approving
 *  is still the form POST /authorize. A refused request answers its error, plus the client's error redirect when the
 *  library built one from a request it validated. */
export async function consentContext(
  env: Env,
  req: Request,
  email: string,
): Promise<
  | { context: ConsentContext; headers: [string, string][] }
  | (ConsentError & { status: 400 })
> {
  const url = new URL(req.url);
  try {
    const oauth = env.OAUTH_PROVIDER;
    const request = await oauth.parseAuthRequest(
      new Request(new URL(`/authorize${url.search}`, url.origin), {
        headers: req.headers,
      }),
    );
    const d = await oauth.describeConsent(request);
    const consent = await oauth.beginConsent(request);
    return {
      context: {
        client_name: d.clientName,
        client_domain: d.clientDomain ?? null,
        redirect_host: d.redirectHost,
        redirect_is_loopback: !!d.redirectIsLoopback,
        scope: d.scope,
        email,
        handle: consent.handle,
      },
      headers: [...consent.headers],
    };
  } catch (e) {
    if (e instanceof AuthorizationError)
      return {
        error: e.description ?? e.code ?? "invalid_request",
        ...(e.redirectTo ? { redirect_to: e.redirectTo } : {}),
        status: 400,
      };
    if (e instanceof CimdFetchError)
      return { error: "client metadata unavailable", status: 400 };
    throw e;
  }
}

/** Your Claudes' OAuth grants (the home's "connected agents" box): typed routes in src/api.ts call these. */
export function grantOps(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
  email: string,
) {
  return {
    async list(): Promise<AgentGrantsResult> {
      const { items } = await env.OAUTH_PROVIDER.listUserGrants(email);
      const last = await env.DB.prepare(
        `SELECT max(ts) AS ts FROM events WHERE user = ? AND name = 'agent_call' AND ts > ?`,
      )
        .bind(email, Date.now() - 90 * 86_400_000)
        .first<{ ts: number | null }>();
      // Last use per grant: handleAgentMcp stamps D1 grant_seen with the grant's gid (grants since Nov 2026) or
      // "g:<grant id>" from the token (older ones); an old grant not used since that change stays unknown.
      const grants = items.map((g) => ({
        grant: g,
        metadata: grantMetadata(g.metadata),
      }));
      const key = (id: string, gid?: string) => gid ?? `g:${id}`; // same key as handleAgentMcp writes
      const gids = grants.map(({ grant, metadata }) =>
        key(grant.id, metadata.gid),
      );
      const seen = new Map<string, number>(
        gids.length
          ? (
              await env.DB.prepare(
                `SELECT gid, ts FROM grant_seen WHERE gid IN (SELECT value FROM json_each(?))`,
              )
                .bind(JSON.stringify(gids))
                .all<{ gid: string; ts: number }>()
            ).results.map((r): [string, number] => [r.gid, r.ts])
          : [],
      );
      return {
        agents: grants.map(({ grant: g, metadata }) => {
          // Grants without a gid show "unknown" until their next call stamps "g:<id>".
          const ts = seen.get(key(g.id, metadata.gid));
          return {
            id: g.id,
            client: metadata.client ?? g.clientId,
            connected_at: g.createdAt * 1000,
            used_at: metadata.gid ? (ts ?? null) : ts,
          };
        }),
        last_used: last?.ts ?? null,
      };
    },
    /** Remove several at once (the app's checkbox list), at most 100 per call. */
    async revoke(ids: string[]) {
      const list = ids.slice(0, 100);
      for (const id of list) await env.OAUTH_PROVIDER.revokeGrant(id, email);
      ctx.waitUntil(
        track(env, "agent_disconnected", {
          user: email,
          dims: { n: list.length },
        }),
      );
      return list.length;
    },
  };
}
