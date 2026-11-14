// External SDK transport only; canonical API/Book/R2/WS are never mocked here.
import { expect, test } from "bun:test";
import { generateText, Output } from "ai";
import { z } from "zod";
import {
  fireProvider,
  fireFixtureTransport,
  createFireModelProvider,
} from "../src/fire-provider";
const model = "fixture/fire-protocol";
function fixture() {
  let hits = 0,
    redirect = false,
    targetHits = 0;
  const requests: { authorization: boolean; cookie: boolean; body: unknown }[] =
    [];
  const target = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch() {
      targetHits++;
      return new Response("unexpected");
    },
  });
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      if (
        new URL(request.url).pathname !== "/api/v1/chat/completions" ||
        request.method !== "POST"
      )
        return new Response("invalid", { status: 400 });
      hits++;
      requests.push({
        authorization: request.headers.has("authorization"),
        cookie: request.headers.has("cookie"),
        body: await request.json(),
      });
      if (redirect)
        return new Response(null, {
          status: 302,
          headers: { location: new URL("/external", target.url).href },
        });
      return Response.json({
        id: "fixture-fire-1",
        model,
        created: 1,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: JSON.stringify({ answer: "synthetic" }),
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    },
  });
  return {
    url: new URL("/api/v1/chat/completions", server.url).href,
    targetURL: new URL("/external", target.url).href,
    requests,
    hits: () => hits,
    targetHits: () => targetHits,
    redirect() {
      redirect = true;
    },
    stop() {
      server.stop(true);
      target.stop(true);
    },
  };
}
test("provider defaults stay unchanged and explicit local configuration is exact/fail-closed", () => {
  const production = fireProvider({});
  expect(production).toEqual({
    kind: "production",
    url: "https://openrouter.ai/api/v1/chat/completions",
  });
  expect(fireFixtureTransport(production, fetch) === fetch).toBe(true);
  expect(
    fireProvider({
      DEV_EMAIL: "dev@example.test",
      FIRE_API: "http://127.0.0.1:65535/api/v1/chat/completions",
    }),
  ).toEqual({
    kind: "local-fixture",
    url: "http://127.0.0.1:65535/api/v1/chat/completions",
    baseURL: "http://127.0.0.1:65535/api/v1",
  });
  for (const value of [
    null,
    {},
    "",
    true,
    7,
    "https://127.0.0.1:1234/api/v1/chat/completions",
    "http://localhost:1234/api/v1/chat/completions",
    "http://127.0.0.1:0/api/v1/chat/completions",
    "http://127.0.0.1:65536/api/v1/chat/completions",
    "http://127.0.0.1:0123/api/v1/chat/completions",
    "http://127.0.0.1:1234/api/v1/chat/completions?x=secret",
    "http://127.0.0.1:1234/api/v1/chat/completions#x",
    "http://127.0.0.1:1234/api/v1/chat/completions\n",
    "http://127.0.0.1:1234/api/v1/chat/completions\r\n",
    "http://user:key@127.0.0.1:1234/api/v1/chat/completions",
    "http://127.0.0.1:1234/api/v1/chat/%63ompletions",
    "http://127.0.0.1:1234/api/v1/chat/../chat/completions",
  ]) {
    expect(() =>
      fireProvider({ DEV_EMAIL: "dev@example.test", FIRE_API: value }),
    ).toThrow("Invalid Fire provider configuration");
  }
  for (const DEV_EMAIL of [undefined, "", " ", null, 7])
    expect(() =>
      fireProvider({
        DEV_EMAIL,
        FIRE_API: "http://127.0.0.1:1234/api/v1/chat/completions",
      }),
    ).toThrow("Invalid Fire provider configuration");
});
test("actual AI SDK structured output uses real loopback HTTP without any production key header", async () => {
  const server = fixture();
  try {
    const config = fireProvider({
      DEV_EMAIL: "dev@example.test",
      FIRE_API: server.url,
    });
    const result = await generateText({
      model: createFireModelProvider(config, "SYNTHETIC_NEVER_FORWARD")(model),
      output: Output.object({ schema: z.object({ answer: z.string() }) }),
      prompt: "NATIVE_FIRE_PROVIDER_TEST",
      maxRetries: 0,
    });
    expect(result.output).toEqual({ answer: "synthetic" });
    expect(server.hits()).toBe(1);
    expect(server.requests[0].authorization).toBe(false);
    expect(server.requests[0].cookie).toBe(false);
    expect(JSON.stringify(server.requests[0])).not.toContain(
      "SYNTHETIC_NEVER_FORWARD",
    );
    expect(server.requests[0].body).toMatchObject({
      model,
      response_format: { type: "json_schema" },
    });
  } finally {
    server.stop();
  }
});
test("the local transport cannot follow redirects or dispatch a different endpoint", async () => {
  const server = fixture();
  try {
    const transport = fireFixtureTransport(
      fireProvider({ DEV_EMAIL: "dev@example.test", FIRE_API: server.url }),
    );
    expect(await (await fetch(server.targetURL)).text()).toBe("unexpected");
    const beforeTarget = server.targetHits();
    expect(beforeTarget).toBe(1);
    server.redirect();
    const result = await transport(server.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "SYNTHETIC_HEADER",
        cookie: "SYNTHETIC_COOKIE",
      },
      body: "{}",
    });
    expect(result.status).toBe(302);
    expect(server.targetHits()).toBe(beforeTarget);
    expect(server.requests[0].authorization).toBe(false);
    expect(server.requests[0].cookie).toBe(false);
    for (const url of [
      server.url + "?secret=x",
      server.url + "#other",
      server.url.replace("/chat/completions", "/other"),
    ])
      await expect(
        transport(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        }),
      ).rejects.toThrow();
    expect(server.hits()).toBe(1);
    expect(server.targetHits()).toBe(beforeTarget);
  } finally {
    server.stop();
  }
});
test("wrong method/content and over-budget bodies fail before external HTTP", async () => {
  const server = fixture();
  try {
    const transport = fireFixtureTransport(
      fireProvider({ DEV_EMAIL: "dev@example.test", FIRE_API: server.url }),
    );
    await expect(transport(server.url, { method: "GET" })).rejects.toThrow(
      "Invalid Fire fixture request",
    );
    await expect(
      transport(server.url, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "{}",
      }),
    ).rejects.toThrow("Invalid Fire fixture request");
    await expect(
      transport(server.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "x".repeat(256 * 1024 + 1),
      }),
    ).rejects.toThrow("Invalid Fire fixture request");
    expect(server.hits()).toBe(0);
  } finally {
    server.stop();
  }
});

