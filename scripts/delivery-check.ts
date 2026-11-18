// Machines and delivery (src/delivery.ts) against a local `bun run dev` (DEV_EMAIL set): a runner checks in with
// claude_rooms, its Claude follows the machine's switch, a one-off agent has its own, the group switch sets both, and
// turning delivery back on hands over what was held.
//   bun scripts/delivery-check.ts [http://127.0.0.1:8797]   (VB_RESOURCE=<origin>/mcp when the Worker sees another port)
const BASE = process.argv[2] ?? "http://127.0.0.1:8797";
const RESOURCE = process.env.VB_RESOURCE ?? `${BASE}/mcp`;
const ME = "dev@test.local";
const REDIRECT = "http://127.0.0.1:9/cb";
let fails = 0;
const check = (ok: unknown, what: string, extra?: unknown) => {
  console.log(`${ok ? "✓" : "✗"} ${what}${ok ? "" : " " + JSON.stringify(extra ?? "")}`);
  if (!ok) fails++;
};
const b64url = (b: ArrayBuffer | Uint8Array) => Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString("base64url");
const jar = (res: Response) => res.headers.getSetCookie().map((c) => c.split(";")[0]);
async function token(email: string) {
  const reg = (await (await fetch(`${BASE}/oauth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client_name: "machine-check", redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) })).json()) as { client_id: string };
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const q = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: "S256", state: "s", scope: "rooms offline_access", resource: RESOURCE });
  const me = `dev_as=${encodeURIComponent(email)}`;
  const page = await fetch(`${BASE}/authorize?${q}`, { headers: { cookie: me }, redirect: "manual" });
  const handle = (await page.text()).match(/name="handle" value="([^"]+)"/)?.[1] ?? "";
  const ok = await fetch(`${BASE}/authorize?${q}`, { method: "POST", headers: { cookie: [me, ...jar(page)].join("; "), "content-type": "application/x-www-form-urlencoded", origin: BASE }, body: new URLSearchParams({ handle, decision: "approve" }), redirect: "manual" });
  const code = new URL(ok.headers.get("location") ?? REDIRECT).searchParams.get("code") ?? "";
  const tok = (await (await fetch(`${BASE}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: reg.client_id, code_verifier: verifier, resource: RESOURCE }) })).json()) as { access_token: string };
  return tok.access_token;
}
function agent(tok: string) {
  let id = 0, sid = "";
  const rpc = async (method: string, params: Record<string, unknown> = {}) => {
    const r = await fetch(`${BASE}/mcp`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tok}`, ...(sid ? { "mcp-session-id": sid } : {}) }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) });
    sid = r.headers.get("mcp-session-id") ?? sid;
    return (await r.json()) as { result?: any; error?: any };
  };
  const tool = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await rpc("tools/call", { name, arguments: args });
    const text = r.result?.content?.[0]?.text;
    return { out: r.result?.isError ? null : JSON.parse(text ?? "null"), error: r.result?.isError ? text : r.error };
  };
  return { rpc, tool, sid: () => sid };
}
const cookie = { cookie: `dev_as=${encodeURIComponent(ME)}`, origin: BASE };
const api = async (path: string, body?: unknown) => {
  const r = await fetch(`${BASE}${path}`, body === undefined ? { headers: cookie } : { method: "POST", headers: { ...cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, json: (await r.json().catch(() => null)) as any };
};
const say = (text: string) => api(`/api/books/${ROOM}/post`, { text });
const woke = async (a: ReturnType<typeof agent>) => {
  const r = await a.tool("wait_for_messages", { room_id: ROOM, timeout_seconds: 0 });
  if (r.error) console.log("  wait error", r.error);
  const hit = (r.out?.new ?? []).some((x: { room_id: string }) => x.room_id === ROOM);
  if (hit) await a.tool("read_room", { room_id: ROOM });
  return hit;
};

const ROOM = ((await (await fetch(`${BASE}/api/books`, { method: "POST", headers: { ...cookie, "content-type": "application/json" }, body: JSON.stringify({ title: "delivery check" }) })).json()) as { id: string }).id;
const tok = await token(ME);
const runner = agent(tok), machAgent = agent(tok), oneOff = agent(tok);
for (const a of [runner, machAgent, oneOff]) await a.rpc("initialize", { protocolVersion: "2025-06-18" });
// both agents read the room once, so they have a cursor
await machAgent.tool("read_room", { room_id: ROOM });
await oneOff.tool("read_room", { room_id: ROOM });
const MID = "m_" + [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
const rooms = await runner.tool("claude_rooms", { machine: { id: MID, name: "test-mac.local\u0007", kind: "herdr" }, agents: [machAgent.sid()] });
check(!rooms.error, "claude_rooms takes machine + agents", rooms.error);
let ag = await api(`/api/books/${ROOM}/agents`);
const m = ag.json?.machines?.find((x: any) => x.id === MID);
check(m && m.online && m.name === "test-mac.local", "agents API lists the machine online with a clean name", ag.json?.machines);
const mineB = ag.json?.agents?.find((x: any) => x.id === machAgent.sid());
check(mineB?.machine === MID, "the runner's agent belongs to the machine", mineB);

await say("hello 1");
check(await woke(machAgent), "machine agent wakes (machine on by default claude_on)");
check(await woke(oneOff), "one-off agent wakes");

let r = await api(`/api/books/${ROOM}/delivery`, { machine: MID, on: false });
check(r.status === 200, "machine switch off", r);
await say("hello 2");
check(!(await woke(machAgent)), "machine agent muted");
check(await woke(oneOff), "one-off still wakes");
const rr = await runner.tool("claude_rooms", { machine: { id: MID, name: "test-mac", kind: "herdr" }, agents: [] });
check(rr.out?.rooms?.find((x: any) => x.room_id === ROOM)?.on === false, "claude_rooms says off for this machine", rr.out);
ag = await api(`/api/books/${ROOM}/agents`);
check(ag.json.agents.find((x: any) => x.id === machAgent.sid())?.delivery === false, "API shows the machine agent muted");

r = await api(`/api/books/${ROOM}/delivery`, { machine: MID, on: true });
check(await woke(machAgent), "turning the machine back on delivers what was held");

r = await api(`/api/books/${ROOM}/delivery`, { agent: oneOff.sid(), on: false });
check(r.status === 200, "one-off switch off", r);
await say("hello 3");
check(await woke(machAgent), "machine agent wakes");
check(!(await woke(oneOff)), "one-off muted");
r = await api(`/api/books/${ROOM}/delivery`, { agent: machAgent.sid(), on: false });
check(r.status === 400, "a machine's agent has no switch of its own", r);

r = await api(`/api/books/${ROOM}/delivery`, { all: true, on: false });
await say("hello 4");
check(!(await woke(machAgent)) && !(await woke(oneOff)), "group off mutes everything");
r = await api(`/api/books/${ROOM}/delivery`, { all: true, on: true });
check(await woke(machAgent), "group on: machine agent gets the held messages");
check(await woke(oneOff), "group on: one-off gets the held messages");

r = await api(`/api/books/${ROOM}/delivery`, { machine: "m_" + "cd".repeat(16), on: false });
check(r.status === 404, "someone else's / unknown machine refused", r);
console.log(fails ? `${fails} failed` : "all passed");
process.exit(fails ? 1 : 0);
