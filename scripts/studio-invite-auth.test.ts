import { expect, spyOn, test } from "bun:test";
import { auth, hmac } from "../src/auth";
import { studioAvatarUrl } from "../src/studioAvatar";

function fixture() {
  const reads: { sql: string; values: unknown[] }[] = [],
    writes: { sql: string; values: unknown[] }[] = [],
    pending: Promise<unknown>[] = [],
    used = new Set<unknown>(),
    kv = new Map<string, string>();
  let known = false;
  const env = {
    SESSION_SECRET: "controlled-studio-invite-session",
    OAUTH_KV: {
      async get(key: string) {
        return kv.get(key) ?? null;
      },
      async put(key: string, value: string) {
        kv.set(key, value);
      },
    },
    DB: {
      prepare(sql: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first() {
                reads.push({ sql, values });
                return sql.includes("session_after")
                  ? { session_after: 0 }
                  : known
                    ? { found: 1 }
                    : null;
              },
              async run() {
                writes.push({ sql, values });
                const duplicate =
                  sql.includes("invite_used") && used.has(values[0]);
                if (sql.includes("invite_used")) used.add(values[0]);
                return { meta: { changes: duplicate ? 0 : 1 } };
              },
            };
          },
        };
      },
    },
  };
  return {
    env,
    reads,
    writes,
    known(value: boolean) {
      known = value;
    },
    client(id: string) {
      kv.set("studio-client:https://vibebook.test", id);
    },
    async settled() {
      await Promise.all(pending);
    },
    request(path: string, cookie = "") {
      return auth.request(
        `https://vibebook.test${path}`,
        { headers: { cookie } },
        env,
        {
          waitUntil(promise) {
            pending.push(promise);
          },
          passThroughOnException() {},
          props: {},
        },
      );
    },
  };
}
const encoded = (value: unknown) =>
  btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const oauthCookie = (next = "/b/aaaaaa?ui=svelte") =>
  `vb_oauth=${encodeURIComponent(`fixture-state|${next}|fixture-verifier`)}`;
const callback = "/studio/callback?state=fixture-state&code=fixture-code";
const STUDIO = "https://studio.decocms.com";

test("Studio start registers this origin once, then binds state and a PKCE verifier in the callback cookie", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch,
    registrations: unknown[] = [];
  const provider = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (
        input: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ) => {
        expect(String(input)).toBe(`${STUDIO}/api/auth/mcp/register`);
        registrations.push(JSON.parse(String(init?.body)));
        return Response.json({ client_id: "fixture-client" });
      },
      { preconnect: originalFetch.preconnect },
    ),
  );
  try {
    for (let i = 0; i < 2; i++) {
      const start = await f.request(
        "/studio/start?next=%2Fb%2Faaaaaa%3Fui%3Dsvelte",
      );
      const location = new URL(start.headers.get("location")!);
      expect(location.origin + location.pathname).toBe(
        `${STUDIO}/api/auth/mcp/authorize`,
      );
      expect(location.searchParams.get("client_id")).toBe("fixture-client");
      expect(location.searchParams.get("redirect_uri")).toBe(
        "https://vibebook.test/auth/studio/callback",
      );
      expect(location.searchParams.get("code_challenge_method")).toBe("S256");
      expect(location.searchParams.get("code_challenge")).toMatch(
        /^[A-Za-z0-9_-]{43}$/,
      );
      const cookie = decodeURIComponent(start.headers.get("set-cookie")!);
      expect(cookie).toContain(
        `${location.searchParams.get("state")}|/b/aaaaaa?ui=svelte|`,
      );
      expect(cookie).toContain("HttpOnly");
    }
    // One registration per origin: the client id is kept in KV.
    expect(registrations).toEqual([
      {
        client_name: "deco chat",
        redirect_uris: ["https://vibebook.test/auth/studio/callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code"],
        response_types: ["code"],
        scope: "openid profile email",
      },
    ]);
  } finally {
    provider.mockRestore();
  }
});

