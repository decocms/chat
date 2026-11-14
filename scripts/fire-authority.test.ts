// Actual live-card/storeFile authority consumers; STT uses a fake Workers AI callback.
// These fixtures do not exercise real AI, Durable Object scheduling or R2 atomicity.
import { expect, mock, test } from "bun:test";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { Book } = await import("../src/book");
const { storeFile } = await import("../src/rooms");
const email = "member@example.test",
  book = "abcdef";
const card = {
  root: "c",
  elements: { c: { type: "Card", props: { title: "Safe" }, children: [] } },
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
// Runtime-checked test boundary: no fake receiver is asserted to be Book or Env.
function invoke(name: string, receiver: object, ...args: unknown[]): unknown {
  const method: unknown = Reflect.get(Book.prototype, name);
  if (typeof method !== "function") throw Error("missing actual Book method");
  return Reflect.apply(method, receiver, args);
}
function fixture() {
  let member = true;
  const writes: string[] = [],
    events: unknown[] = [],
    objects = new Set<string>();
  let putWait: Promise<void> | null = null;
  const putStarted = deferred<void>();
  const receiver = {
    bind() {},
    get: () => book,
    members: async () => (member ? [email] : []),
    epics: () => [],
    addMessage: (...args: unknown[]) => {
      writes.push("message");
      events.push(args);
      return { id: 8 };
    },
    broadcast: (event: unknown) => events.push(event),
    sql: {
      exec: (sql: string) => {
        if (/^(?:UPDATE|INSERT)/.test(sql)) writes.push(sql);
        return {
          toArray: () => [{ author: email, card: JSON.stringify(card) }],
        };
      },
    },
  };
  const stub = {
    messageCard: () => JSON.stringify(card),
    fireCard: (...args: unknown[]) => invoke("fireCard", receiver, ...args),
    fetch: async (url: string, init: RequestInit) => {
      const response: unknown = await invoke(
        "fetch",
        receiver,
        new Request(url, init),
      );
      if (!(response instanceof Response)) throw Error("missing response");
      return response;
    },
  };
  const env = {
    MODEL_FAST: "test/model",
    OPENROUTER_API_KEY: "test-only",
    DB: {
      prepare: () => ({
        bind: () => ({
          first: async () => (member ? { present: 1 } : null),
          run: async () => ({}),
        }),
      }),
    },
    BOOK: { idFromName: (id: string) => id, get: () => stub },
    UPLOAD_LIMIT: { limit: async () => ({ success: true }) },
    FILES: {
      get: async () => ({
        httpMetadata: { contentType: "text/plain" },
        customMetadata: { name: "existing.txt" },
        text: async () => "old",
      }),
      put: async (key: string) => {
        objects.add(key);
        putStarted.resolve();
        await putWait;
      },
      delete: async (key: string) => {
        objects.delete(key);
      },
    },
  };
  return {
    env,
    receiver,
    writes,
    events,
    objects,
    putStarted,
    revoke: () => {
      member = false;
    },
    waitPut: (promise: Promise<void>) => {
      putWait = promise;
    },
    store: async () =>
      Reflect.apply(storeFile, undefined, [
        env,
        book,
        email,
        "text/plain",
        new TextEncoder().encode("new").buffer,
        "existing.txt",
        { requireMember: true },
      ]),
  };
}
test("actual Book live-card commit checks current membership even when invoked directly", async () => {
  const f = fixture();
  f.revoke();
  expect(
    await invoke("fireCard", f.receiver, book, email, "main", "safe", card, 7),
  ).toEqual({ ok: false, error: "forbidden" });
  expect(f.writes).toEqual([]);
  expect(f.events).toEqual([]);
});
test("revocation during actual R2 put denies Book file publication and removes only its new key", async () => {
  const f = fixture(),
    released = deferred<void>();
  f.objects.add("prior/version");
  f.waitPut(released.promise);
  const operation = f.store();
  await f.putStarted.promise;
  f.revoke();
  released.resolve();
  await expect(operation).rejects.toThrow("forbidden");
  expect([...f.objects]).toEqual(["prior/version"]);
  expect(f.writes).toEqual([]);
  expect(f.events).toEqual([]);
});
test("authorized Fire publication still commits the original file metadata and one broadcast", async () => {
  const f = fixture();
  await f.store();
  expect(f.objects.size).toBe(1);
  expect(f.writes).toHaveLength(1);
  expect(f.writes[0]).toStartWith("INSERT INTO files");
  expect(f.events).toHaveLength(1);
  expect(f.events[0]).toMatchObject({
    t: "fileAdd",
    file: { name: "existing.txt", author: email, type: "text/plain" },
  });
});

test("actual STT normalizer validates Workers AI output and preserves input hints without casts", async () => {
  const { transcribeSpeech } = await import("../src/speechToText");
  let input: unknown;
  expect(
    await transcribeSpeech(
      new Uint8Array([1, 2, 3]),
      { lang: "portuguese", prompt: "x".repeat(650) },
      async (value) => {
        input = value;
        return { text: "  spoken  " };
      },
    ),
  ).toEqual({ ok: true, text: "spoken" });
  expect(input).toEqual({
    audio: "AQID",
    language: "portu",
    initial_prompt: "x".repeat(600),
    vad_filter: true,
  });
  expect(
    await transcribeSpeech(new Uint8Array([0]), {}, async () => ({})),
  ).toEqual({ ok: true, text: "" });
  for (const value of [
    null,
    3,
    "text",
    { text: 3 },
    { text: null },
    { text: "x".repeat(65537) },
  ]) {
    await expect(
      transcribeSpeech(new Uint8Array([0]), {}, async () => value),
    ).rejects.toThrow();
  }
});
test("actual STT byte consumer enforces chunked cap and cancels oversized input before AI", async () => {
  const { speechAudio } = await import("../src/speechToText");
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(4_000_001));
    },
    cancel() {
      cancelled = true;
    },
  });
  await expect(
    speechAudio(
      new Request("http://local/stt", { method: "POST", body: stream }),
    ),
  ).rejects.toThrow("audio empty or over 4 MB");
  expect(cancelled).toBe(true);
  expect(
    await speechAudio(
      new Request("http://local/stt", {
        method: "POST",
        body: new Uint8Array([0, 1]),
      }),
    ),
  ).toEqual(new Uint8Array([0, 1]));
  await expect(
    speechAudio(new Request("http://local/stt", { method: "POST" })),
  ).rejects.toThrow();
});
