import { afterEach, expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { providerAvatarUrl, syncProviderAvatar } from "../src/providerAvatar";
import { githubAvatar } from "../src/githubIdentity";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

function fakeEnv(row?: { avatar: number | null; avatar_src: string | null }) {
  const db = new Database(":memory:");
  db.run(
    "CREATE TABLE users (email TEXT PRIMARY KEY, created_at INTEGER, name TEXT, avatar INTEGER, avatar_src TEXT)",
  );
  if (row)
    db.run(
      "INSERT INTO users (email, created_at, avatar, avatar_src) VALUES ('ana@example.test', 1, ?, ?)",
      [row.avatar, row.avatar_src],
    );
  const puts: { key: string; type?: string; size: number }[] = [];
  const env = {
    DB: {
      prepare: (sql: string) => ({
        bind: (...values: (string | number | null)[]) => ({
          first: async () => db.query(sql).get(...values) ?? null,
          run: async () => db.query(sql).run(...values),
        }),
      }),
    },
    FILES: {
      put: async (
        key: string,
        bytes: ArrayBuffer,
        options?: { httpMetadata?: { contentType?: string } },
      ) => {
        puts.push({
          key,
          type: options?.httpMetadata?.contentType,
          size: bytes.byteLength,
        });
      },
    },
  };
  const user = () =>
    db
      .query(
        "SELECT avatar, avatar_src FROM users WHERE email = 'ana@example.test'",
      )
      .get() as { avatar: number | null; avatar_src: string | null } | null;
  return {
    env: env as unknown as Parameters<typeof syncProviderAvatar>[0],
    puts,
    user,
  };
}

let fetchSpy: ReturnType<typeof spyOn> | undefined;
function serve(
  body: BodyInit,
  headers: Record<string, string>,
  seen: string[] = [],
) {
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async (
    input: Parameters<typeof fetch>[0],
    init?: RequestInit,
  ) => {
    seen.push(String(input));
    expect(init?.redirect).toBe("manual");
    return new Response(body, { headers });
  }) as typeof fetch);
  return seen;
}
afterEach(() => fetchSpy?.mockRestore());

test("only the providers' own picture hosts, over https, at 256px", () => {
  expect(
    providerAvatarUrl(
      "google",
      "https://lh3.googleusercontent.com/a/ACg8oc=s96-c",
    ),
  ).toBe("https://lh3.googleusercontent.com/a/ACg8oc=s256-c");
  expect(
    providerAvatarUrl("google", "https://lh5.googleusercontent.com/a/xyz"),
  ).toBe("https://lh5.googleusercontent.com/a/xyz=s256-c");
  expect(
    providerAvatarUrl(
      "github",
      "https://avatars.githubusercontent.com/u/123?v=4",
    ),
  ).toBe("https://avatars.githubusercontent.com/u/123?v=4&s=256");
  for (const [provider, raw] of [
    ["google", "http://lh3.googleusercontent.com/a/x"],
    ["google", "https://lh3.googleusercontent.com.evil.test/a/x"],
    ["google", "https://evil.test/lh3.googleusercontent.com"],
    ["google", "https://user:pw@lh3.googleusercontent.com/a/x"],
    ["google", "https://lh3.googleusercontent.com:8443/a/x"],
    ["google", "https://avatars.githubusercontent.com/u/1"],
    ["github", "https://lh3.googleusercontent.com/a/x"],
    ["github", "https://127.0.0.1/u/1"],
    ["github", "not a url"],
    ["github", 42],
    ["github", null],
  ] as const)
    expect(providerAvatarUrl(provider, raw)).toBeNull();
});

test("GitHub's avatar_url is read from the profile, never trusted as is", () => {
  expect(
    githubAvatar({
      login: "ana",
      avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
    }),
  ).toBe("https://avatars.githubusercontent.com/u/1?v=4");
  expect(githubAvatar({ login: "ana" })).toBeNull();
  expect(githubAvatar(null)).toBeNull();
});

test("a person with no picture gets the provider's, and a later sign-in replaces it", async () => {
  const { env, puts, user } = fakeEnv();
  serve(PNG, { "content-type": "image/png" });
  expect(
    await syncProviderAvatar(
      env,
      "Ana@example.test",
      "google",
      "https://lh3.googleusercontent.com/a/x=s96-c",
    ),
  ).toBe(true);
  expect(puts).toEqual([
    {
      key: "avatars/ana@example.test",
      type: "image/png",
      size: PNG.byteLength,
    },
  ]);
  expect(user()?.avatar_src).toBe("google");
  expect(user()?.avatar).toBeGreaterThan(0);
  fetchSpy?.mockRestore();
  serve(PNG, { "content-type": "image/jpeg" });
  expect(
    await syncProviderAvatar(
      env,
      "ana@example.test",
      "github",
      "https://avatars.githubusercontent.com/u/1?v=4",
    ),
  ).toBe(true);
  expect(user()?.avatar_src).toBe("github");
  expect(puts).toHaveLength(2);
});

test("a picture the person uploaded is never replaced, including ones from before sources were kept", async () => {
  for (const avatar_src of ["own", null]) {
    const { env, puts, user } = fakeEnv({ avatar: 5, avatar_src });
    const seen = serve(PNG, { "content-type": "image/png" });
    expect(
      await syncProviderAvatar(
        env,
        "ana@example.test",
        "google",
        "https://lh3.googleusercontent.com/a/x",
      ),
    ).toBe(false);
    expect(seen).toEqual([]);
    expect(puts).toEqual([]);
    expect(user()).toEqual({ avatar: 5, avatar_src });
    fetchSpy?.mockRestore();
  }
});

test("an upload that lands while the provider picture downloads wins", async () => {
  const { env, puts, user } = fakeEnv();
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation((async () => {
    await env.DB.prepare(
      "INSERT INTO users (email, created_at, avatar, avatar_src) VALUES ('ana@example.test', 1, 9, 'own')",
    )
      .bind()
      .run();
    return new Response(PNG, { headers: { "content-type": "image/png" } });
  }) as unknown as typeof fetch);
  expect(
    await syncProviderAvatar(
      env,
      "ana@example.test",
      "google",
      "https://lh3.googleusercontent.com/a/x",
    ),
  ).toBe(false);
  expect(puts).toEqual([]);
  expect(user()).toEqual({ avatar: 9, avatar_src: "own" });
});

test("non-images, oversized files and redirects are refused", async () => {
  for (const [body, headers] of [
    ["<svg/>", { "content-type": "image/svg+xml" }],
    ["<html>", { "content-type": "text/html" }],
    [new Uint8Array(1024 * 1024 + 1), { "content-type": "image/png" }],
    [
      PNG,
      {
        "content-type": "image/png",
        "content-length": String(2 * 1024 * 1024),
      },
    ],
  ] as const) {
    const { env, puts, user } = fakeEnv();
    serve(body as BodyInit, headers);
    expect(
      await syncProviderAvatar(
        env,
        "ana@example.test",
        "google",
        "https://lh3.googleusercontent.com/a/x",
      ),
    ).toBe(false);
    expect(puts).toEqual([]);
    expect(user()).toBeNull();
    fetchSpy?.mockRestore();
  }
  const { env, puts } = fakeEnv();
  fetchSpy = spyOn(globalThis, "fetch").mockImplementation(
    (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://evil.test/x.png" },
      })) as unknown as typeof fetch,
  );
  expect(
    await syncProviderAvatar(
      env,
      "ana@example.test",
      "google",
      "https://lh3.googleusercontent.com/a/x",
    ),
  ).toBe(false);
  expect(puts).toEqual([]);
});
