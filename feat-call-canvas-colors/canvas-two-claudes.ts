import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8797", REDIRECT = "http://127.0.0.1:9/cb", email = "ana@example.test";

const b64 = (b: Uint8Array | ArrayBuffer) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
const jar = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]);
// Two Claudes (two OAuth clients of ana@example.test, so @claude and @claude-2) share one epic's canvas, embedded twice in
// the epic's doc. Needs `DEV_EMAIL=ana@example.test bun run dev`. Run: bun .screens/canvas-two-claudes.ts
async function agent(name: string) {
  const reg = (await (await fetch(`${BASE}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: name, redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) })).json()) as { client_id: string };
  const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
  const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))), code_challenge_method: "S256", state: "s", scope: "rooms offline_access", resource: `${BASE}/mcp` });
  const cookie = `dev_as=${encodeURIComponent(email)}`;
  const page1 = await fetch(`${BASE}/api/authorize/context?${q}`, { headers: { cookie } });
  const handle = ((await page1.json()) as { handle: string }).handle;
  const ok = await fetch(`${BASE}/authorize?${q}`, { method: "POST", headers: { cookie: [cookie, ...jar(page1)].join("; "), "content-type": "application/x-www-form-urlencoded", origin: BASE }, body: new URLSearchParams({ handle, decision: "approve" }), redirect: "manual" });
  const code = new URL(ok.headers.get("location")!).searchParams.get("code")!;
  const tok = (await (await fetch(`${BASE}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: verifier, resource: `${BASE}/mcp` }) })).json()) as { access_token: string };
  let sid = "", n = 0;
  const rpc = async (method: string, params: object = {}) => {
    const r = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok.access_token}`, ...(sid ? { "mcp-session-id": sid } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: ++n, method, params }) });
    sid = r.headers.get("mcp-session-id") ?? sid;
    return (await r.json()) as any;
  };
  await rpc("initialize", { protocolVersion: "2025-06-18" });
  return async (tool: string, args: object) => {
    const r = await rpc("tools/call", { name: tool, arguments: args });
    if (r.result?.isError || r.error) throw new Error(`${tool}: ${JSON.stringify(r.result?.content ?? r.error)}`);
    return r.result?.structuredContent;
  };
}
const a = await agent("Claude Code (A)"), b = await agent("Claude Code (B)");
const room = (await a("create_room", { title: "Canvas de teste" })).room_id as string;
const start = await a("start_thread", { room_id: room, title: "Desenho do funil", why: "teste do canvas", tasks: ["Desenhar o funil"] });
const epic = (start.epic_id ?? start.id ?? start.thread) as string;
console.log("room", room, "epic", epic, Object.keys(start));
// Both read the room once, so each gets its @name there.
console.log("names", (await a("read_room", { room_id: room })).you_are?.name, (await b("read_room", { room_id: room })).you_are?.name);
await a("update_doc", { room_id: room, epic_id: epic, markdown: "# Desenho do funil\n\nO quadro todo:\n\n```canvas\n```\n\nSó o diagrama, mais perto:\n\n```canvas\nx=380 y=0 zoom=1.3\n```\n" });
await a("canvas_put", { room_id: room, epic_id: epic, id: "decisoes", title: "Decisões", body: "- Plano anual com 20% de desconto\n- Teste de 2 semanas no Pro" });
await b("canvas_put", { room_id: room, epic_id: epic, id: "funil", kind: "mermaid", title: "Funil", body: "flowchart TD\n  A[Visita] --> B[Teste]\n  B --> C[Pro]" });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2, locale: "pt-BR" });
await page.context().addCookies([{ name: "dev_as", value: email, url: BASE }]);
await page.goto(`${BASE}/b/${room}#e${epic}`);
await page.locator("[data-canvas-card]").first().waitFor({ timeout: 20000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: ".screens/cv/1-two-claudes.png" });
await page.locator("[data-canvas]").first().screenshot({ path: ".screens/cv/1b-canvas-zoom.png" });
// Claude B edits Claude A's card (collaborating freely): it shows up live, in B's color, without reloading.
const before = await page.locator('[data-canvas-card="decisoes"]').first().getAttribute("data-canvas-color");
await b("canvas_put", { room_id: room, epic_id: epic, id: "decisoes", title: "Decisões", body: "- Plano anual com 20% de desconto\n- Teste de 2 semanas no Pro\n- **Novo (claude-2):** preço por assento" });
await page.locator('[data-canvas-card="decisoes"]', { hasText: "preço por assento" }).first().waitFor({ timeout: 10000 });
await page.waitForTimeout(1500);
const after = await page.locator('[data-canvas-card="decisoes"]').first().getAttribute("data-canvas-color");
const funil = await page.locator('[data-canvas-card="funil"]').first().getAttribute("data-canvas-color");
console.log("decisoes color before", before, "after B edited", after, "funil (B)", funil);
await page.screenshot({ path: ".screens/cv/2-b-edits-a.png" });
await page.locator("[data-canvas]").first().screenshot({ path: ".screens/cv/2b-canvas-zoom.png" });
console.log("cards", await page.locator("[data-canvas-card]").count(), "labels", (await page.locator("[data-canvas-card] header").allInnerTexts()).join(" | "));
await browser.close();