test("Studio start without a client id (registration refused) goes back to the login with an error", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch;
  const provider = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(async () => Response.json({ error: "no" }, { status: 400 }), {
      preconnect: originalFetch.preconnect,
    }),
  );
  try {
    const start = await f.request("/studio/start");
    expect(start.headers.get("location")).toBe("/login?error=studio");
    expect(start.headers.get("set-cookie")).toBeNull();
  } finally {
    provider.mockRestore();
  }
});

test("Studio callback checks state, verifier and client before any provider or DB work", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch;
  const provider = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async () => {
        throw Error("State must reject before fetch");
      },
      { preconnect: originalFetch.preconnect },
    ),
  );
  try {
    const noVerifier = `vb_oauth=${encodeURIComponent("fixture-state|/")}`;
    for (const [path, cookie] of [
      [callback, ""],
      [callback, oauthCookie().replace("fixture-state", "wrong-state")],
      [callback, noVerifier],
      ["/studio/callback?state=fixture-state", oauthCookie()],
      // No client id for this origin: nothing was registered.
      [callback, oauthCookie()],
    ]) {
      const response = await f.request(path, cookie);
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/login?error=studio");
      expect(response.headers.get("set-cookie")).toContain("vb_oauth=;");
      expect(response.headers.get("set-cookie")).not.toContain("vb_session=");
    }
    expect(provider).not.toHaveBeenCalled();
    expect(f.writes).toHaveLength(0);
  } finally {
    provider.mockRestore();
  }
});

/** An id_token as Studio sends it: the signature can't be checked (throwaway key), only the claims matter. */
const b64 = (text: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(text)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
const idToken = (claims: unknown) =>
  `${b64(JSON.stringify({ alg: "HS256" }))}.${b64(JSON.stringify(claims))}.c2ln`;
const verified = (more: Record<string, unknown> = {}) => ({
  aud: "fixture-client",
  email: "fixture@example.test",
  email_verified: true,
  ...more,
});

test("Studio token and id_token boundaries reject malformed, foreign or unverified identity before session or writes", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch,
    calls: string[] = [];
  f.client("fixture-client");
  let token: unknown = { id_token: idToken(verified()) },
    tokenStatus = 200,
    invalidJSON = false,
    networkError = false;
  const provider = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (
        input: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ) => {
        const url = String(input);
        calls.push(url);
        if (networkError) throw Error("Controlled provider failure");
        expect(url).toBe(`${STUDIO}/api/auth/mcp/token`);
        const body = new URLSearchParams(String(init?.body));
        expect(body.get("code_verifier")).toBe("fixture-verifier");
        expect(body.get("client_id")).toBe("fixture-client");
        expect(body.get("redirect_uri")).toBe(
          "https://vibebook.test/auth/studio/callback",
        );
        return invalidJSON
          ? new Response("not JSON")
          : Response.json(token, { status: tokenStatus });
      },
      { preconnect: originalFetch.preconnect },
    ),
  );
  const rejected = async () => {
    calls.length = 0;
    const response = await f.request(callback, oauthCookie());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?error=studio");
    expect(response.headers.get("set-cookie")).not.toContain("vb_session=");
    expect(f.writes).toHaveLength(0);
    expect(calls.length).toBeLessThanOrEqual(1);
  };
  try {
    for (const invalid of [
      null,
      [],
      {},
      { error: "denied" },
      { access_token: "only-an-access-token" },
      { id_token: "" },
      { id_token: 42 },
      { id_token: "not-a-jwt" },
      { id_token: "a.%%%.c" },
      { id_token: idToken({}) },
      { id_token: idToken(verified({ email_verified: undefined })) },
      { id_token: idToken(verified({ email_verified: false })) },
      { id_token: idToken(verified({ email_verified: "true" })) },
      { id_token: idToken(verified({ email: "not-an-email" })) },
      { id_token: idToken(verified({ name: 4 })) },
      // Issued to another client: not for us.
      { id_token: idToken(verified({ aud: "other-client" })) },
    ]) {
      token = invalid;
      await rejected();
    }
    token = { id_token: idToken(verified()) };
    tokenStatus = 401;
    await rejected();
    tokenStatus = 200;
    invalidJSON = true;
    await rejected();
    invalidJSON = false;
    networkError = true;
    await rejected();
  } finally {
    provider.mockRestore();
  }
});

