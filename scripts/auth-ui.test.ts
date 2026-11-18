import { expect, mock, test } from "bun:test";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { auth, authServices } = await import("../src/auth");
const { authApi } = await import("../src/api");
import { Hono } from "hono";
import { hc } from "hono/client";
import type { AuthAppType, AuthCtx, AuthServices } from "../src/api";

// Sign-in is with deco Studio. This origin already has a client id in KV, so start needs no network.
const env = {
  SESSION_SECRET: "test",
  OAUTH_KV: {
    get: async (key: string) =>
      key === "studio-client:http://127.0.0.1:8797" ? "fixture-client" : null,
    put: async () => {},
  },
};
const go = async (path: string, init?: RequestInit) => {
  const r = await auth.request(
    `http://127.0.0.1:8797${path}`,
    { redirect: "manual", ...init },
    env,
  );
  return {
    location: r.headers.get("location"),
    cookie: r.headers.get("set-cookie"),
  };
};
const next = (p: string) => encodeURIComponent(p);

test("Studio start keeps only a safe next in the state cookie", async () => {
  const safe = await go(`/studio/start?next=${next("/b/abc")}`);
  expect(safe.location).toStartWith(
    "https://studio.decocms.com/api/auth/mcp/authorize?",
  );
  expect(decodeURIComponent(safe.cookie!)).toContain("|/b/abc|");
  const evil = await go(`/studio/start?next=${next("https://evil.example/")}`);
  expect(decodeURIComponent(evil.cookie!)).toContain("|/|");
  expect(decodeURIComponent(evil.cookie!)).not.toContain("evil.example");
});

test("a failed Studio callback returns to the login with its error", async () => {
  const cookie = (value: string) => ({
    headers: { cookie: `vb_oauth=${encodeURIComponent(value)}` },
  });
  expect(
    (await go("/studio/callback?state=x&code=y", cookie("s|/|v"))).location,
  ).toBe("/login?error=studio");
  expect(
    (await go("/studio/callback?state=s&code=y", cookie("s|/"))).location,
  ).toBe("/login?error=studio");
  expect((await go("/studio/callback")).location).toBe("/login?error=studio");
});

test("the consent page's sign-out form returns to the login with its next", async () => {
  // The real services (logout and loginUrl need no bindings) behind the typed route.
  const app = new Hono<AuthCtx>()
    .use("/auth/*", async (c, next) => {
      c.set(
        "auth",
        authServices(c as never, {
          roomAccess: async () => ({
            state: "missing",
            title: null,
            email: null,
          }),
        }),
      );
      await next();
    })
    .route("/", authApi);
  const out = async (n: string) =>
    (
      await app.request(
        "http://127.0.0.1:8797/auth/logout",
        { method: "POST", body: new URLSearchParams({ next: n }) },
        env,
      )
    ).headers.get("location");
  expect(await out("/b/abc")).toBe(`/login?next=${next("/b/abc")}`);
});

// The typed public routes with fake services: validation, origin check, statuses and bodies as the client sees them.
function authFixture(over: Partial<AuthServices> = {}) {
  const calls: unknown[] = [];
  const svc: AuthServices = {
    sameOrigin: true,
    safeNext: (n) => (n?.startsWith("/b/") ? n : "/"),
    loginUrl: (_n, q) => `/login${q}`,
    logout: () => void calls.push("logout"),
    logoutAll: async () => ({ error: "unauthenticated", status: 401 }),
    roomAccess: async (id) =>
      id === "abc123"
        ? { state: "ask", title: "Room", email: "a@x.dev" }
        : { state: "missing", title: null, email: null },
    ...over,
  };
  const app = new Hono<AuthCtx>()
    .use("/auth/*", async (c, next) => {
      c.set("auth", svc);
      await next();
    })
    .route("/", authApi);
  const client = hc<AuthAppType>("http://127.0.0.1:8797/", {
    fetch: (i: RequestInfo | URL, init?: RequestInit) => app.request(i, init),
  });
  return { client, calls };
}

test("login context: a safe next and only the known Studio error", async () => {
  const { client } = authFixture();
  const r = await client.auth.context.$get({
    query: { next: "https://evil.example/", error: "studio" },
  });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({ next: "/", error: "studio" });
  const r2 = await client.auth.context.$get({
    query: { next: "/b/abc?ui=svelte", error: "<script>" },
  });
  expect(await r2.json()).toEqual({ next: "/b/abc?ui=svelte", error: null });
});

test("a room link's context for the access page", async () => {
  const { client } = authFixture();
  const r = await client.auth.room[":id"].$get({ param: { id: "abc123" } });
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({
    state: "ask",
    title: "Room",
    email: "a@x.dev",
  });
  expect(
    await (
      await client.auth.room[":id"].$get({ param: { id: "zzz999" } })
    ).json(),
  ).toEqual({ state: "missing", title: null, email: null });
});

test("logout answers JSON to the app; logout-all reports a signed-out caller", async () => {
  const { client, calls } = authFixture();
  expect(await (await client.auth.logout.$post()).json()).toEqual({ ok: true });
  expect(calls).toEqual(["logout"]);
  const all = await client.auth["logout-all"].$post();
  expect(all.status).toBe(401);
  expect(await all.json()).toEqual({ error: "unauthenticated" });
});
