import type { Env } from "./index";
import { reqLang } from "./lang";
import { AuthPageMetadata } from "../shared/authPage";
const escape = (value: string) =>
  value.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** The app shell (web/index.html) as an auth page: its language and metadata, and never indexed. */
export function authPageHtml(shell: string, metadata: AuthPageMetadata) {
  const data = AuthPageMetadata.parse(metadata);
  const meta = {
    robots: "noindex",
    "vb-page": data.page,
    "vb-auto-access": data.autoAccess ? "1" : "0",
    "vb-consent-failure":
      data.page === "consent" && data.consentFailure ? "1" : "0",
    ...(data.page === "connection-error"
      ? { "vb-connection-failure": data.connectionFailure ?? "failed" }
      : {}),
  };
  return (
    new HTMLRewriter()
      .on("html", {
        element: (el) => {
          el.setAttribute("lang", data.lang === "en" ? "en" : "pt-BR");
        },
      })
      .on("head", {
        element: (el) => {
          el.append(
            Object.entries(meta)
              .map(
                ([name, content]) =>
                  `<meta name="${name}" content="${escape(content)}" />`,
              )
              .join(""),
            { html: true },
          );
        },
      })
      // The shell's <noscript> text is Portuguese.
      .on("noscript", {
        element: (el) => {
          if (data.lang === "en")
            el.setInnerContent(
              "<main><p>deco.chat needs JavaScript.</p></main>",
              {
                html: true,
              },
            );
        },
      })
      .transform(new Response(shell))
      .text()
  );
}

/** An expired sign-in never replays the POST body/old handle after authentication. */
export function consentLoginUrl(request: string | URL) {
  const url = new URL(request);
  return `/login?next=${encodeURIComponent("/authorize" + url.search)}`;
}
export async function authPage(
  env: { ASSETS: Pick<Env["ASSETS"], "fetch"> },
  request: Request,
  page: AuthPageMetadata["page"],
  options: {
    autoAccess?: boolean;
    status?: 200 | 400 | 401 | 403 | 404 | 429 | 500;
    consentFailure?: boolean;
    connectionFailure?: AuthPageMetadata["connectionFailure"];
  } = {},
) {
  const headers = {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-frame-options": "DENY",
    "content-security-policy": "frame-ancestors 'none'",
  };
  try {
    const asset = await env.ASSETS.fetch(
      new Request(new URL("/", request.url)),
    );
    if (asset.status !== 200) throw new Error("Auth page shell missing");
    const html = await authPageHtml(await asset.text(), {
      page,
      lang: reqLang(request),
      autoAccess: !!options.autoAccess,
      consentFailure: !!options.consentFailure,
      ...(page === "connection-error"
        ? { connectionFailure: options.connectionFailure ?? "failed" }
        : {}),
    });
    return new Response(html, { status: options.status ?? 200, headers });
  } catch {
    return new Response(
      "Application assets are unavailable. Rebuild the app (bun run build:ui) and try again.",
      {
        status: options.status === 500 ? 500 : 503,
        headers: { ...headers, "content-type": "text/plain; charset=utf-8" },
      },
    );
  }
}

/** A presentation-only exception to the ordinary JSON API 401. This function
 * neither identifies a person nor reads/consumes an OAuth state. */
export function connectionSignedOutPage(
  env: { ASSETS: Pick<Env["ASSETS"], "fetch"> },
  request: Request,
): Promise<Response> | null {
  if (
    request.method !== "GET" ||
    !(request.headers.get("accept") ?? "").includes("text/html")
  )
    return null;
  const url = new URL(request.url),
    callback = url.pathname === "/api/mcp-oauth/callback",
    signin =
      /^\/api\/books\/[a-z0-9]{6,40}\/connections\/[a-z0-9]{6,40}\/signin$/.test(
        url.pathname,
      );
  if (!callback && !signin) return null;
  return authPage(env, request, "connection-error", {
    status: 401,
    connectionFailure: "signed-out",
  });
}
