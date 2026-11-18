// Which app a page request gets (Nov 2026: Svelte by default, vanilla as the fallback). One place decides, before the
// routes: a page request without `?ui=` gets the resolved one written into its URL, so every route below reads it
// with uiVariant() as before. Order: the URL's own `?ui=` (that page only), then this device's choice (cookie
// `vb_ui=vanilla`, set by the switch through /ui/vanilla), then the Worker var UI_DEFAULT ("vanilla" = everyone back
// to vanilla without a deploy of code; a device that chose vanilla stays there either way).
import { UI_COOKIE, type UiVariant } from "../shared/uiVariant";

/** Page navigations whose route picks a UI. API calls, sockets and assets keep their own `?ui=` (or none). */
const PAGE =
  /^\/(?:app|archived|login|authorize|b\/[a-z0-9]+|api\/books\/[a-z0-9]+\/(?:files\/[0-9a-f]+|connections\/[a-z0-9]+\/signin)|api\/mcp-oauth\/callback)\/?$/;

const cookieUi = (request: Request) =>
  /(?:^|;\s*)vb_ui=vanilla(?:;|$)/.test(request.headers.get("cookie") ?? "") ? "vanilla" : null;

export function resolvedUi(request: Request, env: { UI_DEFAULT?: string }): UiVariant {
  return cookieUi(request) ?? (env.UI_DEFAULT === "vanilla" ? "vanilla" : "svelte");
}

/** The request the routes see: a page request carries `?ui=` from here on. */
export function selectUi(request: Request, env: { UI_DEFAULT?: string }): Request {
  if (request.method !== "GET" && request.method !== "HEAD") return request;
  const url = new URL(request.url);
  if (!PAGE.test(url.pathname)) return request;
  const ui = url.searchParams.get("ui");
  if (ui === "svelte" || ui === "vanilla") return request;
  url.searchParams.set("ui", resolvedUi(request, env));
  return new Request(url, request);
}

/** GET /ui/:variant?next=: the "Nova UI" switch. Remembers vanilla on this device (svelte clears it) and goes back. */
export function uiSwitch(request: Request): Response {
  const url = new URL(request.url);
  const variant = url.pathname.match(/^\/ui\/(svelte|vanilla)\/?$/)?.[1] as UiVariant | undefined;
  if (!variant) return new Response("not found", { status: 404 });
  const raw = url.searchParams.get("next") ?? "/app";
  let next = "/app";
  try {
    const n = new URL(raw, url.origin);
    if (n.origin === url.origin && raw.startsWith("/") && !raw.startsWith("//")) {
      n.searchParams.delete("ui");
      next = n.pathname + n.search + n.hash;
    }
  } catch {
    /* keep /app */
  }
  const cookie =
    variant === "vanilla"
      ? `${UI_COOKIE}=vanilla; Max-Age=31536000; Path=/; SameSite=Lax`
      : `${UI_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`;
  return new Response(null, { status: 302, headers: { location: next, "set-cookie": cookie, "cache-control": "no-store" } });
}
