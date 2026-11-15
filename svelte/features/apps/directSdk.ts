// This entire module is imported only after a validated direct:true proof.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CallToolRequestSchema, JSONRPCMessageSchema, isJSONRPCRequest, type RequestId } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { DirectCancelled, type DirectSdkOptions, type DirectSession } from "./directTypes";
type Operation = { signal: AbortSignal; messageId?: RequestId; posts: number };

export async function connectDirectSdk(options: DirectSdkOptions): Promise<DirectSession> {
  const endpoint = new URL(options.url).href,
    lifetime = new AbortController(),
    operations = new Map<RequestId, Operation>(), messages = new Map<RequestId, Operation>();
  let active = true, initialized = false, sequence = 0;
  const current = () => active && options.current() && !lifetime.signal.aborted;
  const check = (signal?: AbortSignal) => {
    if (!current() || signal?.aborted || (!initialized && options.signal.aborted)) throw new DirectCancelled();
  };
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    // No authProvider: SDK authentication retries must never replay a tool.
    requestInit: { credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer" },
    reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 },
    fetch: async (input, init) => {
      check();
      if (new URL(String(input)).href !== endpoint) throw Error("Direct MCP target changed");
      const method = (init?.method ?? "GET").toUpperCase();
      if (method !== "GET" && method !== "POST") throw Error("Unsupported direct MCP request");
      let operation: Operation | undefined;
      if (method === "POST") {
        if (typeof init?.body !== "string") throw Error("Invalid direct MCP body");
        const body: unknown = JSON.parse(init.body);
        const message = JSONRPCMessageSchema.parse(body);
        if (isJSONRPCRequest(message) && message.method === "tools/call") {
          operation = messages.get(message.id);
          if (!operation || operation.posts !== 0) throw Error("Direct MCP tool is never replayed");
          check(operation.signal);
          operation.posts++;
        }
      }
      const identity = options.identity();
      if (!identity) throw Error("Direct MCP identity expired");
      const headers = new Headers(), original = new Headers(init?.headers);
      for (const name of ["content-type", "accept", "mcp-session-id", "mcp-protocol-version", "last-event-id"])
        if (original.has(name)) headers.set(name, original.get(name)!);
      headers.set("x-vibebook-identity", identity);
      const signal = AbortSignal.any([
        lifetime.signal, ...(init?.signal ? [init.signal] : []),
        ...(operation ? [operation.signal] : !initialized ? [options.signal] : []),
      ]);
      check(signal);
      const response = await options.fetcher(endpoint, {
        ...init, method, headers, signal, credentials: "omit", mode: "cors",
        redirect: "error", cache: "no-store", referrerPolicy: "no-referrer",
      });
      if (!current() || signal.aborted) {
        await response.body?.cancel().catch(() => {});
        throw new DirectCancelled();
      }
      // Also refuse redirects in non-browser fixture/custom-fetch runtimes.
      if ((response.status >= 300 && response.status < 400) || response.type === "opaqueredirect") {
        await response.body?.cancel().catch(() => {});
        throw Error("Direct MCP redirects are not followed");
      }
      return response;
    },
  });
  const scoped: Transport = {
    async start() {
      transport.onclose = () => scoped.onclose?.();
      transport.onerror = (error) => scoped.onerror?.(error);
      transport.onmessage = (message, extra) => scoped.onmessage?.(message, extra);
      await transport.start();
    },
    async send(message, sendOptions) {
      check();
      // Actual fetch cancellation owns revocation; never send a later cancellation RPC.
      if ("method" in message && message.method === "notifications/cancelled") throw new DirectCancelled();
      // Public RequestOptions.relatedRequestId is private adapter context. It
      // is stripped before HTTP transport and never enters the JSON-RPC wire.
      const { relatedRequestId, ...httpOptions } = sendOptions ?? {};
      const operation = relatedRequestId === undefined ? undefined : operations.get(relatedRequestId);
      if (operation) check(operation.signal);
      if (isJSONRPCRequest(message) && message.method === "tools/call") {
        if (!operation || operation.messageId !== undefined) throw Error("Unowned direct MCP tool call");
        operation.messageId = message.id;
        messages.set(message.id, operation);
      }
      await transport.send(message, httpOptions);
    },
    close: () => transport.close(),
    get sessionId() { return transport.sessionId; },
    setProtocolVersion: (version) => transport.setProtocolVersion(version),
  };
  const client = new Client({ name: "vibebook", version: "1" }, { capabilities: {} });
  function dispose() {
    if (!active) return;
    active = false;
    lifetime.abort(); operations.clear(); messages.clear();
    void client.close().catch(() => {});
  }
  try {
    check(options.signal);
    await client.connect(scoped, { signal: options.signal, timeout: 20_000 });
    check(options.signal); initialized = true;
  } catch (error) {
    const cancelled = options.signal.aborted || !current();
    dispose();
    if (cancelled) throw new DirectCancelled();
    throw error;
  }
  return {
    dispose,
    async call(name, args, signal) {
      check(signal);
      const params = CallToolRequestSchema.parse({ method: "tools/call", params: { name, arguments: args } }).params;
      const key = `vb-direct-${++sequence}`, operation: Operation = { signal, posts: 0 };
      operations.set(key, operation);
      try {
        const result = await client.callTool(params, undefined, { relatedRequestId: key, signal, timeout: 20_000 });
        check(signal); return result;
      } finally {
        operations.delete(key);
        if (operation.messageId !== undefined) messages.delete(operation.messageId);
      }
    },
  };
}
