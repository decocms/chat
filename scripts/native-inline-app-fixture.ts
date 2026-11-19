// Synthetic external MCP server only. Worker/Book/Auth/SDK/private ports stay real.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { record } from "../shared/validation";
export const inlineTools = ["mutate_a", "mutate_b", "mutate_pending"] as const;
export type InlineTool = (typeof inlineTools)[number];
export type InlineCounters = {
  resources: Record<InlineTool, number>;
  initial: Record<InlineTool, number>;
  sdk: number;
  reads: number;
  replacements: number;
  invalid: number;
};
const zero = (): InlineCounters => ({
  resources: { mutate_a: 0, mutate_b: 0, mutate_pending: 0 },
  initial: { mutate_a: 0, mutate_b: 0, mutate_pending: 0 },
  sdk: 0,
  reads: 0,
  replacements: 0,
  invalid: 0,
});
async function boundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        return null;
      }
      text += decoder.decode(part.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
function replacement(hostOrigin: string) {
  return `<!doctype html><meta charset="utf-8"><output id="result" data-origin="pending" data-outcome="pending" data-direct="pending" data-negotiated="pending"></output><script>
const out=document.getElementById('result');out.dataset.origin=window.origin;
const outcomes={901:'pending',903:'pending'};let inherited=false,unexpected=false,timedout=false;
function show(){out.dataset.direct=outcomes[901];out.dataset.negotiated=outcomes[903];out.dataset.outcome=inherited?'inherited':unexpected?'unexpected':timedout?'timeout':Object.values(outcomes).every(value=>value==='refused')?'refused':'pending';}
function send(id,method,params){parent.postMessage({jsonrpc:'2.0',id,method,params},'*');}
addEventListener('message',event=>{if(event.source!==parent||event.origin!==${JSON.stringify(hostOrigin)}||event.data?.jsonrpc!=='2.0')return;
const value=event.data;if(value.id!==901&&value.id!==903)return;
if(value.error||value.result?.isError)outcomes[value.id]='refused';
else if(typeof value.result?.structuredContent?.text==='string'){outcomes[value.id]='inherited';inherited=true;}else{outcomes[value.id]='unexpected';unexpected=true;}show();});
send(901,'tools/call',{name:'read_canonical',arguments:{}});
send(902,'ui/initialize',{appInfo:{name:'replacement',version:'1'},appCapabilities:{},protocolVersion:'2026-01-26'});
setTimeout(()=>send(903,'tools/call',{name:'read_canonical',arguments:{}}),500);
setTimeout(()=>{for(const id of [901,903])if(outcomes[id]==='pending'){outcomes[id]='timeout';timedout=true;}show();},15000);
</script>`;
}
function appDocument(sdkURL: string, destination: string) {
  return `<!doctype html><meta charset="utf-8"><output id="result" data-read="pending" data-initial="pending"></output><button id="read">Read again</button><button id="navigate">Navigate</button><script type="module">
import{App}from${JSON.stringify(sdkURL)};
const out=document.getElementById('result');out.dataset.origin=window.origin;
const app=new App({name:'real-inline-open-fixture',version:'1'},{});
app.ontoolresult=()=>{out.dataset.initial='received';};
async function read(){out.dataset.read='pending';try{const result=await app.callServerTool({name:'read_canonical',arguments:{}});if(typeof result.structuredContent?.text==='string'){out.textContent=result.structuredContent.text;out.dataset.read='ok';}else out.dataset.read='unexpected';}catch{out.dataset.read='error';}}
document.getElementById('read').onclick=read;
document.getElementById('navigate').onclick=()=>location.href=${JSON.stringify(destination)};
try{await app.connect();await read();}catch{out.dataset.read='error';}
</script>`;
}
export async function startInlineAppFixture(hostOrigin: string) {
  const sdk = await readFile(
    resolve(
      import.meta.dir,
      "../node_modules/@modelcontextprotocol/ext-apps/dist/src/app-with-deps.js",
    ),
  );
  const metadata: unknown = JSON.parse(
    await readFile(
      resolve(
        import.meta.dir,
        "../node_modules/@modelcontextprotocol/ext-apps/package.json",
      ),
      "utf8",
    ),
  );
  assert(
    record(metadata) && metadata.version === "1.7.4",
    "Pinned stock SDK changed",
  );
  let state: { counters: InlineCounters; read(): Promise<string> } | undefined;
  const nonce = randomBytes(16).toString("hex");
  let origin = "";
  const clients = new Map<string, string>(),
    tokens = new Map<string, string>();
  type Approval = {
    client: string;
    redirect: string;
    challenge: string;
    state: string;
    resource: string;
    expires: number;
  };
  const approvals = new Map<string, Approval>(),
    codes = new Map<string, Approval>();
  const prefix = `/${nonce}`;
  const second = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const path = new URL(request.url).pathname;
      if (!state || path !== `${prefix}/replacement`)
        return new Response("missing", { status: 404 });
      state.counters.replacements++;
      return new Response(replacement(hostOrigin), {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    },
  });
  try {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const url = new URL(request.url);
        const body =
          request.method === "POST"
            ? await boundedBody(request).catch(() => null)
            : "";
        if (body === null)
          return new Response("large or interrupted", { status: 413 });
        if (url.pathname.startsWith("/.well-known/oauth-protected-resource")) {
          return state &&
            url.pathname ===
              "/.well-known/oauth-protected-resource" + prefix + "/mcp"
            ? Response.json({
                resource: origin + prefix + "/mcp",
                authorization_servers: [origin],
                scopes_supported: ["inline-fixture"],
              })
            : new Response("missing", { status: 404 });
        }
        if (url.pathname === "/.well-known/oauth-authorization-server")
          return Response.json({
            issuer: origin,
            authorization_endpoint: origin + "/authorize",
            token_endpoint: origin + "/token",
            registration_endpoint: origin + "/register",
            response_types_supported: ["code"],
            code_challenge_methods_supported: ["S256"],
            token_endpoint_auth_methods_supported: ["none"],
          });
        if (url.pathname === "/register" && request.method === "POST") {
          let input: unknown;
          try {
            input = JSON.parse(body);
          } catch {
            return new Response("invalid", { status: 400 });
          }
          if (
            !request.headers
              .get("content-type")
              ?.startsWith("application/json") ||
            !record(input) ||
            input.client_name !== "vibebook" ||
            !Array.isArray(input.redirect_uris) ||
            input.redirect_uris.length !== 1 ||
            input.redirect_uris[0] !== hostOrigin + "/api/mcp-oauth/callback" ||
            input.token_endpoint_auth_method !== "none" ||
            JSON.stringify(input.response_types) !== '["code"]' ||
            JSON.stringify(input.grant_types) !==
              '["authorization_code","refresh_token"]'
          )
            return new Response("invalid", { status: 400 });
          const id = randomBytes(16).toString("hex");
          clients.set(id, input.redirect_uris[0]);
          return Response.json({
            client_id: id,
            token_endpoint_auth_method: "none",
          });
        }
        if (url.pathname === "/authorize" && request.method === "GET") {
          const client = url.searchParams.get("client_id") ?? "",
            redirect = url.searchParams.get("redirect_uri") ?? "",
            challenge = url.searchParams.get("code_challenge") ?? "",
            state = url.searchParams.get("state") ?? "",
            resource = url.searchParams.get("resource") ?? "";
          if (
            clients.get(client) !== redirect ||
            url.searchParams.get("response_type") !== "code" ||
            url.searchParams.get("code_challenge_method") !== "S256" ||
            !/^[A-Za-z0-9_-]{43}$/.test(challenge) ||
            !state ||
            url.searchParams.get("scope") !== "inline-fixture" ||
            !state ||
            resource !== origin + prefix + "/mcp"
          )
            return new Response("invalid", { status: 400 });
          const handle = randomBytes(24).toString("hex");
          approvals.set(handle, {
            client,
            redirect,
            challenge,
            state,
            resource,
            expires: Date.now() + 300000,
          });
          return new Response(
            '<!doctype html><title>Controlled provider</title><form method="post" action="/authorize"><input type="hidden" name="handle" value="' +
              handle +
              '"><button id="fixture-provider-approve">Approve controlled provider</button></form>',
            {
              headers: {
                "content-type": "text/html; charset=utf-8",
                "cache-control": "no-store",
              },
            },
          );
        }
        if (url.pathname === "/authorize" && request.method === "POST") {
          if (request.headers.get("origin") !== origin)
            return new Response("origin", { status: 403 });
          if (
            !request.headers
              .get("content-type")
              ?.startsWith("application/x-www-form-urlencoded")
          )
            return new Response("invalid", { status: 400 });
          const form = new URLSearchParams(body),
            handle = form.get("handle");
          const approval =
            typeof handle === "string" ? approvals.get(handle) : undefined;
          if (typeof handle === "string") approvals.delete(handle);
          if (!approval || approval.expires < Date.now())
            return new Response("expired", { status: 400 });
          const code = randomBytes(24).toString("hex");
          codes.set(code, approval);
          const target = new URL(approval.redirect);
          target.searchParams.set("code", code);
          target.searchParams.set("state", approval.state);
          return Response.redirect(target.href, 302);
        }
        if (url.pathname === "/token" && request.method === "POST") {
          if (
            !request.headers
              .get("content-type")
              ?.startsWith("application/x-www-form-urlencoded")
          )
            return new Response("invalid", { status: 400 });
          const form = new URLSearchParams(body),
            code = form.get("code");
          const approval =
            typeof code === "string" ? codes.get(code) : undefined;
          if (typeof code === "string") codes.delete(code);
          const verifier = form.get("code_verifier");
          if (
            !approval ||
            approval.expires < Date.now() ||
            form.get("grant_type") !== "authorization_code" ||
            form.get("client_id") !== approval.client ||
            form.get("redirect_uri") !== approval.redirect ||
            form.get("resource") !== approval.resource ||
            typeof verifier !== "string" ||
            createHash("sha256").update(verifier).digest("base64url") !==
              approval.challenge
          )
            return Response.json({ error: "invalid_grant" }, { status: 400 });
          const token = randomBytes(32).toString("hex");
          tokens.set(token, approval.resource);
          return Response.json({
            access_token: token,
            token_type: "Bearer",
            expires_in: 3600,
          });
        }
        if (!state || !url.pathname.startsWith(prefix + "/"))
          return new Response("missing", { status: 404 });
        if (url.pathname === `${prefix}/sdk.js`) {
          state.counters.sdk++;
          return new Response(new Uint8Array(sdk), {
            headers: {
              "content-type": "text/javascript",
              "access-control-allow-origin": "*",
              "cache-control": "no-store",
            },
          });
        }
        if (url.pathname !== `${prefix}/mcp` || request.method !== "POST")
          return new Response("missing", { status: 404 });
        const bearer = request.headers.get("authorization");
        if (
          !bearer?.startsWith("Bearer ") ||
          tokens.get(bearer.slice(7)) !== origin + prefix + "/mcp"
        )
          return new Response("Sign in to controlled provider", {
            status: 401,
            headers: {
              "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource${prefix}/mcp"`,
            },
          });
        if (
          !request.headers.get("content-type")?.startsWith("application/json")
        )
          return new Response("invalid", { status: 400 });
        let message: unknown;
        try {
          message = JSON.parse(body);
        } catch {
          return new Response("invalid", { status: 400 });
        }
        if (
          !record(message) ||
          message.jsonrpc !== "2.0" ||
          typeof message.method !== "string"
        )
          return new Response("invalid", { status: 400 });
        if (message.method === "notifications/initialized")
          return new Response(null, { status: 202 });
        const result = (value: unknown) =>
          Response.json(
            { jsonrpc: "2.0", id: message.id, result: value },
            { headers: { "mcp-session-id": "inline" } },
          );
        const params = record(message.params) ? message.params : {};
        if (message.method === "initialize")
          return result({
            protocolVersion: "2025-06-18",
            capabilities: { tools: {}, resources: {} },
            serverInfo: { name: "Controlled inline opening", version: "1" },
          });
        if (message.method === "tools/list")
          return result({
            tools: [
              ...inlineTools.map((name) => ({
                name,
                title: name,
                description: "Synthetic external side effect counter",
                inputSchema: { type: "object" },
                annotations: { readOnlyHint: false },
                _meta: {
                  ui: {
                    resourceUri: `ui://inline/${name}`,
                    visibility: ["app"],
                  },
                },
              })),
              {
                name: "read_canonical",
                description:
                  "Read the fixture room through its real Worker MCP agent",
                inputSchema: { type: "object" },
                annotations: { readOnlyHint: true },
              },
            ],
          });
        if (message.method === "resources/read") {
          const tool = inlineTools.find(
            (name) => params.uri === `ui://inline/${name}`,
          );
          if (!tool) {
            state.counters.invalid++;
            return new Response("unknown", { status: 400 });
          }
          state.counters.resources[tool]++;
          return result({
            contents: [
              {
                uri: params.uri,
                mimeType: "text/html;profile=mcp-app",
                text: appDocument(
                  new URL(`${prefix}/sdk.js`, origin).href,
                  new URL(`${prefix}/replacement`, second.url).href,
                ),
                _meta: { ui: { csp: { resourceDomains: [origin] } } },
              },
            ],
          });
        }
        if (message.method === "tools/call") {
          const tool = inlineTools.find((name) => params.name === name);
          if (tool) {
            state.counters.initial[tool]++;
            return result({
              content: [
                { type: "text", text: "Synthetic external effect counted" },
              ],
              structuredContent: { count: state.counters.initial[tool] },
            });
          }
          if (params.name === "read_canonical") {
            state.counters.reads++;
            try {
              return result({
                content: [
                  { type: "text", text: "Real canonical fixture read" },
                ],
                structuredContent: { text: await state.read() },
              });
            } catch {
              return Response.json({
                jsonrpc: "2.0",
                id: message.id,
                error: {
                  code: -32000,
                  message: "Canonical fixture read failed",
                },
              });
            }
          }
        }
        state.counters.invalid++;
        return Response.json({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: "Unsupported fixture method" },
        });
      },
    });
    origin = server.url.origin;
    return {
      sdk: {
        version: "1.7.4",
        sha256: createHash("sha256").update(sdk).digest("hex"),
      },
      configure(read: () => Promise<string>) {
        const counters = zero();
        state = { counters, read };
        return {
          url: new URL(`${prefix}/mcp`, server.url).href,
          counters,
        };
      },
      async close() {
        try {
          await server.stop(true);
        } finally {
          try {
            await second.stop(true);
          } finally {
            state = undefined;
            tokens.clear();
            codes.clear();
            approvals.clear();
            clients.clear();
          }
        }
      },
    };
  } catch (error) {
    await second.stop(true);
    throw error;
  }
}
