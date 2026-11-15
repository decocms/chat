// Controlled external MCP peer; real Worker auth, connection rows and signed identities remain in use.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as z from "zod/mini";
import { record } from "../shared/validation";
export type DirectVariant = "svelte" | "vanilla";
export type DirectMeter = { verified: number; browserVerified: number; invalid: number; cookieForwarded: number; initial: number; failed: number; proxyTools: number; sdk: number; resources: number };
const zero = (): DirectMeter => ({ verified: 0, browserVerified: 0, invalid: 0, cookieForwarded: 0, initial: 0, failed: 0, proxyTools: 0, sdk: 0, resources: 0 });
const jwkSchema = z.object({ kty: z.literal("OKP"), crv: z.literal("Ed25519"), x: z.string(), kid: z.string(), alg: z.literal("EdDSA"), use: z.literal("sig") });
const claimsSchema = z.object({ iss: z.string(), sub: z.string(), email: z.string(), room: z.string(), aud: z.string(), iat: z.number(), exp: z.number(), jti: z.string() });
const decode = (value: string) => Uint8Array.from(Buffer.from(value, "base64url"));
async function body(request: Request): Promise<unknown> {
  const reader = request.body?.getReader(); assert(reader);
  let bytes = 0, text = ""; const decoder = new TextDecoder();
  try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; assert(bytes <= 65536); text += decoder.decode(part.value, { stream: true }); } }
  finally { reader.releaseLock(); }
  const value: unknown = JSON.parse(text + decoder.decode()); return value;
}
export async function startDirectMcpFixture(base: string) {
  assert(/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base));
  const sdk = await readFile(new URL("../node_modules/@modelcontextprotocol/ext-apps/dist/src/app-with-deps.js", import.meta.url));
  const sdkMetadata: unknown = JSON.parse(await readFile(new URL("../node_modules/@modelcontextprotocol/ext-apps/package.json", import.meta.url), "utf8"));
  assert(record(sdkMetadata) && sdkMetadata.version === "1.7.4", "Stock Apps SDK version changed");
  const sdkProof = { version: sdkMetadata.version, sha256: createHash("sha256").update(sdk).digest("hex") };
  const jwksResponse = await fetch(base + "/.well-known/jwks.json"); assert(jwksResponse.ok);
  const jwks = z.object({ keys: z.array(jwkSchema) }).parse(await jwksResponse.json());
  const nonce = randomBytes(16).toString("hex");
  const states = new Map<DirectVariant, { room: string; email: string; meter: DirectMeter }>();
  let origin = "";
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
    const url = new URL(request.url);
    const variant = [...states.keys()].find(v => url.pathname.startsWith(`/${nonce}/${v}/`));
    if (!variant) return new Response("missing", { status: 404 });
    const state = states.get(variant); assert(state);
    const prefix = `/${nonce}/${variant}`, endpoint = origin + prefix + "/mcp";
    const headers = { "access-control-allow-origin": base, "access-control-allow-methods": "POST, GET, DELETE, OPTIONS", "access-control-allow-headers": "content-type, accept, x-vibebook-identity, mcp-session-id, mcp-protocol-version, last-event-id", "access-control-expose-headers": "mcp-session-id, mcp-protocol-version", "cache-control": "no-store" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === prefix + "/sdk.js") { state.meter.sdk++; return new Response(new Uint8Array(sdk), { headers: { ...headers, "access-control-allow-origin": "*", "content-type": "text/javascript" } }); }
    if (url.pathname !== prefix + "/mcp") return new Response("missing", { status: 404, headers });
    if (request.method === "GET" || request.method === "DELETE") return new Response(null, { status: request.method === "GET" ? 405 : 200, headers });
    if (request.method !== "POST") return new Response(null, { status: 405, headers });
    try {
      const token = request.headers.get("x-vibebook-identity"); assert(token);
      const parts = token.split("."); assert.equal(parts.length, 3);
      const head = z.object({ alg: z.literal("EdDSA"), kid: z.string() }).parse(JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")));
      const claims = claimsSchema.parse(JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")));
      const jwk = jwks.keys.find(key => key.kid === head.kid); assert(jwk);
      const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
      assert(await crypto.subtle.verify("Ed25519", key, decode(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1])));
      assert.equal(claims.iss, base); assert.equal(claims.aud, endpoint); assert.equal(claims.room, state.room);
      assert.equal(claims.email, state.email); assert.equal(claims.sub, state.email);
      assert(Number.isSafeInteger(claims.iat) && Number.isSafeInteger(claims.exp)); assert.equal(claims.exp - claims.iat, 300);
      assert(claims.iat <= Date.now() / 1000 + 5 && claims.exp > Date.now() / 1000); assert(claims.jti.length > 0);
      state.meter.verified++;
      const browser = request.headers.get("origin") === base;
      if (browser) { state.meter.browserVerified++; if (request.headers.has("cookie")) state.meter.cookieForwarded++; }
      assert(!request.headers.has("authorization"), "No external secret belongs in direct fixture traffic");
      const message = await body(request); assert(record(message) && message.jsonrpc === "2.0" && typeof message.method === "string");
      const params = record(message.params) ? message.params : {};
      const reply = (result: unknown) => Response.json({ jsonrpc: "2.0", id: message.id, result }, { headers: { ...headers, "mcp-session-id": `direct-${variant}` } });
      if (message.method === "initialize") return reply({ protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: {} }, serverInfo: { name: "Controlled direct MCP", version: "1" } });
      if (message.method.startsWith("notifications/")) return new Response(null, { status: 202, headers });
      if (message.method === "tools/list") return reply({ tools: [{ name: "direct_counter", title: "Direct counter", description: "Controlled non-read-only effect", inputSchema: { type: "object" }, annotations: { readOnlyHint: false }, _meta: { ui: { resourceUri: "ui://direct/counter", visibility: ["app"] } } }, { name: "direct_fail", description: "Controlled HTTP failure after dispatch", inputSchema: { type: "object" }, annotations: { readOnlyHint: false } }] });
      if (message.method === "resources/read") {
        assert.equal(params.uri, "ui://direct/counter"); state.meter.resources++;
        const html = `<!doctype html><meta charset="utf-8"><output id="direct-result" data-initial="pending" data-failure="idle"></output><button id="fail">Fail once</button><script type="module">import{App}from${JSON.stringify(origin + prefix + "/sdk.js")};const out=document.getElementById('direct-result');const app=new App({name:'direct-proof',version:'1'},{});app.ontoolresult=result=>{out.dataset.initial=result.structuredContent?.count===1?'received':'unexpected';};document.getElementById('fail').onclick=async()=>{out.dataset.failure='pending';try{const result=await app.callServerTool({name:'direct_fail',arguments:{}});out.dataset.failure=result.isError?'refused':'unexpected';}catch{out.dataset.failure='refused';}};await app.connect();</script>`;
        return reply({ contents: [{ uri: params.uri, mimeType: "text/html;profile=mcp-app", text: html, _meta: { ui: { csp: { resourceDomains: [origin] } } } }] });
      }
      if (message.method === "tools/call") {
        if (!browser) { state.meter.proxyTools++; return new Response("proxy tool forbidden by proof", { status: 502, headers }); }
        if (params.name === "direct_counter") { state.meter.initial++; return reply({ content: [{ type: "text", text: "Controlled direct effect" }], structuredContent: { count: state.meter.initial } }); }
        if (params.name === "direct_fail") { state.meter.failed++; return new Response("controlled failure", { status: 503, headers }); }
      }
      throw Error("unsupported synthetic request");
    } catch {
      state.meter.invalid++; return new Response("invalid controlled request", { status: 400, headers });
    }
  } });
  origin = server.url.origin;
  return { sdk: sdkProof, configure(variant: DirectVariant, room: string, email: string) { const meter = zero(); states.set(variant, { room, email, meter }); return { url: origin + `/${nonce}/${variant}/mcp`, meter }; }, stop: async () => { try { await server.stop(true); } finally { states.clear(); } } };
}