test("Studio verified identity starts the session, keeps a safe next and a bounded optional UTF-8 name", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch;
  f.client("fixture-client");
  let claims: unknown = verified({ email: "Fixture@example.test", name: null });
  const provider = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof globalThis.fetch>[0]) =>
        String(input).endsWith("/userinfo")
          ? new Response(null, { status: 404 })
          : Response.json({ access_token: "x", id_token: idToken(claims) }),
      { preconnect: originalFetch.preconnect },
    ),
  );
  try {
    let response = await f.request(callback, oauthCookie());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/b/aaaaaa?ui=svelte");
    const cookie = response.headers.get("set-cookie")!;
    for (const flag of [
      "vb_session=",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      "Max-Age=2592000",
    ])
      expect(cookie).toContain(flag);
    await f.settled();
    expect(
      f.writes.filter((write) => write.sql.includes("INSERT INTO users")),
    ).toHaveLength(0);
    claims = verified({
      email: "Fixture@example.test",
      name: `  João ${"N".repeat(80)}  `,
    });
    response = await f.request(callback, oauthCookie("https://foreign.test/"));
    expect(response.headers.get("location")).toBe("/");
    await f.settled();
    const write = f.writes.find((w) => w.sql.includes("INSERT INTO users"));
    expect(write?.values).toContain(`João ${"N".repeat(55)}`);
    expect(write?.values).toContain("fixture@example.test");
  } finally {
    provider.mockRestore();
  }
});

test("Studio userinfo, when it answers, is the identity; a 404 keeps the id_token claims", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch,
    calls: string[] = [];
  f.client("fixture-client");
  let userinfo: Response | (() => Response) = () =>
    Response.json({
      sub: "u1",
      email: "fixture@example.test",
      email_verified: true,
      name: "From Userinfo",
      picture: "https://lh3.googleusercontent.com/a/photo=s96-c",
    });
  const provider = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (
        input: Parameters<typeof globalThis.fetch>[0],
        init?: Parameters<typeof globalThis.fetch>[1],
      ) => {
        const url = String(input);
        calls.push(url);
        if (url.endsWith("/token"))
          return Response.json({
            access_token: "synthetic-access",
            id_token: idToken(verified({ name: "From Id Token" })),
          });
        if (url.endsWith("/userinfo")) {
          expect(new Headers(init?.headers).get("authorization")).toBe(
            "Bearer synthetic-access",
          );
          return typeof userinfo === "function" ? userinfo() : userinfo;
        }
        // The avatar fetch: refuse it, this fixture has no R2.
        return new Response(null, { status: 404 });
      },
      { preconnect: originalFetch.preconnect },
    ),
  );
  const nameWrite = () =>
    f.writes.find((w) =>
      w.sql.includes("INSERT INTO users (email, created_at, name)"),
    )?.values;
  try {
    let response = await f.request(callback, oauthCookie());
    expect(response.headers.get("set-cookie")).toContain("vb_session=");
    await f.settled();
    expect(nameWrite()).toContain("From Userinfo");
    // The picture from userinfo is fetched at 256px from the Google host.
    expect(calls).toContain("https://lh3.googleusercontent.com/a/photo=s256-c");

    // A Studio without userinfo (404): the id_token claims are used.
    f.writes.length = 0;
    calls.length = 0;
    userinfo = () => new Response(null, { status: 404 });
    response = await f.request(callback, oauthCookie());
    expect(response.headers.get("set-cookie")).toContain("vb_session=");
    await f.settled();
    expect(nameWrite()).toContain("From Id Token");

    // userinfo answers but the identity is not usable: no session.
    for (const bad of [
      () =>
        Response.json({ email: "fixture@example.test", email_verified: false }),
      () => Response.json({ email: "not-an-email", email_verified: true }),
      () => new Response("not JSON"),
      () => new Response(null, { status: 401 }),
      () => new Response(null, { status: 500 }),
    ]) {
      f.writes.length = 0;
      userinfo = bad;
      response = await f.request(callback, oauthCookie());
      expect(response.headers.get("location")).toBe("/login?error=studio");
      expect(response.headers.get("set-cookie")).not.toContain("vb_session=");
      expect(f.writes).toHaveLength(0);
    }
  } finally {
    provider.mockRestore();
  }
});

