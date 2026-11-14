// Actual Fire/Book/storeFile consumers with a deliberately deferred model/R2.
// These fixtures do not exercise real AI, Durable Object scheduling or R2 atomicity.
import { expect, mock, test } from "bun:test";
import { FireResult } from "../shared/schemas";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
let generate: () => Promise<unknown> = async () => {
  throw Error("unexpected model call");
};
mock.module("ai", () => ({
  generateText: () => generate(),
  Output: { object: (value: unknown) => value },
}));
const { fire } = await import("../src/fire");
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
    firePiece: (...args: unknown[]) => invoke("firePiece", receiver, ...args),
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
    fire: async (body: unknown) =>
      FireResult.parse(
        await Reflect.apply(fire, undefined, [env, book, email, body]),
      ),
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
test("revocation while the actual card/file model is pending causes no write or message", async () => {
  for (const body of [
    { text: "update", card_msg: 7 },
    { text: "update", file_id: "old" },
  ]) {
    const f = fixture(),
      entered = deferred<void>(),
      result = deferred<unknown>();
    generate = () => {
      entered.resolve();
      return result.promise;
    };
    const operation = f.fire(body);
    await entered.promise;
    f.revoke();
    result.resolve({
      output: { card: JSON.stringify(card), title: "Safe" },
      text: "new file",
      usage: {},
    });
    expect(await operation).toEqual({ ok: false, error: "forbidden" });
    expect(f.writes).toEqual([]);
    expect(f.events).toEqual([]);
    expect(f.objects.size).toBe(0);
  }
});
test("actual Book card/piece commit checks current membership even when invoked directly", async () => {
  const f = fixture();
  f.revoke();
  expect(
    await invoke("fireCard", f.receiver, book, email, "main", "safe", card, 7),
  ).toEqual({ ok: false, error: "forbidden" });
  await invoke("firePiece", f.receiver, book, email, "main", "safe", {});
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
