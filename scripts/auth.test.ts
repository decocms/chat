import { expect, test } from "bun:test";
import { get } from "svelte/store";
import {
  createAuthApi,
  createAuthLogoutApi,
  AuthFailure,
  oauthQuery,
  type AuthApi,
} from "../web/features/auth/api";

import { createAuthOwner, type AuthClock } from "../web/features/auth/owner";
import {
  createLoginSession,
  createAccessSession,
  createConsentSession,
} from "../web/features/auth/session";
import {
  authContinuation,
  consentReturn,
} from "../web/features/auth/navigation";
import { authPageHtml, authPage, consentLoginUrl } from "../src/auth-page";
import { authIssue } from "../web/features/auth/copy";
import { AuthPageMetadata } from "../shared/authPage";
import type { LoginContext } from "../shared/schemas";
const login: LoginContext = {
  next: "/b/abcdef?pedir=1",
  error: null,
};
const consent = {
  client_name: "<unverified app>",
  client_domain: null,
  redirect_host: "127.0.0.1:4567",
  redirect_is_loopback: true,
  scope: ["rooms"],
  email: "me@test.com",
  handle: "one-time-handle",
};
function api(overrides: Partial<AuthApi> = {}): AuthApi {
  return {
    login: async () => login,
    access: async () => ({
      state: "ask",
      email: "me@test.com",
      title: "<Room>",
    }),
    ask: async () => ({ ok: true }),
    answerInvite: async () => ({ ok: true }),
    consent: async () => consent,
    ...overrides,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function timer() {
  const jobs = new Set<() => void>();
  const clock: AuthClock = {
    schedule: (fn) => {
      jobs.add(fn);
      return fn;
    },
    cancel: (handle) => {
      jobs.delete(handle as () => void);
    },
  };
  return {
    clock,
    jobs,
    fire() {
      for (const fn of [...jobs]) {
        jobs.delete(fn);
        fn();
      }
    },
  };
}
test("continuations stay on supported local routes", () => {
  for (const unsafe of [
    "//evil.test/app",
    "https://evil.test/app",
    "/\\evil.test/app",
    "/app\n",
    "/app-evil",
    "/b/abcdef/extra",
    "/authorizeevil?x=y",
    "javascript:alert(1)",
    "/api/private",
  ])
    expect(authContinuation(unsafe, "https://vibebook.test")).toBe("/");
  expect(
    authContinuation(
      "/authorize?client_id=x&redirect_uri=https%3A%2F%2Fagent.test%2Fcallback",
      "https://vibebook.test",
    ),
  ).toBe(
    "/authorize?client_id=x&redirect_uri=https%3A%2F%2Fagent.test%2Fcallback",
  );
  expect(
    authContinuation("/b/abcdef?t=epic#file", "https://vibebook.test"),
  ).toBe("/b/abcdef?t=epic#file");
  expect(
    authContinuation("/api/books/abcdef/files/123abc", "https://vibebook.test"),
  ).toBe("/api/books/abcdef/files/123abc");
  expect(consentReturn("javascript:alert(1)")).toBeNull();
  expect(consentReturn("https://user:pass@agent.test/callback")).toBeNull();
  expect(consentReturn("http://127.0.0.1:1234/?error=denied")).toBe(
    "http://127.0.0.1:1234/?error=denied",
  );
});
test("shell allowlists only versioned emitted assets and public metadata", () => {
  const version = "0123456789abcdef0123";
  const shell = `<link href="https://fonts.googleapis.com/a"><link href="/app.css?v=${version}"><link rel="stylesheet" href="/svelte-preview/ui.css?v=${version}"><script src="/vendor/marked.js"></script><nav>stale</nav><script type="module" src="/svelte-preview/app.js?v=${version}"></script>`;
  for (const page of ["login", "access", "consent", "file-access"] as const) {
    const html = authPageHtml(shell, { page, lang: "en", autoAccess: false });
    expect(html).toContain(`content="${page}"`);
    expect(html).toContain(`name="vb-v" content="${version}"`);
    expect(html).toContain(`/svelte-preview/app.js?v=${version}`);
    expect(html).toContain(`/svelte-preview/ui.css?v=${version}`);
    expect(html).not.toMatch(/stale|vendor|googleapis|app\.css|<style|<nav/);
    expect(html).not.toContain("handle");
    expect(html).not.toContain("email");
  }
  expect(() =>
    authPageHtml(
      shell + `<script src="/svelte-preview/app.js?v=${version}"></script>`,
      { page: "login", lang: "pt", autoAccess: false },
    ),
  ).toThrow("exactly one");
  expect(() =>
    authPageHtml(shell.replace(/\?v=[a-f0-9]+/g, ""), {
      page: "login",
      lang: "pt",
      autoAccess: false,
    }),
  ).toThrow("versioned");
  expect(() =>
    authPageHtml(shell.replace("/svelte-preview/ui.css", "/other.css"), {
      page: "login",
      lang: "pt",
      autoAccess: false,
    }),
  ).toThrow("exactly one");
  expect(
    AuthPageMetadata.safeParse({
      page: "unknown",
      lang: "en",
      autoAccess: true,
    }).success,
  ).toBe(false);
});
test("typed auth adapters validate malformed success and contextual errors", async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  let response = new Response(JSON.stringify(login));
  const http = createAuthApi(async (input, init) => {
    calls.push({ url: String(input), init });
    return response.clone();
  });
  expect((await http.login("?next=%2Fb%2Fabcdef&error=studio")).next).toBe(
    login.next,
  );
  expect(calls[0]!.url).toContain("next=%2Fb%2Fabcdef");
  response = new Response('{"next":"/","error":"google"}');
  await expect(http.login("")).rejects.toThrow();
  response = new Response('{"error":"rate limited"}', { status: 429 });
  await expect(http.login("")).rejects.toThrow("rate limited");
  response = new Response("not-json");
  await expect(http.access("abcdef")).rejects.toThrow();
  response = new Response(JSON.stringify(consent));
  expect((await http.consent("?client_id=x&state=a%2Bb")).handle).toBe(
    consent.handle,
  );
  expect(calls.at(-1)!.url).toContain("state=a%2Bb");
  response = new Response(
    '{"error":"invalid_request","redirect_to":"https://agent.test/callback?error=invalid"}',
    { status: 400 },
  );
  try {
    await http.consent("?client_id=x");
    throw Error("accepted");
  } catch (error) {
    expect(error).toBeInstanceOf(AuthFailure);
    if (error instanceof AuthFailure)
      expect(error.returnTo).toContain("https://agent.test");
  }
});
test("login loads its context once at a time, shows the Studio error and stops after dispose", async () => {
  const time = timer(),
    answer = deferred<LoginContext>();
  let loads = 0;
  const session = createLoginSession(
    api({
      login: async () => {
        loads++;
        return answer.promise;
      },
    }),
    "?error=studio",
    time.clock,
  );
  const first = session.load();
  session.load();
  expect(loads).toBe(1);
  answer.resolve({ ...login, error: "studio" });
  await first;
  expect(get(session.state)).toMatchObject({
    loading: false,
    error: "studio",
    context: { next: login.next },
  });
  session.dispose();
  expect(time.jobs.size).toBe(0);
  const before = get(session.state);
  await session.load();
  expect(get(session.state)).toEqual(before);
});
test("login load failure keeps no context and shows the error", async () => {
  const time = timer();
  const session = createLoginSession(
    api({
      login: async () => {
        throw new Error("network");
      },
    }),
    "",
    time.clock,
  );
  await session.load();
  expect(get(session.state)).toMatchObject({
    context: null,
    loading: false,
    error: "network",
  });
  session.dispose();
});
test("owner times out requests, aborts transport and prevents old callbacks from stealing retry", async () => {
  const time = timer(),
    owner = createAuthOwner(time.clock),
    old = deferred<string>(),
    values: string[] = [],
    failures: string[] = [];
  let signal: AbortSignal | undefined;
  const first = owner.run(
    (s) => {
      signal = s;
      return old.promise;
    },
    (value) => values.push(value),
    (error) => failures.push(String(error)),
  );
  const callbacks = [...time.jobs];
  time.fire();
  expect(signal?.aborted).toBe(true);
  expect(failures).toEqual(["Error: timeout"]);
  const current = deferred<string>();
  const second = owner.run(
    () => current.promise,
    (value) => values.push(value),
    () => {
      throw Error("stale timer");
    },
  );
  old.resolve("old");
  await first;
  for (const fn of callbacks) fn();
  current.resolve("new");
  await second;
  expect(values).toEqual(["new"]);
  owner.dispose();
  expect(time.jobs.size).toBe(0);
});
test("access sends no bare-link request, auto-request is explicit and ask errors preserve context", async () => {
  const time = timer(),
    destinations: string[] = [];
  let asks = 0;
  const bare = createAccessSession(
    api({
      ask: async () => {
        asks++;
        return { ok: true };
      },
    }),
    "abcdef",
    false,
    (url) => destinations.push(url),
    time.clock,
  );
  await bare.load();
  expect(asks).toBe(0);
  await bare.ask();
  expect(asks).toBe(1);
  expect(destinations).toEqual(["/b/abcdef"]);
  bare.dispose();
  const auto = createAccessSession(
    api({
      ask: async () => {
        asks++;
        throw new Error("rate limited");
      },
    }),
    "abcdef",
    true,
    (url) => destinations.push(url),
    time.clock,
  );
  await auto.load();
  await Promise.resolve();
  expect(asks).toBe(2);
  expect(get(auto.state)).toMatchObject({
    context: { state: "ask" },
    error: "rate limited",
  });
  await auto.load();
  expect(asks).toBe(2);
  auto.dispose();
});
test("asked access polls real context, handles approval and disposal suppresses departed-page navigation", async () => {
  const time = timer(),
    destinations: string[] = [];
  let approved = false;
  const session = createAccessSession(
    api({
      access: async () => ({
        state: approved ? "member" : "asked",
        email: "me@test.com",
        title: "Room",
      }),
    }),
    "abcdef",
    false,
    (url) => destinations.push(url),
    time.clock,
  );
  await session.load();
  expect(time.jobs.size).toBe(1);
  approved = true;
  time.fire();
  await Promise.resolve();
  await Promise.resolve();
  expect(destinations).toEqual(["/b/abcdef"]);
  session.dispose();
  expect(time.jobs.size).toBe(0);
  const late = deferred<Awaited<ReturnType<AuthApi["access"]>>>();
  const old = createAccessSession(
    api({ access: () => late.promise }),
    "abcdef",
    false,
    (url) => destinations.push(url),
    time.clock,
  );
  const pending = old.load();
  old.dispose();
  late.resolve({ state: "member", email: "me@test.com", title: "Room" });
  await pending;
  expect(destinations).toHaveLength(1);
});
test("consent validates context and offers only safe explicit error returns, with stale result suppression", async () => {
  const time = timer(),
    session = createConsentSession(
      api({
        consent: async () => {
          throw new AuthFailure("invalid", 400, "javascript:alert(1)");
        },
      }),
      "?client_id=x",
      time.clock,
    );
  await session.load();
  expect(get(session.state)).toMatchObject({
    error: "invalid",
    returnTo: null,
    context: null,
  });
  session.dispose();
  const late = deferred<typeof consent>(),
    old = createConsentSession(
      api({ consent: () => late.promise }),
      "?client_id=x",
      time.clock,
    );
  const pending = old.load();
  old.dispose();
  const before = get(old.state);
  late.resolve(consent);
  await pending;
  await old.load();
  expect(get(old.state)).toEqual(before);
  expect(time.jobs.size).toBe(0);
});

test("protocol queries preserve duplicate values and treat prototype keys as data", () => {
  const query = oauthQuery("?scope=rooms&scope=offline_access&__proto__=value");
  expect(query.scope).toEqual(["rooms", "offline_access"]);
  expect(Object.hasOwn(query, "__proto__")).toBe(true);
  expect(query["__proto__"]).toBe("value");
  expect(authIssue("en", "toString")).toBe("toString");
});

test("signed-out consent and access mutations expose recovery without navigating or polling forever", async () => {
  const time = timer(),
    urls: string[] = [];
  const access = createAccessSession(
    api({
      ask: async () => {
        throw new AuthFailure("unauthenticated", 401);
      },
    }),
    "abcdef",
    false,
    (url) => urls.push(url),
    time.clock,
  );
  await access.load();
  await access.ask();
  expect(get(access.state).signedOut).toBe(true);
  expect(urls).toEqual([]);
  access.dispose();
  const consent = createConsentSession(
    api({
      consent: async () => {
        throw new AuthFailure("unauthenticated", 401);
      },
    }),
    "?client_id=x",
    time.clock,
  );
  await consent.load();
  expect(get(consent.state).signedOut).toBe(true);
  consent.dispose();
  const before = get(consent.state);
  await consent.load();
  expect(get(consent.state)).toEqual(before);
  expect(time.jobs.size).toBe(0);
});
test("shell rejects mixed asset generations and its no-JS text has no link", () => {
  const a = "a".repeat(20),
    b = "b".repeat(20),
    shell = `<link href="/svelte-preview/ui.css?v=${a}"><script src="/svelte-preview/app.js?v=${a}"></script>`;
  expect(() =>
    authPageHtml(shell.replace("ui.css?v=" + a, "ui.css?v=" + b), {
      page: "consent",
      lang: "en",
      autoAccess: false,
    }),
  ).toThrow("mismatched");
  const html = authPageHtml(shell, {
    page: "consent",
    lang: "en",
    autoAccess: false,
  });
  expect(html).toContain("<noscript>");
  expect(html).not.toContain("<a href");
});

test("failed consent metadata creates no handle and retry remains explicit;500 presentation stays500", async () => {
  const time = timer();
  let calls = 0;
  const session = createConsentSession(
    api({
      consent: async () => {
        calls++;
        return consent;
      },
    }),
    "?client_id=x",
    time.clock,
    true,
  );
  expect(get(session.state)).toMatchObject({
    context: null,
    error: "consent-failed",
    loading: false,
  });
  expect(calls).toBe(0);
  await session.load();
  expect(calls).toBe(1);
  expect(get(session.state).context?.handle).toBe(consent.handle);
  session.dispose();
  const version = "a".repeat(20),
    shell = `<link href="/svelte-preview/ui.css?v=${version}"><script src="/svelte-preview/app.js?v=${version}"></script>`;
  const response = await authPage(
    { ASSETS: { fetch: async () => new Response(shell) } },
    new Request("https://vibebook.test/authorize?client_id=x"),
    "consent",
    { status: 500, consentFailure: true },
  );
  expect(response.status).toBe(500);
  expect(await response.text()).toContain(
    'name="vb-consent-failure" content="1"',
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
  const login = new URL(
    consentLoginUrl("https://vibebook.test/authorize?client_id=x"),
    "https://vibebook.test",
  );
  expect(login.searchParams.get("next")).toBe("/authorize?client_id=x");
});

test("file-access shell preserves denial status and no-store/frame boundary", async () => {
  const version = "a".repeat(20),
    shell = `<link href="/svelte-preview/ui.css?v=${version}"><script src="/svelte-preview/app.js?v=${version}"></script>`;
  for (const status of [401, 403] as const) {
    const response = await authPage(
      { ASSETS: { fetch: async () => new Response(shell) } },
      new Request("https://vibebook.test/api/books/abcdef/files/aa"),
      "file-access",
      { status },
    );
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    const html = await response.text();
    expect(html).toContain('name="vb-page" content="file-access"');
    expect(html).not.toMatch(/app\.css|vendor|<style/);
  }
});
test("file access uses grant-free context and preserves exact file continuation only after explicit ask", async () => {
  const destinations: string[] = [];
  let asks = 0;
  const session = createAccessSession(
    api({
      ask: async () => {
        asks++;
        return { ok: true };
      },
    }),
    "abcdef",
    false,
    (url) => destinations.push(url),
    undefined,
    "#faa",
  );
  await session.load();
  expect(asks).toBe(0);
  expect(destinations).toEqual([]);
  await session.ask();
  expect(asks).toBe(1);
  expect(destinations).toEqual(["/b/abcdef#faa"]);
  session.dispose();
});

test("owned logout adapter uses inferred routes and accepts only a valid JSON acknowledgement", async () => {
  const calls: { url: string; method: string | undefined }[] = [];
  let response = new Response('{"ok":true}');
  const logout = createAuthLogoutApi(async (input, init) => {
    calls.push({ url: String(input), method: init?.method });
    return response.clone();
  });
  expect(await logout(false)).toEqual({ ok: true });
  expect(calls.at(-1)).toMatchObject({ method: "POST" });
  expect(calls.at(-1)!.url).toEndWith("/auth/logout");
  expect(await logout(true)).toEqual({ ok: true });
  expect(calls.at(-1)!.url).toEndWith("/auth/logout-all");
  response = new Response("<html>Sign in</html>", {
    headers: { "content-type": "text/html" },
  });
  await expect(logout(false)).rejects.toThrow();
  response = new Response('{"ok":false}');
  await expect(logout(false)).rejects.toThrow();
  response = new Response('{"error":"cross-site request refused"}', {
    status: 403,
  });
  await expect(logout(true)).rejects.toThrow("cross-site request refused");
});
