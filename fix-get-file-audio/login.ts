// Repro (Gabriele, Circulei): the person clicks "Outro…" on their Claude's question in the room, and the Claude waits forever.
// Needs `bun run dev` with DEV_EMAIL=ana@example.test. Run: bun .screens/outro.ts [label]
import { chromium } from "playwright";
const BASE = "http://127.0.0.1:8798", REDIRECT = "http://127.0.0.1:9/cb", email = "ana@example.test";

const b64 = (b: Uint8Array | ArrayBuffer) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
const jar = (r: Response) => r.headers.getSetCookie().map((c) => c.split(";")[0]);
const reg = (await (await fetch(`${BASE}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "Claude Code (test)", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) })).json()) as { client_id: string };
const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: b64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))), code_challenge_method: "S256", state: "s", scope: "rooms offline_access", resource: "http://127.0.0.1:8797/mcp" });
const cookie = `dev_as=${encodeURIComponent(email)}`;
const page1 = await fetch(`${BASE}/api/authorize/context?${q}`, { headers: { cookie } });
const handle = ((await page1.json()) as { handle: string }).handle;
const ok = await fetch(`${BASE}/authorize?${q}`, { method: "POST", headers: { cookie: [cookie, ...jar(page1)].join("; "), "content-type": "application/x-www-form-urlencoded", origin: BASE }, body: new URLSearchParams({ handle, decision: "approve" }), redirect: "manual" });
const code = new URL(ok.headers.get("location")!).searchParams.get("code")!;
const tok = (await (await fetch(`${BASE}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: verifier, resource: "http://127.0.0.1:8797/mcp" }) })).json()) as { access_token: string };
await Bun.write("/private/tmp/claude-501/-Users-guilherme-Projects-chat/20d7e0a7-eea9-48b4-8d9d-eccf542db8e7/scratchpad/wt-dm/.screens/audio/home/session.json", JSON.stringify({ origin: BASE, client_id: reg.client_id, access_token: tok.access_token, refresh_token: (tok as any).refresh_token, expires_at: Date.now() + 3600e3 }));
console.log("ok");
