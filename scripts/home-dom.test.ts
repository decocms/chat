// Component-level Happy DOM fixtures only. No Worker, real browser, auth or room is represented.
import { afterEach, expect, test } from "bun:test";
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";
import { Window } from "happy-dom";
import { get, writable } from "svelte/store";
import { createPersonalSession } from "../web/features/home/personal";
import { createRoomsSession } from "../web/features/rooms/session";
import { createNewRoomSession } from "../web/features/home/session";
import { createAccountSession } from "../web/features/account/session";
import { createApplicationInbox } from "../web/features/application/inbox";
import type { HomeApi } from "../web/features/home/api";
import type { AccountApi } from "../web/features/account/api";
import type { RoomTarget } from "../web/features/home/model";
import type { InboxMention, InboxTask } from "../web/app/types";
import { createPwaService } from "../web/features/pwa/service";
import {
  deferred,
  homeApi,
  manualClock,
  me,
  room,
  settle,
  suggestion,
} from "./home-fixtures";
const environment = new Window({ url: "https://vibebook.test/" });
for (const name of [
  "window",
  "document",
  "navigator",
  "location",
  "Notification",
  "localStorage",
  "StorageEvent",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLAnchorElement",
  "HTMLImageElement",
  "Image",
  "HTMLMediaElement",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "SVGElement",
  "DocumentFragment",
  "Text",
  "Comment",
  "MutationObserver",
  "ResizeObserver",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "CustomEvent",
  "getComputedStyle",
  "matchMedia",
  "requestAnimationFrame",
  "cancelAnimationFrame",
]) {
  const value =
    name === "window" ? environment : Reflect.get(environment, name);
  Object.defineProperty(globalThis, name, {
    value:
      typeof value === "function" &&
      [
        "getComputedStyle",
        "matchMedia",
        "requestAnimationFrame",
        "cancelAnimationFrame",
      ].includes(name)
        ? value.bind(environment)
        : value,
    configurable: true,
    writable: true,
  });
}
plugin({
  name: "home-components",
  setup(build) {
    build.onLoad({ filter: /\.svelte\.js$/ }, (args) => ({
      contents: compileModule(readFileSync(args.path, "utf8"), {
        filename: args.path,
        generate: "client",
      }).js.code,
      loader: "js",
    }));
    build.onLoad({ filter: /\.svelte$/ }, (args) => ({
      contents: compile(readFileSync(args.path, "utf8"), {
        filename: args.path,
        generate: "client",
        css: "injected",
      }).js.code,
      loader: "js",
    }));
  },
});
const { mount, unmount, flushSync, tick } = await import("svelte");
const { default: Home } = await import("../web/features/home/HomePanel.svelte");
const { default: Inbox } =
  await import("../web/features/application/Inbox.svelte");
const { default: WaitList } =
  await import("../web/features/home/WaitList.svelte");
const { default: AppNavigation } =
  await import("../web/features/app-navigation/AppNavigation.svelte");
const { default: NavigationDialogs } =
  await import("../web/features/app-navigation/AppNavigationDialogs.svelte");
const { default: RoomTile } =
  await import("../web/features/home/RoomTile.svelte");
const { default: ApplicationShellHarness } =
  await import("./application-shell-harness.svelte");
const { shellFixture } = await import("./application-shell-fixtures");
const { default: HomeInbox } =
  await import("../web/features/application/HomeInbox.svelte");
const { default: RoomShellHarness } =
  await import("./room-shell-harness.svelte");
const { createRoomResources } =
  await import("../web/features/application/roomResources");
