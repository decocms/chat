import * as z from "zod/mini";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
const PRODUCTION_FIRE_API = "https://openrouter.ai/api/v1/chat/completions";
const Config = z.object({
  DEV_EMAIL: z.optional(z.string()),
  FIRE_API: z.optional(z.string()),
});
export type FireProvider =
  | { kind: "production"; url: typeof PRODUCTION_FIRE_API }
  | { kind: "local-fixture"; url: string; baseURL: string };
/** Server-owned configuration, never a request field. Invalid overrides cannot
 * fall back to the public provider or carry production credentials. */
export function fireProvider(input: unknown): FireProvider {
  const parsed = Config.safeParse(input);
  if (!parsed.success) throw Error("Invalid Fire provider configuration");
  const { DEV_EMAIL, FIRE_API } = parsed.data;
  if (FIRE_API === undefined)
    return { kind: "production", url: PRODUCTION_FIRE_API };
  const port =
    /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})\/api\/v1\/chat\/completions$/.exec(
      FIRE_API,
    )?.[1];
  if (!DEV_EMAIL?.trim() || !port || Number(port) > 65535)
    throw Error("Invalid Fire provider configuration");
  return {
    kind: "local-fixture",
    url: FIRE_API,
    baseURL: `http://127.0.0.1:${port}/api/v1`,
  };
}
const MAX_FIXTURE_BODY = 256 * 1024;
async function boundedBody(
  body: ReadableStream<Uint8Array> | null,
  kind: "request" | "response",
) {
  const reader = body?.getReader();
  if (!reader) {
    if (kind === "response") return new Uint8Array(0);
    throw Error("Invalid Fire fixture request");
  }
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      if (
        !(part.value instanceof Uint8Array) ||
        (bytes += part.value.byteLength) > MAX_FIXTURE_BODY
      )
        throw Error(`Invalid Fire fixture ${kind}`);
      chunks.push(new Uint8Array(part.value));
    }
    const output = new Uint8Array(bytes);
    let at = 0;
    for (const chunk of chunks) {
      output.set(chunk, at);
      at += chunk.byteLength;
    }
    return output;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
async function cancelInput(input: unknown, init: RequestInit | undefined) {
  const body =
    init?.body instanceof ReadableStream
      ? init.body
      : input instanceof Request
        ? input.body
        : null;
  if (body && !body.locked) await body.cancel().catch(() => {});
}
/** The Proxy retains the platform fetch callable/property contract (including
 * Bun's optional preconnect property) while routing every SDK call through the
 * exact endpoint/credential/redirect boundary. No canonical API is mocked. */
export function fireFixtureTransport(
  provider: FireProvider,
  fetcher: typeof fetch = fetch,
): typeof fetch {
  if (provider.kind === "production") return fetcher;
  const endpoint = provider.url;
  const invoke = async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const rawURL =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input instanceof Request
            ? input.url
            : null;
    if (rawURL !== endpoint) {
      await cancelInput(input, init);
      throw Error("Invalid Fire fixture request");
    }
    const source = input instanceof Request ? input : null;
    let headers: Headers;
    try {
      headers = new Headers(init?.headers ?? source?.headers);
    } catch {
      await cancelInput(input, init);
      throw Error("Invalid Fire fixture request");
    }
    const method = (init?.method ?? source?.method ?? "GET").toUpperCase();
    if (
      method !== "POST" ||
      headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !==
        "application/json"
    ) {
      await cancelInput(input, init);
      throw Error("Invalid Fire fixture request");
    }
    // Do not clone a Request stream: cancelling one tee branch can wait for
    // the other branch forever. Consume/cancel the caller's actual body.
    let stream: ReadableStream<Uint8Array> | null;
    try {
      stream =
        init?.body === undefined && source
          ? source.body
          : init?.body instanceof ReadableStream
            ? init.body
            : new Request(endpoint, { ...init, method, headers }).body;
    } catch {
      await cancelInput(input, init);
      throw Error("Invalid Fire fixture request");
    }
    const body = await boundedBody(stream, "request");
    // The SDK needs a nonempty inert key to construct its headers. None of its
    // auth/cookie/custom headers may leave this local-only transport.
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body,
      signal: init?.signal ?? source?.signal,
      redirect: "manual",
      credentials: "omit",
    });
    const content = await boundedBody(response.body, "response");
    return new Response(content.byteLength ? content : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
  return new Proxy(fetcher, {
    apply(_target, _owner, args) {
      return Reflect.apply(invoke, undefined, args);
    },
  });
}
export function createFireModelProvider(
  provider: FireProvider,
  apiKey: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  if (provider.kind === "production") return createOpenRouter({ apiKey });
  return createOpenRouter({
    apiKey: "vibebook-inert-local-fire-fixture",
    baseURL: provider.baseURL,
    fetch: fireFixtureTransport(provider, fetcher),
  });
}
