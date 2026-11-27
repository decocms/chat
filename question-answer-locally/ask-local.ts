// Repro (Gabriele, Circulei): a Claude asks (AskUserQuestion) in a repo linked to a room; the person must be able to answer in the room OR in the app.
// Needs `bun run dev` with DEV_EMAIL=ana@example.test. Run: bun .screens/ask-local.ts room|local
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8797", REDIRECT = "http://127.0.0.1:9/cb", email = "ana@example.test";
const mode = process.argv[2] === "local" ? "local" : "room";
const b64 = (b: Uint8Array | ArrayBuffer) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
const jar = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]);
const reg = (await (await fetch(`${BASE}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude Code (test)", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) })).json()) as { client_id: string };
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
const tool = async (name: string, args: object) => (await rpc("tools/call", { name, arguments: args })).result?.structuredContent;
await rpc("initialize", { protocolVersion: "2025-06-18" });
const room = (await tool("create_room", { title: mode === "room" ? "Responder na sala" : "Responder no app" })).room_id as string;
// The CLI of this test agent: its own home with a session for the local server, so the hooks talk to it.
const home = `${process.cwd()}/.screens/ask/home-${mode}`, repo = `${process.cwd()}/.screens/ask/repo-${mode}`;
await Bun.$`rm -rf ${home} ${repo} && mkdir -p ${home} ${repo}`;
await Bun.write(`${home}/session.json`, JSON.stringify({ origin: BASE, client_id: reg.client_id, access_token: tok.access_token, refresh_token: (tok as any).refresh_token, expires_at: Date.now() + 3600e3 }));
await Bun.$`cd ${repo} && git init -q && printf 'room_id=%s\n' ${room} > .vibebook`;
const hooks = `${process.cwd()}/claude-plugin/hooks`;
// The installed vibebook plugin is off; the hooks of this checkout run instead, as hooks.json wires them.
await Bun.write(`${repo}/../settings-${mode}.json`, JSON.stringify({ enabledPlugins: { "vibebook@vibebook": false }, hooks: { PermissionRequest: [
  { matcher: ".*", hooks: [{ type: "command", command: `sh ${hooks}/permission.sh`, timeout: 630 }] },
  { matcher: "AskUserQuestion", hooks: [{ type: "command", command: `sh ${hooks}/question.sh`, timeout: 630 }] },
] } }));
const env = { ...process.env, VIBEBOOK_HOME: home, VIBEBOOK_NO_HUB: "1", VIBEBOOK_NO_PLUGIN_UPDATE: "1", CLAUDE_CODE_FORCE_SESSION_PERSISTENCE: "1" };
const term = Bun.spawn(["python3", ".screens/ask-pty.py", repo, `${repo}/../settings-${mode}.json`, `.screens/ask/${mode}-terminal.txt`, mode === "local" ? "1" : "0"], { env, stdout: "inherit", stderr: "inherit" });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "pt-BR" });
await page.context().addCookies([{ name: "dev_as", value: email, url: BASE }]);
await page.goto(`${BASE}/b/${room}`);
const ask = page.locator("[data-choices]").last();
await ask.waitFor({ timeout: 90000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `.screens/ask/${mode}-1-question.png` });
if (mode === "room") {
  await ask.locator('[role="radio"]', { hasText: "LOJA15" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `.screens/ask/${mode}-1b-picked.png` });
  await page.keyboard.press("Enter"); // the pick goes to the composer as a reply; sending it answers
}
await term.exited;
await page.waitForTimeout(2000);
await page.screenshot({ path: `.screens/ask/${mode}-2-after.png` });
console.log("room question:", (await ask.innerText()).replace(/\s+/g, " ").slice(0, 300));
// The terminal, drawn by xterm.js from the bytes Claude Code wrote: when the question showed, and at the end.
const tpage = await browser.newPage({ viewport: { width: 1180, height: 700 } });
await tpage.setContent(`<link rel="stylesheet" href="file://${process.cwd()}/node_modules/@xterm/xterm/css/xterm.css"><body style="margin:0;background:#1e1e1e"><div id="t"></div></body>`);
await tpage.addScriptTag({ path: "node_modules/@xterm/xterm/lib/xterm.js" });
for (const [name, file] of [["3-terminal-question", `.screens/ask/${mode}-terminal.txt.dialog.raw`], ["4-terminal-answered", `.screens/ask/${mode}-terminal.txt.raw`]]) {
  const b64 = Buffer.from(await Bun.file(file).arrayBuffer()).toString("base64");
  await tpage.evaluate(async (data) => {
    document.getElementById("t")!.innerHTML = "";
    const term = new (window as any).Terminal({ cols: 140, rows: 40, fontSize: 13, theme: { background: "#1e1e1e" } });
    term.open(document.getElementById("t"));
    await new Promise((r) => term.write(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)), r));
  }, b64);
  await tpage.waitForTimeout(300);
  await tpage.screenshot({ path: `.screens/ask/${mode}-${name}.png` });
}
await browser.close();
