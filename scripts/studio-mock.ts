// A mock of deco Studio for local development of Studio agents (src/studioSandbox.ts), as FREESTYLE_API is for
// freestyle. It answers the OAuth sign-in (it consents at once), the organizations, a chat's sandbox and its messages.
// Run it, then put STUDIO_ORIGIN=http://127.0.0.1:8798 in .dev.vars and start `bun run dev`.
//   bun scripts/studio-mock.ts          GET /_log shows the calls it received
const port = Number(process.env.STUDIO_MOCK_PORT ?? 8798);
const origin = `http://127.0.0.1:${port}`;
const log: { path: string; body: unknown }[] = [];
const json = (value: unknown, status = 200) => Response.json(value, { status });

Bun.serve({
  port,
  hostname: "127.0.0.1",
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === "/_log") return json(log);
    if (path === "/.well-known/oauth-authorization-server")
      return json({
        issuer: origin,
        authorization_endpoint: `${origin}/api/auth/mcp/authorize`,
        token_endpoint: `${origin}/api/auth/mcp/token`,
        registration_endpoint: `${origin}/api/auth/mcp/register`,
        scopes_supported: ["openid", "profile", "email", "offline_access"],
        grant_types_supported: ["authorization_code", "refresh_token"],
        code_challenge_methods_supported: ["S256"],
      });
    if (path === "/api/auth/mcp/register")
      return json({ client_id: "mock-client" }, 201);
    if (path === "/api/auth/mcp/authorize") {
      const back = new URL(url.searchParams.get("redirect_uri") ?? origin);
      back.searchParams.set("code", "mock-code");
      back.searchParams.set("state", url.searchParams.get("state") ?? "");
      log.push({ path, body: { scope: url.searchParams.get("scope") } });
      return Response.redirect(back.href, 302);
    }
    if (path === "/api/auth/mcp/token")
      return json({
        access_token: "mock-access",
        refresh_token: "mock-refresh",
        token_type: "Bearer",
        expires_in: 3600,
      });
    if (request.headers.get("authorization") !== "Bearer mock-access")
      return json({ error: "unauthorized" }, 401);
    if (path === "/api/_me/organizations")
      return json({
        organizations: [
          { id: "org_1", slug: "org-example", name: "Example Org" },
          { id: "org_2", slug: "second-example", name: "Second Example" },
        ],
      });
    const body: unknown = await request.json().catch(() => null);
    log.push({ path, body });
    if (path.endsWith("/tools/COLLECTION_VIRTUAL_MCP_GET"))
      return json({ item: { id: "mock-project", title: "Example Store" } });
    if (path.endsWith("/tools/THREAD_SANDBOX_START"))
      return json(
        body && typeof body === "object" && "threadId" in body
          ? { virtualMcpId: "mock-agent", branch: "thread-mock" }
          : { threadId: "thrd_mock" },
      );
    if (path.includes("/sandbox/") && path.endsWith("/bash")) {
      const command =
        body && typeof body === "object" && "command" in body
          ? String(body.command)
          : "";
      // The setup starts detached; every later look finds it done.
      return json({
        stdout: command.includes("vibebook-setup.sh") ? "started\n" : "done\n",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });
    }
    if (path.includes("/decopilot/threads/") && path.endsWith("/messages"))
      return json({ ok: true });
    return json({ error: "not found", path }, 404);
  },
});
console.log(`studio mock on ${origin}`);
