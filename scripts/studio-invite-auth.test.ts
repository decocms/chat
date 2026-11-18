import { expect, spyOn, test } from "bun:test";
import { auth, hmac } from "../src/auth";

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

test("Studio token and userinfo boundaries reject malformed or unverified identity before session or writes", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch,
    calls: string[] = [];
  f.client("fixture-client");
  let token: unknown = { access_token: "synthetic-studio-token" },
    profile: unknown = { email: "fixture@example.test", email_verified: true },
    tokenStatus = 200,
    profileStatus = 200,
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
        if (url === `${STUDIO}/api/auth/mcp/token`) {
          const body = new URLSearchParams(String(init?.body));
          expect(body.get("code_verifier")).toBe("fixture-verifier");
          expect(body.get("client_id")).toBe("fixture-client");
          expect(body.get("redirect_uri")).toBe(
            "https://vibebook.test/auth/studio/callback",
          );
          return invalidJSON
            ? new Response("not JSON")
            : Response.json(token, { status: tokenStatus });
        }
        expect(url).toBe(`${STUDIO}/api/auth/mcp/userinfo`);
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer synthetic-studio-token",
        );
        return Response.json(profile, { status: profileStatus });
      },
      { preconnect: originalFetch.preconnect },
    ),
  );
  const rejected = async () => {
    const response = await f.request(callback, oauthCookie());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/login?error=studio");
    expect(response.headers.get("set-cookie")).not.toContain("vb_session=");
    expect(f.writes).toHaveLength(0);
  };
  try {
    for (const invalid of [
      null,
      [],
      {},
      { error: "denied" },
      { access_token: "" },
      { access_token: 42 },
    ]) {
      token = invalid;
      calls.length = 0;
      await rejected();
      expect(calls).toHaveLength(1);
    }
    token = { access_token: "synthetic-studio-token" };
    tokenStatus = 401;
    await rejected();
    tokenStatus = 200;
    invalidJSON = true;
    await rejected();
    invalidJSON = false;
    networkError = true;
    await rejected();
    networkError = false;
    for (const invalid of [
      null,
      [],
      {},
      { email: "fixture@example.test" },
      { email: "fixture@example.test", email_verified: false },
      { email: "fixture@example.test", email_verified: "true" },
      { email: "not-an-email", email_verified: true },
      { email: "fixture@example.test", email_verified: true, name: 4 },
    ]) {
      profile = invalid;
      await rejected();
    }
    profile = { email: "fixture@example.test", email_verified: true };
    profileStatus = 403;
    await rejected();
  } finally {
    provider.mockRestore();
  }
});

test("Studio verified identity starts the session, keeps a safe next and a bounded optional name", async () => {
  const f = fixture(),
    originalFetch = globalThis.fetch;
  f.client("fixture-client");
  let profile: unknown = {
    email: "Fixture@example.test",
    email_verified: true,
    name: null,
  };
  const provider = spyOn(globalThis, "fetch").mockImplementation(
    Object.assign(
      async (input: Parameters<typeof globalThis.fetch>[0]) =>
        Response.json(
          String(input).endsWith("/token")
            ? { access_token: "synthetic-token" }
            : profile,
        ),
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
    profile = {
      email: "Fixture@example.test",
      email_verified: true,
      name: `  ${"N".repeat(80)}  `,
    };
    response = await f.request(callback, oauthCookie("https://foreign.test/"));
    expect(response.headers.get("location")).toBe("/");
    await f.settled();
    const write = f.writes.find((w) => w.sql.includes("INSERT INTO users"));
    expect(write?.values).toContain("N".repeat(60));
    expect(write?.values).toContain("fixture@example.test");
  } finally {
    provider.mockRestore();
  }
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