test("rejected request streams and over-budget response streams are cancelled", async () => {
  const endpoint = "http://127.0.0.1:1234/api/v1/chat/completions",
    config = fireProvider({
      DEV_EMAIL: "dev@example.test",
      FIRE_API: endpoint,
    });
  let calls = 0,
    responseCancelled = false;
  const fetcher = new Proxy(fetch, {
    apply() {
      calls++;
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array(256 * 1024 + 1));
            },
            cancel() {
              responseCancelled = true;
            },
          }),
          { headers: { "content-type": "application/json" } },
        ),
      );
    },
  });
  const transport = fireFixtureTransport(config, fetcher);
  for (const [url, type] of [
    [endpoint, "text/plain"],
    [endpoint + "?other=1", "application/json"],
  ] as const) {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([123]));
      },
      cancel() {
        cancelled = true;
      },
    });
    const input = new Request(url, {
      method: "POST",
      headers: { "content-type": type },
      body,
    });
    await expect(transport(input)).rejects.toThrow(
      "Invalid Fire fixture request",
    );
    expect(cancelled).toBe(true);
    expect(calls).toBe(0);
  }
  await expect(
    transport(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  ).rejects.toThrow("Invalid Fire fixture response");
  expect(calls).toBe(1);
  expect(responseCancelled).toBe(true);
});