const { createCallHub, setCallHub } = await import("../web/features/call/hub");
import type { Room, RoomEvent } from "../shared/room";
import type { OrgRoom } from "../shared/schemas";
import type { CallApi } from "../web/features/call/callApi";
import { CALL_THREAD } from "../shared/call";
import type { RoomScopeBrowser } from "../web/features/room-scope/types";
import type { RoomLayoutBrowser } from "../web/features/room-layout/types";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanups.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  localStorage.clear();
});
const flush = async () => {
  await settle();
  flushSync();
  await tick();
};
// An actual lazy module can require a compiler/import task beyond tick(). Wait
// for the real feature node, never treat its loading placeholder as readiness.
const waitForView = async (root: ParentNode, selector: string) => {
  const deadline = Date.now() + 4_000;
  while (!root.querySelector(selector) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await flush();
  }
  expect(root.querySelector(selector)).not.toBeNull();
};
test("direct application shell renders Home/Archive and the required room snippet, then releases document owners", async () => {
  const h = shellFixture(),
    target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(ApplicationShellHarness, {
      target,
      props: { services: h.services, effects: h.effects },
    }),
  );
  await flush();
  expect(target.querySelector("[data-app-shell]") !== null).toBe(true);
  expect(h.services.active()).toBe(true);
  expect(h.languages).toEqual(["document:en"]);
  await waitForView(target, "[data-app-navigation]");
  const navigation = target.querySelector("[data-app-navigation]");
  expect(navigation).not.toBeNull();
  h.services.actions.archived();
  await flush();
  await waitForView(target, '[data-view="archived"]');
  expect(target.querySelector('[data-view="archived"]') !== null).toBe(true);
  h.services.actions.navigate({ roomId: "aaaaaa" });
  await flush();
  expect(target.querySelector("[data-test-room-snippet]") !== null).toBe(true);
  expect(target.querySelector("[data-app-navigation]")).toBe(navigation);
  expect(
    target.querySelector("[data-application-route] [data-test-room-snippet]"),
  ).not.toBeNull();
  h.services.actions.home();
  await flush();
  // A desktop's Home is the Caixa de entrada once you have rooms (Gimenes #3967).
  await waitForView(target, "[data-home-inbox]");
  expect(target.querySelector("[data-app-navigation]")).toBe(navigation);
  flushSync(() => {
    void unmount(component);
  });
  await flush();
  expect(h.services.active()).toBe(false);
  expect(h.stopped).toContain("theme");
  expect(h.stopped).toContain("navigation");
  expect(h.stopped).toContain("pop");
});
test("direct Account composition preserves profile confirmation and supplies real notification/agent snippets", async () => {
  const h = shellFixture(),
    target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(ApplicationShellHarness, {
      target,
      props: { services: h.services, effects: h.effects },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  h.services.actions.openAccount("profile");
  await flush();
  await waitForView(document, "#account-name");
  const name = document.querySelector<HTMLInputElement>("#account-name")!;
  expect(name !== null).toBe(true);
  name.value = "Shell Name";
  name.dispatchEvent(new Event("input", { bubbles: true }));
  name
    .closest("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  expect(h.names).toEqual(["Shell Name"]);
  expect(get(h.services.account.state).phase).toBe("confirming");
  h.canonical(me({ name: "Shell Name" }));
  await h.services.personal.refresh();
  await flush();
  expect(get(h.services.account.state).phase).toBe("idle");
  h.services.actions.openAccount();
  await flush();
  expect(document.querySelector("[data-notifications]") !== null).toBe(true);
  expect(document.querySelector("[data-setup-instructions]") !== null).toBe(
    true,
  );
});
test("you in the user center open the settings page: every section on it, leaving closes it, sign out runs the application flow", async () => {
  const h = shellFixture(),
    target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(ApplicationShellHarness, {
      target,
      props: { services: h.services, effects: h.effects },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  await waitForView(target, "a[data-account-row]");
  // A plain click on a data-nav link: the shell follows it in place.
  const row = target.querySelector<HTMLAnchorElement>("a[data-account-row]")!;
  h.navigate(new MouseEvent("click", { button: 0, cancelable: true }), row);
  await waitForView(document, "#account-name");
  expect(new URL(h.href()).pathname).toBe("/settings");
  expect(get(h.services.state).route.kind).toBe("settings");
  expect(get(h.services.account.state).open).toBe(true);
  // One page, one anchor per section (the sidebar's rows).
  for (const id of ["profile", "agents", "cloud", "device"])
    expect(document.getElementById(id) !== null).toBe(true);
  expect(document.querySelector("[data-notifications]") !== null).toBe(true);
  // This device: no push here, so the Notifications switch is off and disabled; Sound is on and saves locally.
  const notify = document.querySelector<HTMLButtonElement>(
    "#settings-notifications",
  )!;
  expect(notify.getAttribute("aria-checked")).toBe("false");
  expect(notify.disabled).toBe(true);
  const sound = document.querySelector<HTMLButtonElement>("#settings-sound")!;
  expect(sound.getAttribute("aria-checked")).toBe("true");
  sound.click();
  await flush();
  expect(sound.getAttribute("aria-checked")).toBe("false");
  expect(localStorage.getItem("vb.sound")).toBe("");
  expect(document.querySelector("[data-user-menu]")).toBeNull();
  // Going home leaves the page: the account session closes with it.
  h.services.actions.home();
  const left = Date.now() + 2_000;
  while (get(h.services.account.state).open && Date.now() < left) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flush();
  }
  expect(get(h.services.account.state).open).toBe(false);
  h.services.actions.openAccount();
  await waitForView(document, "#account-name");
  const signOut = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) =>
    /^(Sair|Sign out)$/.test(button.textContent?.trim() ?? ""),
  )!;
  signOut.click();
  const deadline = Date.now() + 2_000;
  while (!h.documents.includes("/") && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flush();
  }
  expect(h.documents).toEqual(["/login?out=1"]);
});
test("a phone's Settings bar is only a back: it returns to the page you came from, or Home when Settings loaded first (Gimenes #4068)", async () => {
  async function open(href?: string) {
    const h = shellFixture({}, { href }),
      target = document.createElement("div");
    document.body.append(target);
    const component = flushSync(() =>
      mount(ApplicationShellHarness, {
        target,
        props: { services: h.services, effects: h.effects },
      }),
    );
    cleanups.push(() =>
      flushSync(() => {
        void unmount(component);
      }),
    );
    await flush();
    return { h, target };
  }
  // From Home: the account row opens Settings; back is the browser's back.
  const from = await open();
  await waitForView(from.target, "a[data-account-row]");
  from.h.navigate(
    new MouseEvent("click", { button: 0, cancelable: true }),
    from.target.querySelector<HTMLAnchorElement>("a[data-account-row]")!,
  );
  await waitForView(document, "#account-name");
  const nav = from.target.querySelector("[data-app-navigation]")!;
  expect(nav.querySelector("[data-room-switcher]")).toBeNull();
  const back = nav.querySelector<HTMLButtonElement>("[data-phone-back]")!;
  expect(back.className.split(/\s+/)).toContain("md:hidden");
  back.click();
  expect(from.h.backs).toEqual(["https://vibebook.test/settings"]);
  // Settings loaded first: nothing of this app to go back to, so back goes Home.
  const direct = await open("https://vibebook.test/settings");
  await waitForView(document, "#account-name");
  direct.target
    .querySelector<HTMLButtonElement>(
      "[data-app-navigation] [data-phone-back]",
    )!
    .click();
  await flush();
  expect(direct.h.backs).toEqual([]);
  expect(new URL(direct.h.href()).pathname).toBe("/");
});
test("connected old creator controls cannot edit or submit a replacement opening before DOM flush", async () => {
  let creates = 0;
  const h = shellFixture({
      startRoom: async () => {
        creates++;
        return { id: "bbbbbb", unknown: [], invited: [], cost: 0 };
      },
    }),
    target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(ApplicationShellHarness, {
      target,
      props: { services: h.services, effects: h.effects },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  const creator = h.services.navigation.creator;
  creator.open();
  creator.edit("Preserved new draft");
  await flush();
  await waitForView(document, "#new-room");
  const oldInput = document.querySelector<HTMLTextAreaElement>("#new-room")!,
    oldForm = oldInput.closest("form")!;
  creator.close();
  creator.open();
  expect(oldForm.isConnected).toBe(true);
  oldInput.value = "Stale outgoing draft";
  oldInput.dispatchEvent(new Event("input", { bubbles: true }));
  oldForm.dispatchEvent(
    new Event("submit", { bubbles: true, cancelable: true }),
  );
  expect(get(h.services.personal.draft).create).toBe("Preserved new draft");
  expect(creates).toBe(0);
  await flush();
  const fresh = document.querySelector<HTMLTextAreaElement>("#new-room")!;
  expect(fresh.value).toBe("Preserved new draft");
  fresh
    .closest("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  expect(creates).toBe(1);
  expect(h.href()).toContain("/b/bbbbbb");
});
test("Inbox shows all three canonical sections, keeps retry explicit and rejects stale connected navigation", async () => {
  let current = true,
    retries = 0;
  const mentions = [
    {
      book_id: "aaaaaa",
      room: "Room",
      msg_id: 7,
      thread: "main",
      author: "friend@test",
      author_name: "Friend",
      text: "Held mention",
      ts: 1,
    },
  ];
  const tasks = [
    {
      book_id: "aaaaaa",
      room: "Room",
      epic_id: "e",
      epic: "Epic",
      task_id: "t1",
      title: "Open task",
      status: "doing",
      due: null,
    },
  ];
  const opened: unknown[] = [];
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Inbox, {
      target,
      props: {
        waits: [
          {
            book_id: "aaaaaa",
            room: "Room",
            ref: "m1",
            thread: "main",
            topic: null,
            author: "friend@test",
            author_name: "Friend",
            text: "Waiting question",
            ts: 1,
          },
        ],
        mentions,
        tasks,
        roomId: null,
        vb: { t: (text: string) => text, ago: () => "now" },
        readError: true,
        current: () => current,
        onretry: () => {
          retries++;
        },
        onmention: (value: InboxMention) => opened.push(value),
        ontask: (value: InboxTask) => opened.push(value),
        onopen: () => {},
        onresolve: () => {},
        onclose: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Esperando você",
  );
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Te mencionaram",
  );
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    "Suas tarefas",
  );
  const retry = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((button) => button.textContent?.trim() === "Tentar de novo");
  expect(retry).toBeDefined();
  retry!.click();
  expect(retries).toBe(1);
  const links = [
    ...document.querySelectorAll<HTMLAnchorElement>('[role="dialog"] a'),
  ];
  const mention = links.find((link) =>
      link.textContent?.includes("Held mention"),
    )!,
    task = links.find((link) => link.textContent?.includes("Open task"))!;
  expect(mention.href).toContain("#m7");
  expect(task.href).toContain("t=e");
  current = false;
  mention.click();
  task.click();
  retry!.click();
  expect(opened).toEqual([]);
  expect(retries).toBe(1);
  current = true;
  mention.click();
  task.click();
  expect(opened).toEqual([mentions[0], tasks[0]]);
});
test("Home waits and the Inbox share one avatar language: people circles, agents and @vibe squares", async () => {
  const wait = (ref: string, author: string, author_name: string) => ({
    book_id: "aaaaaa",
    room: "Room",
    ref,
    thread: "main",
    topic: null,
    author,
    author_name,
    text: `wait ${ref}`,
    ts: 1,
  });
  const waits = [
    wait("m1", "friend@test", "Friend"),
    wait("m2", "ai", "@vibe"),
    wait("a3", "me@test", "Me"),
  ];
  const expected = [
    ["person", ""],
    ["vibe", ""],
    ["agent", "✻"],
  ];
  // Agent marks say so (data-avatar), @vibe is its cube; any other Studio avatar is a person only when round.
  const shapes = (root: ParentNode) =>
    [...root.querySelectorAll("[data-avatar], [data-slot=avatar]")].map((el) =>
      el.getAttribute("data-avatar") === "agent"
        ? ["agent", el.textContent?.trim()]
        : el.getAttribute("data-avatar") === "vibe"
          ? ["vibe", ""]
          : [el.classList.contains("rounded-full") ? "person" : "", ""],
    );
  const home = document.createElement("div");
  document.body.append(home);
  const list = flushSync(() =>
    mount(WaitList, {
      target: home,
      props: {
        waits,
        people: me(),
        rooms: { state: writable({ pending: {}, issues: {} }) },
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(list);
      home.remove();
    }),
  );
  const box = document.createElement("div");
  document.body.append(box);
  const inbox = flushSync(() =>
    mount(Inbox, {
      target: box,
      props: {
        waits,
        mentions: [
          {
            book_id: "aaaaaa",
            room: "Room",
            msg_id: 7,
            thread: "main",
            author: "ai",
            author_name: "@vibe",
            text: "vibe mention",
            ts: 1,
          },
        ],
        tasks: [],
        roomId: null,
        vb: { t: (text: string) => text, ago: () => "now" },
        readError: false,
        current: () => true,
        onretry: () => {},
        onmention: () => {},
        ontask: () => {},
        onopen: () => {},
        onresolve: () => {},
        onclose: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(inbox);
      box.remove();
    }),
  );
  await flush();
  expect(shapes(home)).toEqual(expected);
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(shapes(dialog)).toEqual([...expected, ["vibe", ""]]);
});
test("global Inbox (/?inbox) rejects old connected account controls and closes on identity replacement", async () => {
  let resolves = 0;
  const wait = {
    book_id: "aaaaaa",
    room: "Room",
    ref: "m1",
    thread: "main",
    topic: null,
    author: "friend@test",
    author_name: "Friend",
    text: "Question",
    ts: 1,
  };
  const h = shellFixture({
    resolve: async () => {
      resolves++;
      return { ok: true };
    },
  });
  h.canonical(me({ waits: [wait] }));
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(ApplicationShellHarness, {
      target,
      props: { services: h.services, effects: h.effects },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  h.services.actions.navigate("https://vibebook.test/?inbox");
  await flush();
  await waitForView(
    target,
    "[data-home-inbox] [data-room-inbox-message] button",
  );
  const article = [
    ...target.querySelectorAll<HTMLElement>("[data-room-inbox-message]"),
  ].find((node) => node.textContent?.includes("Question"))!;
  expect(article !== undefined).toBe(true);
  const go = article.querySelector<HTMLButtonElement>("button")!,
    resolve = article.querySelector<HTMLButtonElement>("[data-inbox-resolve]")!;
  expect(!!go && !!resolve).toBe(true);
  expect(h.services.personal.peek()?.email).toBe("me@test.com");
  h.canonical(me({ email: "other@test", waits: [wait] }));
  await h.services.personal.refresh();
  const before = h.href();
  go.click();
  resolve.click();
  await new Promise((done) => setTimeout(done, 260));
  await settle();
  expect(h.href()).toBe(before);
  expect(resolves).toBe(0);
  await flush();
  // The page reopens the Inbox for the new account: the old row is gone.
  expect(go.isConnected).toBe(false);
});
async function actualRoomShell(overrides: Partial<HomeApi> = {}) {
  const h = shellFixture(overrides),
    resources = createRoomResources();
  h.services.start();
  await settle();
  h.services.actions.navigate({ roomId: "aaaaaa" });
  const browser: RoomScopeBrowser = {
    origin: "https://vibebook.test",
    href: h.href,
    historyState: () => window.history.state,
    history: window.history,
    storage: localStorage,
    fetcher: async () =>
      new Response(JSON.stringify({ connections: [] }), {
        headers: { "content-type": "application/json" },
      }),
    iosStandalone: false,
    visible: () => true,
    listenVisibility: () => () => {},
    openExternal: () => {},
    awarenessColor: () => "#112233",
    enqueue: queueMicrotask,
  };
  const layoutBrowser: RoomLayoutBrowser = {
    href: h.href,
    state: () => window.history.state,
    history: window.history,
    storage: localStorage,
    schedule: h.timer.clock.schedule,
    cancel: h.timer.clock.cancel,
    enqueue: queueMicrotask,
  };
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(RoomShellHarness, {
      target,
      props: {
        presentation: { services: h.services },
        resources,
        browser,
        layoutBrowser,
      },
    }),
  );
  cleanups.push(() => {
    flushSync(() => {
      void unmount(component);
    });
    h.services.dispose();
    resources.dispose();
  });
  const canonical: Room = {
    id: "aaaaaa",
    me: "me@test.com",
    book: { title: "Real composition", owner: "me@test.com" },
    members: ["me@test.com"],
    online: [],
    typing: {},
    suggestions: [],
    doc: "# Canonical document",
    messages: [
      {
        id: 1,
        thread: "main",
        author: "me@test.com",
        text: "Canonical visible message",
        ts: 1,
      },
    ],
    epics: [
      {
        id: "e",
        title: "Canonical epic",
        tasks: [
          {
            id: "t1",
            title: "Canonical task",
            done: false,
            status: "todo",
            owner: "me@test.com",
          },
        ],
      },
    ],
  };
  const publish = (value: Room) => {
    const { id: _id, typing: _typing, ...state } = value;
    const event: RoomEvent = { t: "state", ...state };
    h.connectionCallbacks.at(-1)!.onEvent(event);
  };
  return {
    ...h,
    resources,
    target,
    canonicalPersonal: h.canonical,
    canonical,
    publish,
  };
}
test("real RoomShell uses genuine loading/terminal states and directly renders current canonical features", async () => {
  const h = await actualRoomShell();
  await flush();
  expect(h.target.querySelector('[data-room-status="loading"]') !== null).toBe(
    true,
  );
  expect(h.target.querySelector("[data-composer]")).toBe(null);
  h.publish(h.canonical);
  await flush();
  expect(h.target.querySelector("[data-room-sidebar-panel]") !== null).toBe(
    true,
  );
  expect(h.target.querySelector("[data-room-bar]") !== null).toBe(true);
  // Notifications moved to the avatar menu: no bell in the room header.
  expect(h.target.querySelector("[data-room-bar] [data-notifications]")).toBe(
    null,
  );
  expect(h.target.querySelector("[data-composer]") !== null).toBe(true);
  expect(h.target.querySelector("[data-document]") !== null).toBe(true);
  expect(h.target.textContent).toContain("Canonical visible message");
  h.connectionCallbacks.at(-1)!.onRemoved?.();
  await flush();
  expect(h.target.querySelector('[data-room-status="removed"]') !== null).toBe(
    true,
  );
  expect(h.target.querySelector("[data-composer]")).toBe(null);
  expect(h.target.textContent).not.toContain("Canonical visible message");
});
test("real RoomShell revokes connected outgoing Composer controls before a removed frame reaches the DOM", async () => {
  const h = await actualRoomShell();
  h.publish(h.canonical);
  await flush();
  const input = h.target.querySelector<HTMLTextAreaElement>(
      "[data-composer] textarea",
    )!,
    form = input.closest("form")!;
  input.value = "An outgoing private draft";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  h.connectionCallbacks.at(-1)!.onRemoved?.();
  expect(form.isConnected).toBe(true);
  const before = h.roomCommands.filter((command) => command.t === "msg").length;
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  expect(h.roomCommands.filter((command) => command.t === "msg").length).toBe(
    before,
  );
  await flush();
  expect(h.target.querySelector("[data-composer]")).toBe(null);
});
test("actual RoomStatus preserves removal/invitation guidance and safely returns Home after terminal access loss", async () => {
  for (const terminal of ["removed", "unavailable"] as const) {
    const h = await actualRoomShell();
    h.publish(h.canonical);
    await flush();
    if (terminal === "removed") h.connectionCallbacks.at(-1)!.onRemoved?.();
    else h.connectionCallbacks.at(-1)!.onUnavailable?.();
    await flush();
    const status = h.target.querySelector<HTMLElement>(
      `[data-room-status="${terminal}"]`,
    );
    expect(status !== null).toBe(true);
    expect(status?.textContent).toContain(
      h.services.t(
        terminal === "removed"
          ? "Você foi removido desta sala."
          : "Sem acesso a esta sala. Peça para alguém de dentro te convidar.",
      ),
    );
    expect(h.target.textContent).not.toContain("Canonical visible message");
    expect(h.target.querySelector("[data-document]")).toBe(null);
    const home = [
      ...status!.querySelectorAll<HTMLButtonElement>("button"),
    ].find(
      (button) => button.textContent?.trim() === h.services.t("suas salas"),
    );
    expect(home !== undefined).toBe(true);
    expect(home?.disabled).toBe(false);
    home!.click();
    expect(get(h.services.state).route.kind).toBe("home");
    expect(h.services.rootRoom.read().room).toBe(null);
  }
});
async function setup(overrides: Parameters<typeof homeApi>[0] = {}) {
  const timer = manualClock(),
    personal = createPersonalSession(homeApi(overrides), {
      clock: timer.clock,
    });
  await personal.refresh();
  const rooms = createRoomsSession(personal, timer.clock),
    pwa = createPwaService(),
    profile = createAccountSession(personal, profileApi, timer.clock),
    creator = createNewRoomSession(personal, () => {}, timer.clock);
  cleanups.push(() => {
    pwa.dispose();
    rooms.dispose();
    profile.dispose();
    creator.dispose();
    personal.dispose();
  });
  return { timer, personal, rooms, pwa, profile, creator };
}
const profileApi: AccountApi = {
  logins: async () => ({
    logins: [],
  }),
  name: async (name) => ({ ok: true, name }),
  avatar: async () => ({ ok: true, avatar: 1 }),
  connect: async () => ({ ok: true as const }),
  dismiss: async () => ({ ok: true as const }),
  answerInvite: async () => ({ ok: true as const }),
  orgRooms: async () => ({ domain: null, rooms: [] }),
  meApp: async () => ({ app: true }),
  joinOrg: async () => ({ ok: true as const, member: true as const }),
};
test("Home renders untrusted room metadata as text and passes exact room identity", async () => {
  const { personal, rooms, pwa, profile, creator } = await setup({
    me: async () =>
      me({
        books: [
          room("aaaaaa", {
            title: "<img src=x onerror=alert(1)>",
            summary: "<script>evil()</script>",
          }),
        ],
        // The desk home lists rooms only through what waits in them.
        waits: [
          {
            book_id: "aaaaaa",
            room: "<img src=x onerror=alert(1)>",
            ref: "t1",
            thread: "main",
            topic: null,
            author: "other@test.com",
            author_name: "<script>evil()</script>",
            text: "<b>review</b>",
            ts: 1,
          },
        ],
      }),
  });
  const navigation: unknown[] = [],
    target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Home, {
      target,
      props: {
        pwa,
        personal,
        rooms,
        profile,
        creator,
        lang: "en",
        ago: () => "now",
        onnavigate: (value: RoomTarget) => navigation.push(value),
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroommenu: () => {},
        onsearch: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  expect(target.querySelector("script")).toBe(null);
  expect(target.querySelector("[onerror]")).toBe(null);
  expect(target.textContent).toContain("<img src=x onerror=alert(1)>");
  const anchor = target.querySelector<HTMLAnchorElement>(
    'a[data-home-card][href="/b/aaaaaa"]',
  )!;
  expect(anchor).not.toBe(null);
  anchor.click();
  expect(navigation).toEqual([
    { roomId: "aaaaaa", thread: "main", messageId: undefined },
  ]);
  const heading = target.querySelector("h1")!;
  expect(heading.classList.contains("font-sans")).toBe(true);
  expect(heading.classList.contains("[font-variation-settings:normal]")).toBe(
    true,
  );
});
test("Home ask box is the room's chat box: emoji, + menu and dictation that keeps listening", async () => {
  const rec: import("../web/features/composer/speech").SpeechRecognizer = {
    lang: "",
    continuous: false,
    interimResults: false,
    onresult: null,
    onerror: null,
    onend: null,
    start() {},
    stop() {},
    abort() {},
  };
  const previous = Reflect.get(window, "SpeechRecognition");
  Reflect.set(window, "SpeechRecognition", function SpeechRecognition() {
    return rec;
  });
  cleanups.push(() => Reflect.set(window, "SpeechRecognition", previous));
  const { personal, rooms, pwa, profile, creator } = await setup();
  const opened: unknown[] = [],
    target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Home, {
      target,
      props: {
        pwa,
        personal,
        rooms,
        profile,
        creator,
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: (trigger?: HTMLElement) => opened.push(trigger),
        onsettings: () => {},
        onroommenu: () => {},
        onsearch: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  const box = target.querySelector<HTMLFormElement>("[data-chat-box]")!;
  expect(
    [...box.querySelectorAll("button")].map((button) =>
      button.getAttribute("aria-label"),
    ),
  ).toEqual(["More options", "Emoji", "Dictate message", "Send"]);
  const input = box.querySelector("textarea")!,
    mic = box.querySelector<HTMLButtonElement>(
      'button[aria-label="Dictate message"]',
    )!;
  input.focus();
  mic.click();
  await flush();
  expect(mic.getAttribute("aria-pressed")).toBe("true");
  rec.onresult?.({ results: [[{ transcript: "plan the" }]] });
  await flush();
  rec.onresult?.({ results: [[{ transcript: "plan the trip" }]] });
  await flush();
  expect(input.value).toBe("plan the trip");
  expect(mic.getAttribute("aria-pressed")).toBe("true");
  const more = box.querySelector<HTMLButtonElement>("[data-composer-more]")!;
  more.click();
  await flush();
  box.querySelector<HTMLButtonElement>('[role="menuitem"]')!.click();
  await flush();
  expect(opened).toEqual([more]);
});
test("the ask's + menu is New room and Attach file (no mention or poll outside a room), and a picked file shows as the composer's card", async () => {
  const { personal, rooms, pwa, profile, creator } = await setup();
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Home, {
      target,
      props: {
        pwa,
        personal,
        rooms,
        profile,
        creator,
        onlanguage: () => {},
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroommenu: () => {},
        onsearch: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  const box = target.querySelector<HTMLFormElement>("[data-chat-box]")!;
  box.querySelector<HTMLButtonElement>("[data-composer-more]")!.click();
  await flush();
  expect(
    [...box.querySelectorAll('[role="menuitem"]')].map((item) =>
      item.textContent?.replace(/\s+/g, " ").trim(),
    ),
  ).toEqual(["New room", "Attach file or Cmd+V"]);
  const input = target.querySelector<HTMLInputElement>('input[type="file"]')!;
  Object.defineProperty(input, "files", {
    configurable: true,
    value: [new File(["%PDF"], "plan.pdf", { type: "application/pdf" })],
  });
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await flush();
  const card = target.querySelector("[data-composer-attachment]");
  expect(card?.textContent).toContain("plan.pdf");
});
test("detached tile link/settings actions cannot navigate after canonical row replacement", async () => {
  const navigation: unknown[] = [],
    settings: unknown[] = [],
    target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(RoomTile, {
      target,
      props: {
        room: room(),
        lang: "en",
        now: 0,
        onnavigate: (value: RoomTarget) => navigation.push(value),
        onmenu: (id: string, trigger: HTMLElement) =>
          settings.push([id, trigger]),
      },
    }),
  );
  const anchor = target.querySelector("a")!,
    tile = target.querySelector("article")!;
  flushSync(() => {
    void unmount(component);
  });
  expect(anchor.isConnected).toBe(false);
  anchor.dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
  );
  tile.dispatchEvent(
    new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
  );
  expect(navigation).toEqual([]);
  expect(settings).toEqual([]);
});
test("room refresh keeps Home draft/focus, then unmount owns late routing result", async () => {
  const late = deferred<typeof suggestion>();
  let latest = me();
  const { personal, rooms, pwa, profile, creator } = await setup({
    me: async () => latest,
    route: () => late.promise,
  });
  const target = document.createElement("div");
  document.body.append(target);
  const navigation: unknown[] = [],
    component = flushSync(() =>
      mount(Home, {
        target,
        props: {
          pwa,
          personal,
          rooms,
          profile,
          creator,
          lang: "en",
          ago: () => "now",
          onnavigate: (value: RoomTarget) => navigation.push(value),
          onhome: () => {},
          onarchived: () => {},
          onnew: () => {},
          onsettings: () => {},
          onroommenu: () => {},
          onsearch: () => {},
        },
      }),
    );
  await flush();
  const textarea = target.querySelector<HTMLTextAreaElement>("#home-ask")!;
  textarea.focus();
  textarea.value = "keep my draft";
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  latest = me({ books: [room("aaaaaa", { title: "Updated remotely" })] });
  await personal.refresh();
  await flush();
  expect(target.querySelector("#home-ask")).toBe(textarea);
  expect(document.activeElement).toBe(textarea);
  expect(textarea.value).toBe("keep my draft");
  target
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  flushSync(() => {
    void unmount(component);
  });
  late.resolve(suggestion);
  await flush();
  expect(get(personal.draft).ask).toBe("keep my draft");
  expect(navigation).toEqual([]);
  expect(target.textContent).toBe("");
});
test("canonical ask clearance takes the ask card away without hiding the task", async () => {
  const wait = (ref: string): ReturnType<typeof me>["waits"][number] => ({
    book_id: "aaaaaa",
    room: "Room aaaaaa",
    ref,
    thread: "e",
    topic: "Epic",
    author: "other@test.com",
    author_name: "Other",
    text: "Task remains actionable",
    ts: 1,
  });
  let latest = me({ waits: [wait("m1"), wait("t2")] });
  const { personal, rooms, pwa, profile, creator } = await setup({
    me: async () => latest,
  });
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Home, {
      target,
      props: {
        pwa,
        personal,
        rooms,
        profile,
        creator,
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroommenu: () => {},
        onsearch: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  const cards = () =>
    [...target.querySelectorAll<HTMLElement>("[data-home-card]")].map(
      (card) => card.dataset.homeCard,
    );
  // An ask comes before a task in review.
  expect(cards()).toEqual(["m1", "t2"]);
  expect(target.querySelector("h1")?.textContent).toContain("2 things");
  // The server's fresh /api/me result, not an optimistic local msg hook, clears m1.
  latest = me({ waits: [wait("t2")] });
  await personal.refresh();
  await flush();
  expect(cards()).toEqual(["t2"]);
  expect(target.querySelector("h1")?.textContent).toContain("One thing");
  expect(target.textContent).toContain("Task remains actionable");
});
async function mountOnboardingHome(name = "") {
  let canonical = me({ name, books: [] });
  const fixture = await setup({ me: async () => canonical });
  const { personal, rooms, pwa, profile, creator } = fixture;
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Home, {
      target,
      props: {
        personal,
        rooms,
        pwa,
        profile,
        creator,
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroommenu: () => {},
        onsearch: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  // The dialog is portaled to the body; the Home renders behind it.
  const dialog = () =>
    document.querySelector<HTMLElement>('[role="dialog"][data-onboarding]');
  const click = (label: string) => {
    const button = [...(dialog()?.querySelectorAll("button") ?? [])].find(
      (value) => value.textContent?.trim() === label,
    );
    expect(!!button).toBe(true);
    button!.click();
  };
  const step = () => dialog()?.getAttribute("data-onboarding-step");
  // Closed, or on its way out (the exit animation keeps it a moment).
  const closed = () => dialog()?.getAttribute("data-state") !== "open";
  return {
    closed,
    ...fixture,
    target,
    dialog,
    click,
    step,
    canonical(value: ReturnType<typeof me>) {
      canonical = value;
    },
  };
}
test("onboarding is a dialog over the actual Home: three steps, drafts kept across Back, skip finishes", async () => {
  localStorage.clear();
  const h = await mountOnboardingHome();
  expect(h.step()).toBe("1");
  expect(h.target.querySelector("[data-onboarding]")).toBe(null);
  expect(h.target.querySelector('[data-view="home"]') === null).toBe(false);
  expect(h.dialog()!.textContent).toContain("Step 1 of 3");
  const name = h
    .dialog()!
    .querySelector<HTMLInputElement>('input[autocomplete="given-name"]')!;
  name.value = "Ada";
  name.dispatchEvent(new Event("input", { bubbles: true }));
  h.click("Continue");
  await flush();
  expect(h.step()).toBe("1"); // An HTTP success is not the canonical profile.
  h.canonical(me({ name: "Ada", books: [] }));
  await h.personal.refresh();
  await flush();
  expect(h.step()).toBe("2");
  h.click("Skip");
  await flush();
  expect(h.step()).toBe("3");
  const draft = h.dialog()!.querySelector("textarea")!;
  draft.value = "A careful first room";
  draft.dispatchEvent(new Event("input", { bubbles: true }));
  const composing = new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    isComposing: true,
  });
  draft.dispatchEvent(composing);
  await flush();
  expect(get(h.creator.state).busy).toBe(false);
  h.click("Back");
  await flush();
  expect(h.step()).toBe("2");
  h.click("Skip");
  await flush();
  expect(h.dialog()!.querySelector("textarea")!.value).toBe(
    "A careful first room",
  );
  h.click("Skip"); // Skipping the last step finishes.
  await flush();
  expect(h.closed()).toBe(true);
  expect(h.target.querySelector("#home-ask") === null).toBe(false);
  expect(localStorage.getItem("vb.obDone")).toBe("1");
});
test("skipping the name keeps the email's name and moves on; the close button skips all for good", async () => {
  localStorage.clear();
  const h = await mountOnboardingHome();
  expect(h.step()).toBe("1");
  h.click("Skip");
  await flush();
  expect(h.step()).toBe("2");
  expect(localStorage.getItem("vb.obName")).toBe("1");
  expect(get(h.personal.state).me?.name).toBe("");
  const close = [...h.dialog()!.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Close and see the home",
  );
  expect(!!close).toBe(true);
  close!.click();
  await flush();
  expect(h.closed()).toBe(true);
  expect(localStorage.getItem("vb.obDone")).toBe("1");
});

async function pendingNavigation(
  overrides: Parameters<typeof shellFixture>[0] = {},
) {
  const h = shellFixture(overrides),
    target = document.createElement("div"),
    trigger = document.createElement("button");
  trigger.textContent = "owned trigger";
  document.body.append(target, trigger);
  h.services.start();
  await h.services.personal.refresh();
  const code = deferred<typeof NavigationDialogs>();
  const component = flushSync(() =>
    mount(AppNavigation, {
      target,
      props: {
        controller: h.services.navigation,
        lang: "en",
        loadDialogs: () => code.promise,
      },
    }),
  );
  cleanups.push(() => {
    flushSync(() => {
      void unmount(component);
    });
    h.services.dispose();
  });
  trigger.focus();
  return { h, trigger, code, controller: h.services.navigation };
}
function loadingCancel() {
  const status = document.querySelector("[data-deferred-view]");
  expect(status).not.toBeNull();
  const button = [
    ...status!
      .closest('[role="dialog"]')!
      .querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.trim() === "Cancel");
  expect(button).toBeDefined();
  return button!;
}
test("cancel loading navigation remains closed when actual dialog code arrives and does not steal focus", async () => {
  const { controller, trigger, code } = await pendingNavigation();
  controller.openSearch(trigger);
  await flush();
  loadingCancel().click();
  await flush();
  expect(get(controller.search.state).open).toBe(false);
  code.resolve(NavigationDialogs);
  await flush();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});
test("old connected loading cancel cannot close a replacement creator and actual fields gain focus", async () => {
  const { controller, trigger, code } = await pendingNavigation();
  controller.openSearch(trigger);
  await flush();
  const old = loadingCancel();
  controller.search.close();
  controller.openCreate(trigger);
  expect(old.isConnected).toBe(true);
  old.click();
  expect(get(controller.creator.state).open).toBe(true);
  code.resolve(NavigationDialogs);
  await flush();
  await waitForView(document, "#new-room");
  expect(document.querySelector("[role=combobox]")).toBeNull();
  expect(document.activeElement).toBe(document.querySelector("#new-room"));
});
test("account switch while navigation code loads drops private intent and cannot focus or reopen it", async () => {
  const { h, controller, trigger, code } = await pendingNavigation();
  controller.openSearch(trigger);
  await flush();
  const old = loadingCancel();
  h.canonical(me({ email: "replacement@example.test" }));
  h.services.personal.acceptIdentity("replacement@example.test");
  expect(old.isConnected).toBe(true);
  old.click();
  expect(get(controller.search.state).open).toBe(false);
  await h.services.personal.refresh();
  controller.openSearch();
  expect(get(controller.search.state).open).toBe(true);
  code.resolve(NavigationDialogs);
  await flush();
  await waitForView(document, '[role="combobox"]');
  expect(get(h.services.personal.state).me?.email).toBe(
    "replacement@example.test",
  );
  expect(
    document.querySelector<HTMLInputElement>('[role="combobox"]')?.value,
  ).toBe("");
  expect(document.activeElement).toBe(
    document.querySelector('[role="combobox"]'),
  );
});

test("a right-click on a rail room opens its menu at the pointer; a tint and Archive go through it", async () => {
  const tints: unknown[] = [];
  const { h, controller, code } = await pendingNavigation({
    tint: async (id, tint) => {
      tints.push([id, tint]);
      return { ok: true };
    },
  });
  h.canonical(me({ books: [room("aaaaaa"), room("bbbbbb")] }));
  await h.services.personal.refresh();
  await flush();
  const tile = document.querySelector<HTMLElement>('[data-room-id="aaaaaa"]')!;
  tile.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 30,
      clientY: 60,
    }),
  );
  expect(get(controller.state).menu).toEqual({ id: "aaaaaa", x: 30, y: 60 });
  await flush();
  await waitForView(document, '[data-room-menu="aaaaaa"]');
  const menu = document.querySelector('[data-room-menu="aaaaaa"]')!;
  const items = [...menu.querySelectorAll('[role="menuitem"]')].map((item) =>
    item.textContent?.trim(),
  );
  expect(items).toEqual([
    "Mark as read",
    "Color",
    "Icon",
    "Move",
    "Copy room link",
    "Archive",
  ]);
  // Nothing unread: "Mark as read" is off.
  expect(
    menu.querySelector('[role="menuitem"]')!.hasAttribute("data-disabled"),
  ).toBe(true);
  // The old settings dialog is gone: the menu is not a dialog.
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await controller.rooms.tint("aaaaaa", "blue");
  expect(tints).toEqual([["aaaaaa", "blue"]]);
  const archive = [
    ...menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ].find((item) => item.textContent?.trim() === "Archive")!;
  archive.click();
  await flush();
  expect(get(controller.state).menu).toBeNull();
  expect(get(controller.state).archiveId).toBe("aaaaaa");
  code.resolve(NavigationDialogs);
  await flush();
  await waitForView(document, '[role="dialog"]');
});

test("Shift+F10 on a rail room opens the menu under it; a newer opening replaces the old one", async () => {
  const { h, controller } = await pendingNavigation();
  h.canonical(me({ books: [room("aaaaaa"), room("bbbbbb")] }));
  await h.services.personal.refresh();
  await flush();
  const link = document.querySelector<HTMLElement>(
    '[data-room-id="aaaaaa"] a',
  )!;
  link.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "F10",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(get(controller.state).menu?.id).toBe("aaaaaa");
  expect(controller.returnFocus(null)).toBe(link);
  await flush();
  await waitForView(document, '[data-room-menu="aaaaaa"]');
  const old = document.querySelector('[data-room-menu="aaaaaa"]')!;
  controller.openMenu("bbbbbb", undefined, { x: 0, y: 0 });
  await flush();
  await waitForView(document, '[data-room-menu="bbbbbb"]');
  expect(old.isConnected).toBe(false);
  controller.closeMenu();
  await flush();
  expect(document.querySelector("[data-room-menu]")).toBeNull();
});

test("Leave room sits under Archive for a member, not for the owner or in a DM, and its confirm takes you out", async () => {
  const left: string[] = [];
  const dm = "dm00000000000000000bb1";
  const { h, controller, code } = await pendingNavigation({
    leave: async (id) => {
      left.push(id);
      return { ok: true };
    },
  });
  h.canonical(
    me({
      books: [
        room("aaaaaa", { owner: "other@test.com" }),
        room("bbbbbb", { owner: "me@test.com" }),
        room(dm, { dm: 1, owner: "other@test.com" }),
      ],
    }),
  );
  await h.services.personal.refresh();
  await flush();
  const items = async (id: string) => {
    controller.openMenu(id, undefined, { x: 0, y: 0 });
    await flush();
    await waitForView(document, `[data-room-menu="${id}"]`);
    return [
      ...document
        .querySelector(`[data-room-menu="${id}"]`)!
        .querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ];
  };
  const names = (list: HTMLElement[]) =>
    list.map((item) => item.textContent?.trim());
  // The owner can't leave: no item.
  expect(names(await items("bbbbbb"))).not.toContain("Leave room");
  // A DM is for its two people: no item.
  expect(names(await items(dm))).not.toContain("Leave room");
  // A member: right under Archive, destructive like it.
  const member = await items("aaaaaa");
  expect(names(member).slice(-2)).toEqual(["Archive", "Leave room"]);
  const leave = member.at(-1)!;
  expect(leave.getAttribute("data-variant")).toBe("destructive");
  leave.click();
  await flush();
  expect(get(controller.state).menu).toBeNull();
  expect(get(controller.state).leaveId).toBe("aaaaaa");
  code.resolve(NavigationDialogs);
  await flush();
  await waitForView(document, "[data-room-leave]");
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain("Leave this room?");
  expect(dialog.textContent).toContain(
    "You stop seeing the room and getting its notifications.",
  );
  const confirm = [
    ...dialog.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.trim() === "Leave")!;
  confirm.click();
  await flush();
  expect(left).toEqual(["aaaaaa"]);
});

// The home Inbox (/?inbox, HomeInbox) with typed synthetic HTTP ports; no Worker claim.
async function homeInbox(overrides: Partial<HomeApi> = {}) {
  const h = shellFixture(overrides);
  h.services.start();
  await settle();
  const inbox = createApplicationInbox(h.services, h.timer.clock);
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(HomeInbox, { target, props: { owner: inbox, services: h.services } }),
  );
  cleanups.push(() => {
    flushSync(() => {
      void unmount(component);
    });
    inbox.dispose();
    h.services.dispose();
  });
  return { ...h, inbox, target, canonicalPersonal: h.canonical };
}
test("home Inbox rejects connected old-opening task controls before DOM flush", async () => {
  const task: InboxTask = {
    book_id: "aaaaaa",
    room: "Room",
    epic_id: "e",
    epic: "Canonical epic",
    task_id: "t1",
    title: "Owned Inbox task",
    status: "todo",
    due: null,
  };
  const h = await homeInbox({
    inbox: async () => ({ waits: [], mentions: [], tasks: [task] }),
  });
  h.inbox.open();
  await flush();
  await waitForView(h.target, "[data-room-inbox] button");
  // Your tasks are in the desktop Home's "Tarefas" tab; a task row's open button opens it.
  const find = () => {
    h.target
      .querySelector<HTMLButtonElement>(
        '[data-home-tab="tasks"][aria-selected="false"]',
      )
      ?.click();
    return [
      ...h.target.querySelectorAll<HTMLButtonElement>(
        '[data-room-inbox-message][data-kind="task"] [data-inbox-open]',
      ),
    ].find((node) => node.textContent?.includes(task.title));
  };
  for (let i = 0; i < 20 && !find(); i++) await flush();
  const old = find()!;
  expect(!!old).toBe(true);
  const binding = get(h.inbox.state).binding!;
  h.inbox.close(binding);
  h.inbox.open();
  expect(old.isConnected).toBe(true);
  const before = h.href();
  old.click();
  expect(h.href()).toBe(before);
  await flush();
  for (let i = 0; i < 20 && !find(); i++) await flush();
  const fresh = find()!;
  expect(!!fresh).toBe(true);
  expect(fresh !== old).toBe(true);
  // A click opens the task's workspace beside the list: the Home stays; "Abrir na sala" leaves for the room.
  fresh.click();
  await flush();
  expect(h.href()).toBe(before);
  const workspace = h.target.querySelector("[data-task-workspace]");
  expect(!!workspace).toBe(true);
  h.target.querySelector<HTMLButtonElement>("[data-task-open-room]")!.click();
  expect(h.href() !== before).toBe(true);
  expect(get(h.inbox.state).binding === null).toBe(true);
});

test("home Inbox old connected question controls cannot act on a same-ID canonical edit before flush", async () => {
  let writes = 0;
  const original = {
    book_id: "aaaaaa",
    room: "Room",
    ref: "m1",
    thread: "main",
    topic: null,
    author: "friend@test",
    author_name: "Friend",
    text: "Original Inbox question",
    ts: 1,
  };
  const h = await homeInbox({
    resolve: async () => {
      writes++;
      return { ok: true };
    },
  });
  h.canonicalPersonal(me({ waits: [original] }));
  await h.services.personal.refresh();
  h.inbox.open();
  await flush();
  await waitForView(h.target, "[data-room-inbox-message] button");
  const article = h.target.querySelector("[data-room-inbox-message]")!,
    oldGo = article.querySelector<HTMLButtonElement>("button")!,
    oldResolve = article.querySelector<HTMLButtonElement>(
      "[data-inbox-resolve]",
    )!;
  expect(!!oldGo && !!oldResolve).toBe(true);
  const edited = { ...original, text: "Edited Inbox question", ts: 2 },
    person = h.services.personal.peek()!;
  h.canonicalPersonal(me({ waits: [edited] }));
  // Synchronous canonical publication deliberately precedes Svelte's DOM flush.
  h.services.personal.state.update((value) => ({
    ...value,
    me: { ...person, waits: [edited] },
  }));
  expect(oldGo.isConnected && oldResolve.isConnected).toBe(true);
  const before = h.href();
  oldResolve.click();
  oldGo.click();
  // The row's exit animation, then the Undo window: send what was resolved now.
  await new Promise((done) => setTimeout(done, 260));
  h.inbox.flush();
  await settle();
  expect(writes).toBe(0);
  expect(h.href()).toBe(before);
  await flush();
  const freshArticle = h.target.querySelector("[data-room-inbox-message]")!,
    freshGo = freshArticle.querySelector<HTMLButtonElement>("button")!,
    freshResolve = freshArticle.querySelector<HTMLButtonElement>(
      "[data-inbox-resolve]",
    )!;
  expect(freshGo !== oldGo).toBe(true);
  expect(freshArticle.textContent).toContain(edited.text);
  freshResolve.click();
  await new Promise((done) => setTimeout(done, 260));
  expect(writes).toBe(0);
  h.inbox.flush();
  await settle();
  expect(writes).toBe(1);
  await flush();
  h.target
    .querySelector<HTMLButtonElement>("[data-room-inbox-message] button")!
    .click();
  await flush();
  // A click opens the message's thread beside the list; "Abrir na sala" leaves for the room on it.
  expect(h.href()).toBe(before);
  h.target.querySelector<HTMLButtonElement>("[data-task-open-room]")!.click();
  expect(h.href() !== before).toBe(true);
});

test("real RoomShell rejects connected card-A intent after same-ID canonical msgCard replacement", async () => {
  const h = await actualRoomShell();
  const wire = (title: string, label: string) =>
    JSON.stringify({
      root: "c",
      elements: {
        c: { type: "Card", props: { title }, children: ["a"] },
        a: { type: "Actions", children: ["b"] },
        b: { type: "Button", props: { label, value: "approve" } },
      },
    });
  const first = wire("Context A", "Approve A"),
    second = wire("Context B", "Approve B");
  h.publish({
    ...h.canonical,
    messages: [
      {
        id: 1,
        thread: "main",
        author: h.canonical.me,
        kind: "agent",
        text: "Card prompt",
        card: first,
        ts: 1,
      },
    ],
  });
  await flush();
  await waitForView(h.target, '[data-card-answer="approve"]');
  const old = h.target.querySelector<HTMLButtonElement>(
    '[data-card-answer="approve"]',
  )!;
  expect(old.textContent).toContain("Approve A");
  const before = h.roomCommands.filter((command) => command.t === "msg").length;
  h.connectionCallbacks.at(-1)!.onEvent({ t: "msgCard", id: 1, card: second });
  expect(
    h.services.rootRoom
      .read()
      .room?.messages.find((message) => message.id === 1)?.card,
  ).toBe(second);
  expect(old.isConnected).toBe(true);
  expect(old.textContent).toContain("Approve A");
  old.click();
  expect(h.roomCommands.filter((command) => command.t === "msg").length).toBe(
    before,
  );
  await flush();
  await waitForView(h.target, '[data-card-answer="approve"]');
  const current = h.target.querySelector<HTMLButtonElement>(
    '[data-card-answer="approve"]',
  )!;
  expect(current.textContent).toContain("Approve B");
  // An unrelated canonical receipt refresh retains the same legitimate card intent.
  h.connectionCallbacks.at(-1)!.onEvent({ t: "receipts", receipts: [] });
  current.click();
  expect(h.roomCommands.filter((command) => command.t === "msg").length).toBe(
    before + 1,
  );
  const sent = h.roomCommands.filter((command) => command.t === "msg").at(-1);
  if (!sent || sent.t !== "msg") throw Error("Expected current card reply");
  expect(sent.reply_to).toBe(1);
  expect(sent.text).toBe("approve");
});
test("Pedidos: an invite's Entrar joins, a message request shows its first message and × declines", async () => {
  const { default: Requests } =
    await import("../web/features/app-navigation/Requests.svelte");
  const joins: [string, boolean][] = [],
    answers: [string, boolean][] = [];
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Requests, {
      target,
      props: {
        lang: "en",
        invites: [
          {
            book_id: "aaaaaa",
            title: "Trip",
            icon: null,
            inviter: "ana@test.com",
            inviter_name: "Ana",
            inviter_avatar: null,
            people: 3,
            created_at: 1,
          },
        ],
        requests: [
          { email: "bia@test.com", name: "Bia", avatar: null, msg: "hi there" },
        ],
        onjoin: async (room: string, yes: boolean) => {
          joins.push([room, yes]);
        },
        onanswer: async (email: string, yes: boolean) => {
          answers.push([email, yes]);
        },
      },
    }),
  );
  cleanups.push(() => {
    flushSync(() => {
      void unmount(component);
    });
    target.remove();
  });
  await flush();
  const invite = target.querySelector<HTMLElement>(
    '[data-request="room:aaaaaa"]',
  )!;
  expect(invite.textContent).toContain("Ana invited you");
  [...invite.querySelectorAll("button")]
    .find((button) => button.textContent?.trim() === "Join")!
    .click();
  await flush();
  expect(joins).toEqual([["aaaaaa", true]]);
  const request = target.querySelector<HTMLElement>(
    '[data-request="dm:bia@test.com"]',
  )!;
  expect(request.textContent).toContain("hi there");
  request.querySelector<HTMLButtonElement>('[aria-label="Decline"]')!.click();
  await flush();
  expect(answers).toEqual([["bia@test.com", false]]);
});

test("Company rooms: the rail's 2×2 grid opens a popover with the rooms you can join; Join joins, none shows the empty state; a phone gets a bottom sheet", async () => {
  const { default: CompanyRooms } =
    await import("../web/features/app-navigation/CompanyRooms.svelte");
  const joined: string[] = [];
  let opened = 0;
  const farm: OrgRoom = {
    id: "aaaaaa",
    title: "Farm Rio Project",
    icon: null,
    people: 3,
    opened_by: "gimenes@test.com",
    opened_by_name: "Gimenes",
  };
  const open = async (rooms: OrgRoom[], phone = false) => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = flushSync(() =>
      mount(CompanyRooms, {
        target,
        props: {
          lang: "en",
          rooms,
          phone,
          onjoin: async (room: string) => {
            joined.push(room);
          },
          onopen: () => {
            opened++;
          },
        },
      }),
    );
    const close = () => {
      flushSync(() => {
        void unmount(component);
      });
      target.remove();
    };
    cleanups.push(close);
    const button = target.querySelector<HTMLButtonElement>(
      "[data-company-rooms-button]",
    )!;
    expect(button.getAttribute("aria-label")).toBe("Company rooms");
    button.click();
    await flush();
    const panel = document.querySelector<HTMLElement>("[data-company-rooms]")!;
    return { button, panel, close };
  };
  // Desktop: a popover beside the rail button, never a dialog.
  const desk = await open([farm]);
  expect(opened).toBe(1);
  expect(desk.panel.dataset.slot).toBe("popover-content");
  const row = desk.panel.querySelector<HTMLElement>(
    '[data-company-room="aaaaaa"]',
  )!;
  expect(row.textContent).toContain("Farm Rio Project");
  expect(row.textContent).toContain("Opened by Gimenes · 3 people");
  [...row.querySelectorAll("button")]
    .find((entry) => entry.textContent?.trim() === "Join")!
    .click();
  await flush();
  expect(joined).toEqual(["aaaaaa"]);
  expect(desk.button.getAttribute("aria-expanded")).toBe("false");
  desk.close();
  const empty = await open([]);
  expect(
    empty.panel
      .querySelector("[data-company-rooms-empty]")!
      .textContent?.trim(),
  ).toBe("No company rooms to join right now.");
  empty.close();
  // A phone: the same list in a sheet from the bottom.
  environment.happyDOM.setViewport({ width: 400, height: 800 });
  cleanups.push(() =>
    environment.happyDOM.setViewport({ width: 1024, height: 768 }),
  );
  await flush();
  const phone = await open([farm], true);
  expect(phone.panel.dataset.slot).toBe("sheet-content");
  expect(phone.panel.getAttribute("role")).toBe("dialog");
  expect(phone.panel.textContent).toContain("Company rooms");
  expect(
    phone.panel.querySelector('[data-company-room="aaaaaa"]')!.textContent,
  ).toContain("Opened by Gimenes · 3 people");
});

test("a DM still loading draws your real DM list beside the placeholder chat; a room keeps its own skeleton", async () => {
  const { default: RoomSkeleton } =
    await import("../web/features/room-shell/RoomSkeleton.svelte");
  const h = shellFixture();
  h.services.start();
  await h.services.personal.refresh();
  cleanups.push(() => h.services.dispose());
  const draw = async (roomId: string) => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = flushSync(() =>
      mount(RoomSkeleton, {
        target,
        props: { roomId, services: h.services, onhome: () => {} },
      }),
    );
    cleanups.push(() => {
      flushSync(() => {
        void unmount(component);
      });
      target.remove();
    });
    await flush();
    return target;
  };
  const dm = await draw(`dm${"a".repeat(20)}`);
  expect(dm.querySelector("[data-room-skeleton] [data-dm-nav]")).not.toBe(null);
  const room = await draw("aaaaaa");
  expect(room.querySelector("[data-room-skeleton]")).not.toBe(null);
  expect(room.querySelector("[data-dm-nav]")).toBe(null);
});

test("a room still loading draws its pane open or closed as the room will open it (vb.docClosed)", async () => {
  const { default: RoomSkeleton } =
    await import("../web/features/room-shell/RoomSkeleton.svelte");
  const h = shellFixture();
  h.services.start();
  await h.services.personal.refresh();
  cleanups.push(() => h.services.dispose());
  const draw = async () => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = flushSync(() =>
      mount(RoomSkeleton, {
        target,
        props: { roomId: "aaaaaa", services: h.services, onhome: () => {} },
      }),
    );
    cleanups.push(() => {
      flushSync(() => {
        void unmount(component);
      });
      target.remove();
    });
    await flush();
    return target;
  };
  cleanups.push(() => localStorage.removeItem("vb.docClosed"));
  localStorage.setItem("vb.docClosed", "1");
  expect((await draw()).querySelector("[data-room-skeleton-document]")).toBe(
    null,
  );
  localStorage.setItem("vb.docClosed", "0");
  expect(
    (await draw()).querySelector("[data-room-skeleton-document]"),
  ).not.toBe(null);
  // The main thread's bar holds the room's search, as RoomHeader draws it (#318).
  expect((await draw()).textContent).toContain(
    h.services.t("Buscar nesta sala").slice(0, 6),
  );
});

test("a DM still loading is named after the other person and its main thread reads Conversation", async () => {
  const { default: RoomSkeleton } =
    await import("../web/features/room-shell/RoomSkeleton.svelte");
  const pair = `dm${"b".repeat(20)}`;
  const h = shellFixture({
    me: async () =>
      me({
        books: [
          room(pair, {
            title: "Me · Ana",
            members: "me@test.com,ana@test.com",
            dm: 1,
            peer_name: "Ana Lima",
            peer_avatar: 7,
          }),
        ],
      }),
  });
  h.services.start();
  await h.services.personal.refresh();
  cleanups.push(() => h.services.dispose());
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(RoomSkeleton, {
      target,
      props: { roomId: pair, services: h.services, onhome: () => {} },
    }),
  );
  cleanups.push(() => {
    flushSync(() => {
      void unmount(component);
    });
    target.remove();
  });
  await flush();
  const text = target.textContent ?? "";
  expect(text).toContain("Ana Lima");
  expect(text).not.toContain("Me · Ana");
  expect(text).toContain(h.services.t("Conversa"));
  expect(text).not.toContain(h.services.t("Sala principal"));
  // The peer's picture, from the DM row itself (no shared room, no connection).
  expect(target.innerHTML).toContain("/api/avatar/ana%40test.com?v=7");
});

test("the same person draws the same face whatever case their email is written in", async () => {
  const { default: PersonAvatar } =
    await import("../web/lib/components/PersonAvatar.svelte");
  const draw = async (email: string) => {
    const target = document.createElement("div");
    document.body.append(target);
    const component = flushSync(() =>
      mount(PersonAvatar, { target, props: { email } }),
    );
    cleanups.push(() => {
      flushSync(() => {
        void unmount(component);
      });
      target.remove();
    });
    await flush();
    return target.querySelector("svg")?.outerHTML;
  };
  const face = await draw("ana@test.com");
  expect(face).toBeTruthy();
  expect(await draw(" Ana@Test.COM ")).toBe(face);
});

test("DM list: each person's online dot follows the person socket's presence, and You is always online", async () => {
  const { default: DmNav } =
    await import("../web/features/app-navigation/DmNav.svelte");
  const bia = `dm${"b".repeat(20)}`,
    caio = `dm${"c".repeat(20)}`;
  const dm = (id: string, email: string) =>
    room(id, { dm: 1, title: null, members: `me@test.com,${email}` });
  const h = shellFixture({
    me: async () =>
      me({
        books: [dm(bia, "bia@test.com"), dm(caio, "caio@test.com")],
        people: [
          { email: "bia@test.com", name: "Bia", avatar: null, rooms: [] },
          { email: "caio@test.com", name: "Caio", avatar: null, rooms: [] },
        ],
      }),
  });
  h.services.start();
  await h.services.personal.refresh();
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(DmNav, {
      target,
      props: { controller: h.services.navigation, lang: "en" },
    }),
  );
  cleanups.push(() => {
    flushSync(() => {
      void unmount(component);
    });
    target.remove();
    h.services.dispose();
  });
  await flush();
  const row = (id: string) =>
    target.querySelector<HTMLElement>(`li[data-dm="${id}"]`)!;
  const dot = (id: string) =>
    row(id).querySelector<HTMLElement>("[data-status-dot]")!;
  expect(row(bia).dataset.presence).toBe("offline");
  expect(dot(bia).dataset.statusDot).toBe("offline");
  expect(dot(bia).getAttribute("aria-label")).toBe("Bia · Offline");
  const self = row("dm000000000000000000aa");
  expect(self.dataset.presence).toBe("online");
  expect(
    self.querySelector("[data-status-dot]")!.getAttribute("aria-label"),
  ).toBe("You · Online");

  h.services.personal.presence({
    people: [
      { email: "bia@test.com", online: true },
      { email: "caio@test.com", online: true },
    ],
    all: true,
  });
  await flush();
  expect(row(bia).dataset.presence).toBe("online");
  expect(dot(bia).getAttribute("aria-label")).toBe("Bia · Online");
  expect(row(caio).dataset.presence).toBe("online");

  // A change patches one person; a new full list replaces everything.
  h.services.personal.presence({
    people: [{ email: "bia@test.com", online: false }],
    all: false,
  });
  await flush();
  expect(row(bia).dataset.presence).toBe("offline");
  expect(row(caio).dataset.presence).toBe("online");
  h.services.personal.presence({ people: [], all: true });
  await flush();
  expect(row(caio).dataset.presence).toBe("offline");
});

test("the phone home's waiting list opens the rest in place, and closes it again (Gimenes #3942)", async () => {
  const { default: ChatList } =
    await import("../web/features/home/ChatList.svelte");
  const wait = (
    ref: string,
    ts: number,
  ): ReturnType<typeof me>["waits"][number] => ({
    book_id: "aaaaaa",
    room: "Room aaaaaa",
    ref,
    thread: "e",
    topic: "Epic",
    author: "other@test.com",
    author_name: "Other",
    text: `wait ${ref}`,
    ts,
  });
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(ChatList, {
      target,
      props: {
        me: me({
          waits: ["m1", "m2", "m3", "m4", "m5"].map((ref, i) =>
            wait(ref, i + 1),
          ),
        }),
        seen: {},
        now: 10,
        lang: "en",
        ago: () => "1m",
        onnavigate: () => {},
      },
    }),
  );
  cleanups.push(() => {
    flushSync(() => {
      void unmount(component);
    });
    target.remove();
  });
  await flush();
  const rows = () => target.querySelectorAll("[data-home-waiting] li").length;
  const more = () =>
    target.querySelector<HTMLButtonElement>("[data-home-waiting-more]")!;
  expect(rows()).toBe(3);
  expect(more().textContent).toContain("See all 5");
  flushSync(() => more().click());
  expect(rows()).toBe(5);
  expect(more().getAttribute("aria-expanded")).toBe("true");
  expect(more().textContent).toContain("Show less");
  flushSync(() => more().click());
  expect(rows()).toBe(3);
});

test("a phone's list of conversations puts a new version first, as the desktop sidebar's green row (Gimenes #4613, #4630)", async () => {
  environment.happyDOM.setViewport({ width: 400, height: 800 });
  cleanups.push(() =>
    environment.happyDOM.setViewport({ width: 1024, height: 768 }),
  );
  const { personal, rooms, pwa, profile, creator } = await setup({
    me: async () => me({ books: [room("aaaaaa")] }),
  });
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Home, {
      target,
      props: {
        pwa,
        personal,
        rooms,
        profile,
        creator,
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroommenu: () => {},
        onsearch: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  const list = () => target.querySelector('[data-home-layout="chats"]');
  const center = () => list()?.querySelector('[data-user-center="phone"]');
  const update = () => center()?.querySelector('[data-view="update"]');
  const badge = () => list()?.querySelector("[data-home-bar] [data-count]");
  expect(list()).not.toBeNull();
  // Nothing open: no box and no number on your face.
  expect(center()).toBeNull();
  expect(badge()).toBeNull();
  personal.updateAvailable(true);
  await flush();
  expect(update()?.textContent).toContain("New version");
  expect(badge()?.textContent).toBe("1");
  expect(
    list()!
      .querySelector("[data-home-bar] [data-account-row]")!
      .getAttribute("aria-label"),
  ).toContain("1 notice for you");
  // The phone's user center: under the search field.
  const search = list()!.querySelector("[data-home-search]")!;
  expect(
    search.compareDocumentPosition(center()!) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  personal.updateAvailable(false);
  await flush();
  expect(center()).toBeNull();
  expect(badge()).toBeNull();
});

test("a phone's invites and message requests are rows of its user center, once, with their count on your face (Gimenes, step 4)", async () => {
  environment.happyDOM.setViewport({ width: 400, height: 800 });
  cleanups.push(() =>
    environment.happyDOM.setViewport({ width: 1024, height: 768 }),
  );
  const { personal, rooms, pwa, profile, creator } = await setup({
    me: async () =>
      me({
        books: [room("aaaaaa")],
        invites: [
          {
            book_id: "bbbbbb",
            title: "Trip",
            icon: null,
            inviter: "ana@test.com",
            inviter_name: "Ana",
            inviter_avatar: null,
            people: 3,
            created_at: 1,
          },
        ],
        requests: [
          { email: "bia@test.com", name: "Bia", avatar: null, msg: "hi" },
        ],
      }),
  });
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(Home, {
      target,
      props: {
        pwa,
        personal,
        rooms,
        profile,
        creator,
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroommenu: () => {},
        onsearch: () => {},
      },
    }),
  );
  cleanups.push(() =>
    flushSync(() => {
      void unmount(component);
    }),
  );
  await flush();
  const list = target.querySelector('[data-home-layout="chats"]')!;
  const center = list.querySelector('[data-user-center="phone"]')!;
  expect(center.querySelector('[data-request="room:bbbbbb"]')).not.toBeNull();
  expect(
    center.querySelector('[data-request="dm:bia@test.com"]'),
  ).not.toBeNull();
  // Not a second time over the list.
  expect(list.querySelectorAll("[data-request]").length).toBe(2);
  expect(list.querySelector("[data-home-bar] [data-count]")?.textContent).toBe(
    "2",
  );
});

test("the call's panel in another room goes back to the call's room with the stage open (Jonas, 2026-11-25)", async () => {
  // I am in room cccccc's call (the microphone never answers here: the call stays "joining").
  const media = Reflect.get(window.navigator, "mediaDevices");
  Object.defineProperty(window.navigator, "mediaDevices", {
    value: { getUserMedia: () => new Promise(() => {}) },
    configurable: true,
  });
  const hub = createCallHub({
    api: {
      join: async () => "s-me",
      leave: async () => {},
    } as unknown as CallApi,
    connect: () => ({ start() {}, dispose() {}, send: () => true }),
  });
  setCallHub(hub);
  cleanups.push(() => {
    setCallHub(null);
    Object.defineProperty(window.navigator, "mediaDevices", {
      value: media,
      configurable: true,
    });
  });
  hub.session("cccccc", { title: () => "Sala da call" }).join();
  // In another room: its sidebar has the call's panel, and no stage.
  const h = await actualRoomShell();
  h.publish(h.canonical);
  await flush();
  expect(h.target.querySelector("[data-call-stage]")).toBe(null);
  const panel = h.target.querySelector<HTMLElement>("[data-call-panel-open]");
  expect(panel?.textContent).toContain("Sala da call");
  panel!.click();
  await flush();
  expect(h.href()).toContain("/b/cccccc");
  // The call's room comes up: the stage is open on it, not the chat.
  const callRoom: Room = {
    ...h.canonical,
    id: "cccccc",
    book: { title: "Sala da call", owner: "me@test.com" },
    call: [{ email: "me@test.com", session: "s-me", tracks: [] }],
    callThread: CALL_THREAD,
  };
  h.publish(callRoom);
  await flush();
  await flush();
  expect(h.target.querySelector("[data-call-stage]") !== null).toBe(true);
});

test("home Inbox keeps the item you answered open on the right after it leaves the list (PO #5569)", async () => {
  const task = (id: string, title: string): InboxTask => ({
    book_id: "aaaaaa",
    room: "Room",
    epic_id: `e${id}`,
    epic: `Epic ${id}`,
    task_id: id,
    title,
    status: "todo",
    due: null,
  });
  const first = task("t1", "Answered task"),
    second = task("t2", "Other task");
  let tasks = [first, second];
  const h = await homeInbox({
    inbox: async () => ({ waits: [], mentions: [], tasks }),
  });
  h.inbox.open();
  await flush();
  await waitForView(h.target, "[data-room-inbox] button");
  const row = (title: string) =>
    [
      ...h.target.querySelectorAll<HTMLButtonElement>(
        '[data-room-inbox-message][data-kind="task"] [data-inbox-open]',
      ),
    ].find((node) => node.textContent?.includes(title));
  for (let i = 0; i < 20 && !row(first.title); i++) {
    h.target
      .querySelector<HTMLButtonElement>(
        '[data-home-tab="tasks"][aria-selected="false"]',
      )
      ?.click();
    await flush();
  }
  row(first.title)!.click();
  await flush();
  const workspace = () =>
    h.target.querySelector<HTMLElement>("[data-home-workspace]")!;
  expect(workspace().dataset.item).toBe("t:aaaaaa:t1");
  // The task is done in its room: the Inbox reads again and it leaves the list…
  tasks = [second];
  h.inbox.changed(get(h.inbox.state).binding!);
  for (let i = 0; i < 20 && row(first.title); i++) await flush();
  expect(!!row(first.title)).toBe(false);
  // …but it stays open on the right, with nothing left to act on, until you pick another item.
  expect(workspace().dataset.item).toBe("t:aaaaaa:t1");
  expect(workspace().dataset.gone).toBe("true");
  expect(!!h.target.querySelector("[data-task-workspace]")).toBe(true);
  row(second.title)!.click();
  await flush();
  expect(workspace().dataset.item).toBe("t:aaaaaa:t2");
});
