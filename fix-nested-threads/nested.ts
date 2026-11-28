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
const a = await agent("Claude Code (A)");
const room = (await a("create_room", { title: "Threads aninhadas" })).room_id as string;
const parent = (await a("start_thread", { room_id: room, title: "Pagamentos", why: "teste de threads aninhadas", tasks: ["Fechar o fluxo"] })).epic_id as string;
const mainBefore = (await a("read_room", { room_id: room, all: true })).messages.filter((m: any) => m.thread === "main").length;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
await page.context().addCookies([{ name: "dev_as", value: email, url: BASE }]);
await page.goto(`${BASE}/b/${room}?t=${parent}`);
const editor = page.locator('[contenteditable="true"], textarea').first();
await editor.click();
await page.keyboard.type("e o reembolso? precisa de uma thread só pra isso");
await page.keyboard.press("Enter");
const msg = page.locator("[data-message-body]", { hasText: "e o reembolso?" }).last();
await msg.waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: ".screens/nested/1-message-in-thread.png" });
await msg.hover();
await page.getByRole("button", { name: "Criar thread" }).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: ".screens/nested/2-subthread-open.png" });
const rr = await a("read_room", { room_id: room, all: true });
const mainAfter = rr.messages.filter((m: any) => m.thread === "main").length;
const sub = rr.epics.find((e: any) => e.id !== parent);
const src = rr.messages.find((m: any) => String(m.text).includes("e o reembolso?"));
console.log("main messages before/after:", mainBefore, mainAfter, "| sub-thread:", sub?.title, "from_message_id:", sub?.from_message_id, "source id:", src?.id, "source thread:", src?.epic_id);
// Back to the parent thread: the message is there with its thread.
await page.goto(`${BASE}/b/${room}?t=${parent}`);
await page.waitForTimeout(2500);
await page.screenshot({ path: ".screens/nested/3-parent-thread.png" });
await browser.close();