test("Studio avatar URLs: only Google and GitHub picture hosts, at 256px", () => {
  expect(studioAvatarUrl("https://lh3.googleusercontent.com/a/abc=s96-c")).toBe(
    "https://lh3.googleusercontent.com/a/abc=s256-c",
  );
  expect(studioAvatarUrl("https://avatars.githubusercontent.com/u/1?v=4")).toBe(
    "https://avatars.githubusercontent.com/u/1?v=4&s=256",
  );
  for (const bad of [
    null,
    42,
    "",
    "not a url",
    "http://lh3.googleusercontent.com/a/abc",
    "https://evil.test/a.png",
    "https://lh3.googleusercontent.com.evil.test/a",
    "https://user:pw@avatars.githubusercontent.com/u/1",
    "https://avatars.githubusercontent.com:8443/u/1",
    "data:image/png;base64,AAAA",
    `https://lh3.googleusercontent.com/${"a".repeat(2100)}`,
  ])
    expect(studioAvatarUrl(bad)).toBeNull();
});

async function invite(f: ReturnType<typeof fixture>, value: unknown) {
  const payload = encoded(value);
  return `/invite?t=${payload}.${await hmac(f.env.SESSION_SECRET, `invite:${payload}`)}`;
}
test("correctly signed malformed invites reject before DB/session effects or unsafe continuation", async () => {
  const f = fixture(),
    valid = { e: "new@example.test", b: "aaaaaa", x: Date.now() + 60000 };
  for (const value of [
    null,
    [],
    {},
    { ...valid, e: {} },
    { ...valid, e: "invalid" },
    { ...valid, b: {} },
    { ...valid, b: "aaaaaa/../other" },
    { ...valid, b: "aaaaaa?ui=svelte" },
    { ...valid, x: "9999999999999" },
    { ...valid, x: null },
  ]) {
    const response = await f.request(await invite(f, value));
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login");
    expect(response.headers.get("set-cookie")).toBeNull();
  }
  const response = await f.request((await invite(f, valid)).replace(/.$/, "!"));
  expect(response.headers.get("location")).toBe("/login");
  expect(f.reads).toHaveLength(0);
  expect(f.writes).toHaveLength(0);
});

test("valid expired invites preserve room login continuation without DB or session work", async () => {
  const f = fixture();
  for (const x of [0, Date.now() - 60000]) {
    const response = await f.request(
      await invite(f, { e: "expired@example.test", b: "aaaaaa", x }),
    );
    expect(response.headers.get("location")).toBe("/login?next=%2Fb%2Faaaaaa");
    expect(response.headers.get("set-cookie")).toBeNull();
  }
  expect(f.reads).toHaveLength(0);
  expect(f.writes).toHaveLength(0);
});

test("valid invite remains one-time first-account login and does not replace an existing session", async () => {
  const f = fixture(),
    path = await invite(f, {
      e: "new@example.test",
      b: "aaaaaa",
      x: Date.now() + 60000,
    });
  let response = await f.request(path);
  expect(response.headers.get("location")).toBe("/b/aaaaaa");
  expect(response.headers.get("set-cookie")).toContain("vb_session=");
  await f.settled();
  response = await f.request(path);
  expect(response.headers.get("location")).toBe("/login?next=%2Fb%2Faaaaaa");
  expect(response.headers.get("set-cookie")).toBeNull();
  const payload = encoded({ email: "already@example.test", iat: Date.now() }),
    signature = await hmac(f.env.SESSION_SECRET, payload),
    writes = f.writes.length;
  response = await f.request(path, `vb_session=${payload}.${signature}`);
  expect(response.headers.get("location")).toBe("/b/aaaaaa");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(f.writes).toHaveLength(writes);
  const known = fixture();
  known.known(true);
  response = await known.request(
    await invite(known, {
      e: "known@example.test",
      b: "aaaaaa",
      x: Date.now() + 60000,
    }),
  );
  expect(response.headers.get("location")).toBe("/login?next=%2Fb%2Faaaaaa");
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(known.writes).toHaveLength(0);
});
