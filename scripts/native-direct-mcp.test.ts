// Actual SDK/injected HTTP and pure room-owner fixtures. No Worker/browser acceptance.
import { expect, test } from "bun:test";
import { get } from "svelte/store";
import { Connection, ConnectionIdentityResult } from "../shared/schemas";
import { createDirectMcp } from "../web/features/apps/direct";
import { connectDirectSdk } from "../web/features/apps/directSdk";
import {
  DirectCancelled,
  type DirectSdkModule,
} from "../web/features/apps/directTypes";
import { AppsFailure } from "../web/features/apps/api";
import type { FetchLike } from "../web/app/transport";
import { deferred, manualClock, settle } from "./native-home-fixtures";
const connection: Connection = {
  id: "abcdef123456",
  title: "Server",
  host: "example.test",
  scope: "me",
  owner: "me@example.test",
  mine: true,
  created_at: 1,
  auth: "identity",
  signed_in: false,
  apps: [],
  tools: [],
  context: {},
};
const proof = {
  direct: true as const,
  url: "https://example.test/mcp",
  identity: "synthetic-identity",
  expires_in: 300 as const,
};
const signal = () => new AbortController().signal;
function fixture(
  overrides: Partial<Parameters<typeof createDirectMcp>[0]> = {},
) {
  let identities = 0,
    loads = 0,
    calls = 0,
    proxies = 0,
    disposals = 0,
    active = true;
  const clock = manualClock();
  const owner = createDirectMcp({
    current: () => active,
    clock: clock.clock,
    now: () => 1000,
    identity: async () => {
      identities++;
      return proof;
    },
    proxy: async () => {
      proxies++;
      return { result: "proxy" };
    },
    fetcher: async () => {
      throw Error("Unexpected HTTP");
    },
    load: async () => {
      loads++;
      return {
        connectDirectSdk: async () => ({
          call: async () => {
            calls++;
            return "direct";
          },
          dispose: () => {
            disposals++;
          },
        }),
      };
    },
    ...overrides,
  });
  owner.sync([connection]);
  return {
    owner,
    clock,
    revoke: () => {
      active = false;
      owner.dispose();
    },
    counts: () => ({ identities, loads, calls, proxies, disposals }),
  };
}
test("eligible direct SDK is lazy, reused across metadata refresh, and scope-private", async () => {
  const a = fixture(),
    b = fixture();
  expect(a.counts().loads).toBe(0);
  expect(await a.owner.call(connection.id, "read", {}, signal())).toEqual({
    result: "direct",
  });
  a.owner.sync([{ ...connection }]);
  await a.owner.call(connection.id, "read", {}, signal());
  expect(a.counts()).toEqual({
    identities: 1,
    loads: 1,
    calls: 2,
    proxies: 0,
    disposals: 0,
  });
  expect(get(b.owner.state).size).toBe(0);
  a.revoke();
  b.revoke();
  expect(a.counts().disposals).toBe(1);
  expect(get(a.owner.state).size).toBe(0);
});
test("signed-in and direct:false retain proxy without loading SDK", async () => {
  for (const row of [{ ...connection, signed_in: true }, connection]) {
    const f = fixture({
      identity: async () => ({ direct: false, why: "signed_in" }),
    });
    f.owner.sync([row]);
    expect(await f.owner.call(row.id, "read", {}, signal())).toEqual({
      result: "proxy",
    });
    expect(f.counts().loads).toBe(0);
    f.revoke();
  }
});
test("only setup failure falls back; a started tool failure never replays", async () => {
  const setup = fixture({
    load: async () => {
      throw Error("CORS setup");
    },
  });
  await setup.owner.call(connection.id, "write", {}, signal());
  expect(setup.counts().proxies).toBe(1);
  setup.revoke();
  let attempted = 0;
  const tool = fixture({
    load: async () => ({
      connectDirectSdk: async () => ({
        call: async () => {
          attempted++;
          throw Error("HTTP 503");
        },
        dispose() {},
      }),
    }),
  });
  await expect(
    tool.owner.call(connection.id, "write", {}, signal()),
  ).rejects.toThrow("HTTP 503");
  expect(attempted).toBe(1);
  expect(tool.counts().proxies).toBe(0);
  tool.revoke();
  const denied = fixture({
    identity: async () => {
      throw new AppsFailure("forbidden", 403);
    },
  });
  await expect(
    denied.owner.call(connection.id, "write", {}, signal()),
  ).rejects.toThrow("forbidden");
  expect(denied.counts().proxies).toBe(0);
  denied.revoke();
});
test("removed/changed catalog and reentrant mode revocation prevent network effects", async () => {
  const f = fixture();
  await f.owner.call(connection.id, "read", {}, signal());
  f.owner.sync([]);
  expect(f.counts().disposals).toBe(1);
  await expect(
    f.owner.call(connection.id, "read", {}, signal()),
  ).rejects.toBeInstanceOf(DirectCancelled);
  f.revoke();
  const reentrant = fixture();
  const stop = reentrant.owner.state.subscribe((modes) => {
    if (modes.size) reentrant.revoke();
  });
  await expect(
    reentrant.owner.call(connection.id, "write", {}, signal()),
  ).rejects.toBeInstanceOf(DirectCancelled);
  expect(reentrant.counts().calls).toBe(0);
  expect(reentrant.counts().proxies).toBe(0);
  stop();
});
test("aborted ignored import never attaches late and explicit next attempt can start", async () => {
  const loading = deferred<DirectSdkModule>();
  let attachments = 0;
  const module: DirectSdkModule = {
    connectDirectSdk: async () => {
      attachments++;
      return { call: async () => "okay", dispose() {} };
    },
  };
  let first = true;
  const f = fixture({
    load: () => {
      if (first) {
        first = false;
        return loading.promise;
      }
      return Promise.resolve(module);
    },
  });
  const abort = new AbortController(),
    pending = f.owner.call(connection.id, "read", {}, abort.signal);
  await settle();
  abort.abort();
  await expect(pending).rejects.toBeInstanceOf(DirectCancelled);
  loading.resolve(module);
  await settle();
  expect(attachments).toBe(0);
  expect(await f.owner.call(connection.id, "read", {}, signal())).toEqual({
    result: "okay",
  });
  expect(attachments).toBe(1);
  f.revoke();
});
test("credential deadline starts before identity request and rejects late stale proof", async () => {
  let now = 1000;
  const f = fixture({
    now: () => now,
    identity: async () => {
      now += 275000;
      return proof;
    },
  });
  await f.owner.call(connection.id, "read", {}, signal());
  expect(f.counts().loads).toBe(0);
  expect(f.counts().proxies).toBe(1);
  f.revoke();
});
function protocol(
  options: { sse?: boolean; toolStatus?: number; deferTool?: boolean } = {},
) {
  const seen: {
    method: string;
    headers: Headers;
    init: RequestInit;
    rpc?: string;
  }[] = [];
  const tool = deferred<Response>();
  const fetcher: FetchLike = async (_input, init) => {
    const method = init?.method ?? "GET",
      headers = new Headers(init?.headers);
    if (method === "GET") {
      seen.push({ method, headers, init: init ?? {} });
      return new Response(null, { status: 405 });
    }
    const body: unknown = JSON.parse(String(init?.body));
    if (
      !body ||
      typeof body !== "object" ||
      !("method" in body) ||
      typeof body.method !== "string"
    )
      throw Error("Invalid fixture RPC");
    seen.push({ method, headers, init: init ?? {}, rpc: body.method });
    if (body.method === "notifications/initialized")
      return new Response(null, { status: 202 });
    if (!("id" in body)) throw Error("Missing request id");
    const result =
      body.method === "initialize"
        ? {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: { name: "fixture", version: "1" },
          }
        : { content: [{ type: "text", text: "synthetic result" }] };
    const response = { jsonrpc: "2.0", id: body.id, result };
    if (body.method === "tools/call" && options.deferTool) return tool.promise;
    if (body.method === "tools/call" && options.toolStatus)
      return new Response("refused", { status: options.toolStatus });
    return options.sse && body.method === "tools/call"
      ? new Response(`event: message\ndata: ${JSON.stringify(response)}\n\n`, {
          headers: { "content-type": "text/event-stream" },
        })
      : Response.json(response, {
          headers: { "mcp-session-id": "synthetic-session" },
        });
  };
  return { fetcher, seen, tool };
}
test("actual SDK handles JSON and SSE, private identity/session, and exact fetch constraints", async () => {
  for (const sse of [false, true]) {
    const p = protocol({ sse });
    const owner = await connectDirectSdk({
      url: proof.url,
      identity: () => proof.identity,
      current: () => true,
      signal: signal(),
      fetcher: p.fetcher,
    });
    const result = await owner.call("read", {}, signal());
    expect(result).toMatchObject({
      content: [{ type: "text", text: "synthetic result" }],
    });
    const tools = p.seen.filter((x) => x.rpc === "tools/call");
    expect(tools.length).toBe(1);
    expect(tools[0]?.headers.get("mcp-session-id")).toBe("synthetic-session");
    for (const request of p.seen) {
      expect(request.headers.get("x-vibebook-identity")).toBe(proof.identity);
      expect(request.headers.has("authorization")).toBe(false);
      expect(request.init.credentials).toBe("omit");
      expect(request.init.redirect).toBe("error");
      expect(String(request.init.body)).not.toContain("vb-direct-");
    }
    owner.dispose();
  }
});
test("actual SDK tool failure/redirect is not replayed and aborted HTTP stays owned", async () => {
  for (const status of [503, 307]) {
    const p = protocol({ toolStatus: status });
    const owner = await connectDirectSdk({
      url: proof.url,
      identity: () => proof.identity,
      current: () => true,
      signal: signal(),
      fetcher: p.fetcher,
    });
    await expect(owner.call("write", {}, signal())).rejects.toThrow();
    expect(p.seen.filter((x) => x.rpc === "tools/call").length).toBe(1);
    owner.dispose();
  }
  const p = protocol({ deferTool: true });
  const owner = await connectDirectSdk({
    url: proof.url,
    identity: () => proof.identity,
    current: () => true,
    signal: signal(),
    fetcher: p.fetcher,
  });
  const abort = new AbortController(),
    pending = owner.call("write", {}, abort.signal);
  await settle();
  abort.abort();
  await expect(pending).rejects.toThrow();
  expect(p.seen.find((x) => x.rpc === "tools/call")?.init.signal?.aborted).toBe(
    true,
  );
  p.tool.resolve(
    Response.json({ jsonrpc: "2.0", id: 1, result: { content: [] } }),
  );
  await settle();
  expect(p.seen.filter((x) => x.rpc === "tools/call").length).toBe(1);
  expect(p.seen.some((x) => x.rpc === "notifications/cancelled")).toBe(false);
  owner.dispose();
});
test("actual concurrent SDK calls retain separate abort signals across asynchronous headers", async () => {
  const base = protocol(),
    requests: {
      id: unknown;
      name: string;
      signal: AbortSignal | null | undefined;
      reply: ReturnType<typeof deferred<Response>>;
    }[] = [];
  const fetcher: FetchLike = async (input, init) => {
    const body: unknown =
      init?.method === "POST" ? JSON.parse(String(init.body)) : null;
    if (
      body &&
      typeof body === "object" &&
      "method" in body &&
      body.method === "tools/call" &&
      "params" in body &&
      body.params &&
      typeof body.params === "object" &&
      "name" in body.params &&
      typeof body.params.name === "string" &&
      "id" in body
    ) {
      const reply = deferred<Response>();
      requests.push({
        id: body.id,
        name: body.params.name,
        signal: init?.signal,
        reply,
      });
      return reply.promise;
    }
    return base.fetcher(input, init);
  };
  const owner = await connectDirectSdk({
    url: proof.url,
    identity: () => proof.identity,
    current: () => true,
    signal: signal(),
    fetcher,
  });
  const a = new AbortController(),
    b = new AbortController();
  const first = owner.call("first", {}, a.signal),
    second = owner.call("second", {}, b.signal);
  await settle();
  expect(requests.length).toBe(2);
  a.abort();
  await expect(first).rejects.toThrow();
  expect(requests.find((x) => x.name === "first")?.signal?.aborted).toBe(true);
  expect(requests.find((x) => x.name === "second")?.signal?.aborted).toBe(
    false,
  );
  for (const request of requests)
    request.reply.resolve(
      Response.json({
        jsonrpc: "2.0",
        id: request.id,
        result: { content: [{ type: "text", text: request.name }] },
      }),
    );
  expect(await second).toMatchObject({ content: [{ text: "second" }] });
  owner.dispose();
});

test("retired token public modes and fallback reasons are rejected at the wire boundary", () => {
  expect(Connection.safeParse({ ...connection, auth: "token" }).success).toBe(
    false,
  );
  expect(
    ConnectionIdentityResult.safeParse({ direct: false, why: "token" }).success,
  ).toBe(false);
  expect(
    ConnectionIdentityResult.safeParse({ direct: false, why: "signed_in" })
      .success,
  ).toBe(true);
});
