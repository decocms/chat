import { describe, expect, test } from "bun:test";
import {
  uiNavigationUrl,
  uiShellPath,
  uiSwitchUrl,
  uiVariant,
} from "../shared/uiVariant";
import { selectUi, uiSwitch } from "../src/ui-select";
import { createUiNavigation } from "../svelte/navigation";
import { readFile } from "node:fs/promises";

describe("Svelte by default, vanilla on request", () => {
  test("a URL without ui (or an unknown one) selects Svelte; ui=vanilla selects vanilla", () => {
    for (const query of [
      "",
      "?ui=unknown",
      "?ui=SVELTE",
      "?t=epic",
      "?ui=svelte",
    ])
      expect(uiShellPath(`https://vibebook.dev/b/abcdef${query}`)).toBe(
        "/app-svelte",
      );
    expect(uiVariant("https://vibebook.dev/app?ui=vanilla")).toBe("vanilla");
    expect(uiShellPath("https://vibebook.dev/b/abcdef?t=epic&ui=vanilla")).toBe(
      "/app",
    );
  });
  test("navigation keeps vanilla's marker, the thread, login continuation and file hash; the default needs none", () => {
    const current = "https://vibebook.dev/b/abcdef?ui=vanilla";
    expect(uiNavigationUrl("/b/123abc?t=epic#f123", current, "vanilla")).toBe(
      "/b/123abc?t=epic&ui=vanilla#f123",
    );
    expect(
      uiNavigationUrl("/login?next=%2Fb%2Fabcdef", current, "vanilla"),
    ).toBe("/login?next=%2Fb%2Fabcdef&ui=vanilla");
    expect(uiNavigationUrl("/app?ui=svelte", current, "svelte")).toBe("/app");
    for (const target of [
      "/api/books/abcdef/files",
      "https://other.example/app",
      "/pt",
      "mailto:a@example.test",
    ])
      expect(uiNavigationUrl(target, current, "vanilla")).toBe(target);
  });
  test("history adapter preserves state and leaves history API untouched", () => {
    const calls: unknown[][] = [];
    const history = {
      pushState(...args: unknown[]) {
        calls.push(args);
      },
      replaceState(...args: unknown[]) {
        calls.push(args);
      },
    };
    const original = history.pushState;
    const navigation = createUiNavigation(
      history,
      () => "https://vibebook.dev/app?ui=svelte",
      "svelte",
    );
    const sheet = { sheet: 1 };
    navigation.pushState(sheet, "", "/b/abcdef?t=epic&ui=svelte");
    navigation.replaceState(null, "", "/archived");
    navigation.pushState(null, "");
    expect(calls).toEqual([
      [sheet, "", "/b/abcdef?t=epic"],
      [null, "", "/archived"],
      [null, "", undefined],
    ]);
    expect(history.pushState).toBe(original);
  });
  test("preview shell and vanilla shell use disjoint entry assets", async () => {
    const vanilla = await readFile(
      new URL("../public/app.html", import.meta.url),
      "utf8",
    );
    const preview = await readFile(
      new URL("../public/app-svelte.html", import.meta.url),
      "utf8",
    );
    expect(vanilla).not.toContain("/svelte-preview/");
    expect(vanilla).not.toContain('name="vb-ui"');
    expect(vanilla).toContain('import("/svelte/ui.js")');
    expect(preview).toContain('name="vb-ui" content="svelte"');
    expect(preview).toContain("/svelte-preview/app.js");
    expect(preview).not.toContain('src="/svelte/ui.js"');
  });
});

describe("the Worker picks the app per page request (src/ui-select.ts)", () => {
  const ui = (r: Request) => new URL(r.url).searchParams.get("ui");
  const page = (path: string, cookie?: string, method = "GET") =>
    new Request(`https://vibebook.dev${path}`, {
      method,
      headers: cookie ? { cookie } : {},
    });
  test("pages get Svelte, a device that chose vanilla gets vanilla, UI_DEFAULT=vanilla sends everyone back", () => {
    for (const path of [
      "/app",
      "/archived",
      "/login",
      "/authorize",
      "/b/abcdef",
      "/api/books/abcdef/files/0a1b",
      "/api/books/abcdef/connections/cid123/signin",
      "/api/mcp-oauth/callback",
    ]) {
      expect(ui(selectUi(page(path), {}))).toBe("svelte");
      expect(ui(selectUi(page(path, "x=1; vb_ui=vanilla"), {}))).toBe(
        "vanilla",
      );
      expect(ui(selectUi(page(path), { UI_DEFAULT: "vanilla" }))).toBe(
        "vanilla",
      );
    }
  });
  test("the URL's own ui wins for that page; API calls, sockets, posts and other paths are left alone", () => {
    expect(ui(selectUi(page("/b/abcdef?ui=svelte", "vb_ui=vanilla"), {}))).toBe(
      "svelte",
    );
    expect(ui(selectUi(page("/app?ui=vanilla"), {}))).toBe("vanilla");
    for (const path of ["/api/me", "/ws/abcdef", "/pt", "/app-svelte", "/mcp"])
      expect(ui(selectUi(page(path, "vb_ui=vanilla"), {}))).toBeNull();
    expect(ui(selectUi(page("/authorize", "", "POST"), {}))).toBeNull();
  });
  test("the switch stores vanilla on this device (svelte clears it) and returns to the same page, same-origin only", () => {
    const off = uiSwitch(
      page(
        uiSwitchUrl(
          "vanilla",
          "https://vibebook.dev/b/abcdef?t=e1&ui=svelte#m7",
        ),
      ),
    );
    expect(off.status).toBe(302);
    expect(off.headers.get("location")).toBe("/b/abcdef?t=e1#m7");
    expect(off.headers.get("set-cookie")).toContain("vb_ui=vanilla");
    const on = uiSwitch(page("/ui/svelte?next=%2Fapp"));
    expect(on.headers.get("location")).toBe("/app");
    expect(on.headers.get("set-cookie")).toContain("Max-Age=0");
    for (const next of [
      "https://evil.example/app",
      "//evil.example/app",
      "javascript:alert(1)",
    ])
      expect(
        uiSwitch(
          page(`/ui/vanilla?next=${encodeURIComponent(next)}`),
        ).headers.get("location"),
      ).toBe("/app");
    expect(uiSwitch(page("/ui/other")).status).toBe(404);
  });
});
