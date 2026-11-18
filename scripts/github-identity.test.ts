import { expect, test, spyOn } from "bun:test";
import { githubEmail, githubName, githubToken } from "../src/githubIdentity";
import { auth } from "../src/auth";

test("GitHub callback refuses malformed identity and preserves safe native continuation", async () => {
  const calls: string[] = [],
    writes: unknown[][] = [],
    stored: string[] = [],
    pending: Promise<unknown>[] = [];
  const env = {
    SESSION_SECRET: "controlled-github-session",
    GITHUB_CLIENT_ID: "fixture-client",
    GITHUB_CLIENT_SECRET: "fixture-secret",
    DB: {
      prepare: () => ({
        bind: (...values: unknown[]) => ({
          first: async () => null,
          run: async () => {
            writes.push(values);
          },
        }),
      }),
    },
    FILES: {
      put: async (key: string) => {
        stored.push(key);
      },
    },
  };
  let emails: unknown = [
    { email: "Fixture@example.test", primary: true, verified: true },
  ];
  let tokenStatus = 200;
  const originalFetch = globalThis.fetch;
  const fetch = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (
        input: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ) => {
        const url = String(input);
        calls.push(url);
        if (url.startsWith("https://avatars.githubusercontent.com/")) {
          // A public picture: the provider token never goes along.
          expect(new Headers(init?.headers).get("authorization")).toBeNull();
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            headers: { "content-type": "image/png" },
          });
        }
        if (url === "https://github.com/login/oauth/access_token")
          return Response.json(
            { access_token: "synthetic-token" },
            { status: tokenStatus },
          );
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer synthetic-token",
        );
        if (url.endsWith("/user/emails")) return Response.json(emails);
        if (url.endsWith("/user"))
          return Response.json({
            name: null,
            login: "fixture-login",
            avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
          });
        throw Error("Unexpected provider URL");
      },
      { preconnect: originalFetch.preconnect },
    ),
  );
  const request = () =>
    auth.request(
      "https://vibebook.test/github/callback?state=fixture-state&code=fixture-code",
      {
        headers: {
          cookie: `vb_oauth=${encodeURIComponent("fixture-state|/b/aaaaaa?ui=svelte")}`,
        },
      },
      env,
      {
        waitUntil: (promise) => pending.push(promise),
        passThroughOnException() {},
        props: {},
      },
    );
  try {
    let response = await request();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/b/aaaaaa?ui=svelte");
    expect(response.headers.get("set-cookie")).toContain("vb_session=");
    await Promise.all(pending);
    expect(writes.some((values) => values.includes("fixture-login"))).toBe(
      true,
    );
    // The GitHub picture becomes the avatar (no picture of their own yet).
    expect(calls).toContain(
      "https://avatars.githubusercontent.com/u/1?v=4&s=256",
    );
    expect(stored).toEqual(["avatars/fixture@example.test"]);
    expect(writes.some((values) => values.includes("github"))).toBe(true);
    emails = [{ email: { value: "bad" }, primary: true, verified: true }];
    const before = writes.length;
    response = await request();
    expect(response.headers.get("location")).toBe("/login?error=github");
    expect(response.headers.get("set-cookie")).not.toContain("vb_session=");
    expect(writes).toHaveLength(before);
    tokenStatus = 401;
    calls.length = 0;
    response = await request();
    expect(response.status).toBe(302);
    expect(calls).toHaveLength(1);
    expect(response.headers.get("set-cookie")).not.toContain("vb_session=");
  } finally {
    fetch.mockRestore();
  }
});

test("GitHub identity requires a verified primary email with typed provider fields", () => {
  expect(
    githubEmail([
      {
        email: "primary@example.test",
        primary: true,
        verified: true,
        visibility: "private",
      },
    ]),
  ).toBe("primary@example.test");
  expect(
    githubEmail([
      { email: "secondary@example.test", primary: false, verified: true },
      { email: "unverified@example.test", primary: true, verified: false },
    ]),
  ).toBeNull();
  for (const value of [
    null,
    {},
    [],
    "email",
    [{ email: 42, primary: true, verified: true }],
    [{ email: "a@example.test", primary: "true", verified: true }],
    [{ email: "a@example.test", primary: true, verified: "false" }],
    [null],
  ])
    expect(githubEmail(value)).toBeNull();
});

test("GitHub tokens reject malformed success and provider error payloads", () => {
  expect(
    githubToken({ access_token: "synthetic-token", token_type: "bearer" }),
  ).toBe("synthetic-token");
  for (const value of [
    null,
    [],
    {},
    { error: "bad_verification_code" },
    { access_token: "" },
    { access_token: 123 },
    { access_token: { token: "bad" } },
  ])
    expect(githubToken(value)).toBeNull();
});

test("optional GitHub profile data only affects a bounded display name", () => {
  expect(githubName({ name: null, login: "login" })).toBe("login");
  expect(githubName({ name: "  Display name  ", login: "login" })).toBe(
    "Display name",
  );
  expect(githubName({ name: "", login: "fallback" })).toBe("fallback");
  expect(githubName({ name: "x".repeat(100) })).toHaveLength(60);
  for (const value of [null, [], {}, { name: 123 }, { login: [] }])
    expect(githubName(value)).toBe("");
});
