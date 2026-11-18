// Component-level Happy DOM fixtures only. No Worker, real browser, auth or room is represented.
import { afterEach, beforeEach, expect, test } from "bun:test";
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";
import { Window } from "happy-dom";
import { get, writable } from "svelte/store";
import { createPersonalSession } from "../svelte/features/home/personal";
import { createRoomsSession } from "../svelte/features/rooms/session";
import { createNewRoomSession } from "../svelte/features/home/session";
import { createAccountSession } from "../svelte/features/account/session";
import { createApplicationInbox } from "../svelte/features/application/inbox";
import type { HomeApi } from "../svelte/features/home/api";
import type { AccountApi } from "../svelte/features/account/api";
import type { RoomTarget } from "../svelte/features/home/model";
import type { InboxMention, InboxTask } from "../svelte/types";
import { createPwaService } from "../svelte/features/pwa/service";
import {
  deferred,
  homeApi,
  manualClock,
  me,
  room,
  settle,
  suggestion,
} from "./native-home-fixtures";
const environment = new Window({ url: "https://vibebook.test/app?ui=svelte" });
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
  name: "native-home-components",
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
const { default: Home } =
  await import("../svelte/features/home/HomePanel.svelte");
const { default: Inbox } = await import("../svelte/Inbox.svelte");
const { default: WaitList } =
  await import("../svelte/features/home/WaitList.svelte");
const { default: AppNavigation } =
  await import("../svelte/features/app-navigation/AppNavigation.svelte");
const { default: NavigationDialogs } =
  await import("../svelte/features/app-navigation/AppNavigationDialogs.svelte");
const { default: RoomTile } =
  await import("../svelte/features/home/RoomTile.svelte");
const { default: ApplicationShellHarness } =
  await import("./application-shell-harness.svelte");
const { shellFixture } = await import("./application-shell-fixtures");
const { default: RoomShellHarness } =
  await import("./room-shell-harness.svelte");
const { createRoomResources } =
  await import("../svelte/features/application/roomResources");
import type { Room, RoomEvent } from "../shared/room";
import type { RoomScopeBrowser } from "../svelte/features/room-scope/types";
import type { RoomLayoutBrowser } from "../svelte/features/room-layout/types";
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanups.splice(0).reverse()) dispose();
  document.body.replaceChildren();
  localStorage.clear();
});
// The one-off "new vibebook" welcome (NewUiWelcome) has its own test below; the app fixtures here have seen it.
beforeEach(() => localStorage.setItem("vb.newUiWelcomed", "1"));
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
test("direct application shell renders native Home/Archive and the required room snippet, then releases document owners", async () => {
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
  expect(target.querySelector("[data-native-app-shell]") !== null).toBe(true);
  expect(h.services.active()).toBe(true);
  expect(h.languages).toEqual(["document:en"]);
  await waitForView(target, "[data-native-app-navigation]");
  const navigation = target.querySelector("[data-native-app-navigation]");
  expect(navigation).not.toBeNull();
  h.services.actions.archived();
  await flush();
  await waitForView(target, '[data-vb-native="archived"]');
  expect(target.querySelector('[data-vb-native="archived"]') !== null).toBe(
    true,
  );
  h.services.actions.navigate({ roomId: "aaaaaa" });
  await flush();
  expect(target.querySelector("[data-test-room-snippet]") !== null).toBe(true);
  expect(target.querySelector("[data-native-app-navigation]")).toBe(navigation);
  expect(
    target.querySelector(
      "[data-native-application-route] [data-test-room-snippet]",
    ),
  ).not.toBeNull();
  h.services.actions.home();
  await flush();
  await waitForView(target, '[data-vb-native="home"]');
  expect(target.querySelector("[data-native-app-navigation]")).toBe(navigation);
  flushSync(() => {
    void unmount(component);
  });
  await flush();
  expect(h.services.active()).toBe(false);
  expect(h.stopped).toContain("theme");
  expect(h.stopped).toContain("navigation");
  expect(h.stopped).toContain("pop");
});
test("direct Account composition preserves native profile confirmation and supplies real notification/agent snippets", async () => {
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
  name.value = "Native Shell Name";
  name.dispatchEvent(new Event("input", { bubbles: true }));
  name
    .closest("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  expect(h.names).toEqual(["Native Shell Name"]);
  expect(get(h.services.account.state).phase).toBe("confirming");
  h.canonical(me({ name: "Native Shell Name" }));
  await h.services.personal.refresh();
  await flush();
  expect(get(h.services.account.state).phase).toBe("idle");
  h.services.actions.openAccount();
  await flush();
  expect(document.querySelector("[data-native-notifications]") !== null).toBe(
    true,
  );
  expect(document.querySelector("[data-native-agent-setup]") !== null).toBe(
    true,
  );
});
test("you at the sidebar's foot open the settings page: every section on it, leaving closes it, sign out runs the application flow", async () => {
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
  await waitForView(target, "a[data-native-account-row]");
  // A plain click on a data-nav link: the shell follows it in place.
  const row = target.querySelector<HTMLAnchorElement>(
    "a[data-native-account-row]",
  )!;
  h.navigate(new MouseEvent("click", { button: 0, cancelable: true }), row);
  await waitForView(document, "#account-name");
  expect(new URL(h.href()).pathname).toBe("/settings");
  expect(get(h.services.state).route.kind).toBe("settings");
  expect(get(h.services.account.state).open).toBe(true);
  // One page, one anchor per section (the sidebar's rows).
  for (const id of ["profile", "agents", "cloud", "device"])
    expect(document.getElementById(id) !== null).toBe(true);
  expect(document.querySelector("[data-native-notifications]") !== null).toBe(
    true,
  );
  expect(document.querySelector("[data-native-user-menu]")).toBeNull();
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
  expect(h.documents).toEqual(["/"]);
});
test("the phone thread sheet's tabs: This room shows the sidebar, All rooms lists every room", async () => {
  const { default: RoomStrip } =
    await import("../svelte/features/app-navigation/RoomStrip.svelte");
  const { createRawSnippet } = await import("svelte");
  const h = shellFixture();
  h.canonical(
    me({
      books: [room("aaaaaa"), room("bbbbbb"), room("cccccc"), room("dddddd")],
    }),
  );
  h.services.start();
  await h.services.personal.refresh();
  cleanups.push(() => h.services.dispose());
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(RoomStrip, {
      target,
      props: {
        controller: h.services.navigation,
        lang: "en",
        children: createRawSnippet(() => ({
          render: () => "<p data-this-room>epics</p>",
        })),
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
  // This room first: the sidebar's own content, no room list, no avatar.
  expect(target.querySelector("[data-this-room]")).not.toBe(null);
  expect(target.querySelector('[data-room-scope-panel="all"]')).toBe(null);
  expect(target.querySelector("[data-native-user-menu-trigger]")).toBe(null);
  const all = target.querySelector<HTMLElement>('[data-room-scope="all"]')!;
  expect(all.textContent).toContain("All rooms");
  all.click();
  await flush();
  // All rooms: Home + every room + "Você" (your own DM), and the room's own content steps aside.
  const list = target.querySelector('[data-room-scope-panel="all"]')!;
  expect(list.querySelectorAll("[data-room-avatar]").length).toBe(5);
  expect(
    target
      .querySelector('[data-room-scope-panel="room"]')!
      .className.includes("hidden"),
  ).toBe(true);
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
  await waitForView(document, "#native-new-room");
  const oldInput =
      document.querySelector<HTMLTextAreaElement>("#native-new-room")!,
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
  const fresh =
    document.querySelector<HTMLTextAreaElement>("#native-new-room")!;
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
    ["agent", "✦"],
    ["agent", "✻"],
  ];
  // Agent marks say so (data-avatar); any other Studio avatar is a person only when round.
  const shapes = (root: ParentNode) =>
    [...root.querySelectorAll("[data-avatar], [data-slot=avatar]")].map((el) =>
      el.getAttribute("data-avatar") === "agent"
        ? ["agent", el.textContent?.trim()]
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
  expect(shapes(dialog)).toEqual([...expected, ["agent", "✦"]]);
});
test("global Inbox direct callbacks reject old connected account controls and close on identity replacement", async () => {
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
  h.services.actions.navigate({ roomId: "aaaaaa" });
  await flush();
  const open = [...target.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === "Open fixture inbox",
  )!;
  expect(open !== undefined).toBe(true);
  open.click();
  await flush();
  await waitForView(document, '[role="dialog"] a');
  const link = [
    ...document.querySelectorAll<HTMLAnchorElement>('[role="dialog"] a'),
  ].find((anchor) => anchor.textContent?.includes("Question"))!;
  expect(link !== undefined).toBe(true);
  const resolveLabel = h.services.t(
    "Já resolvi (respondi em outro lugar, ou não é comigo)",
  );
  const resolve = [
    ...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
  ].find((button) => button.getAttribute("aria-label") === resolveLabel)!;
  expect(resolve !== undefined).toBe(true);
  h.canonical(me({ email: "other@test", waits: [wait] }));
  await h.services.personal.refresh();
  const before = h.href();
  link.dispatchEvent(
    new MouseEvent("click", { button: 0, bubbles: true, cancelable: true }),
  );
  resolve.click();
  expect(h.href()).toBe(before);
  expect(resolves).toBe(0);
  await flush();
  expect(document.querySelector('[role="dialog"]')).toBe(null);
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
  const inbox = createApplicationInbox(h.services, h.timer.clock);
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() =>
    mount(RoomShellHarness, {
      target,
      props: {
        presentation: { services: h.services, openInbox: inbox.open, inbox },
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
    inbox.dispose();
    h.services.dispose();
    resources.dispose();
  });
  const canonical: Room = {
    id: "aaaaaa",
    me: "me@test.com",
    book: { title: "Real native composition", owner: "me@test.com" },
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
    inbox,
    resources,
    target,
    canonicalPersonal: h.canonical,
    canonical,
    publish,
  };
}
test("real RoomShell uses genuine loading/terminal states and directly renders current canonical native features", async () => {
  const h = await actualRoomShell();
  await flush();
  expect(
    h.target.querySelector('[data-native-room-status="loading"]') !== null,
  ).toBe(true);
  expect(h.target.querySelector("[data-native-composer]")).toBe(null);
  h.publish(h.canonical);
  await flush();
  expect(h.target.querySelector("[data-native-room-sidebar]") !== null).toBe(
    true,
  );
  expect(h.target.querySelector("[data-native-room-header]") !== null).toBe(
    true,
  );
  // Notifications moved to the avatar menu: no bell in the room header.
  expect(
    h.target.querySelector(
      "[data-native-room-header] [data-native-notifications]",
    ),
  ).toBe(null);
  expect(h.target.querySelector("[data-native-composer]") !== null).toBe(true);
  expect(h.target.querySelector("[data-native-document]") !== null).toBe(true);
  expect(h.target.textContent).toContain("Canonical visible message");
  h.connectionCallbacks.at(-1)!.onRemoved?.();
  await flush();
  expect(
    h.target.querySelector('[data-native-room-status="removed"]') !== null,
  ).toBe(true);
  expect(h.target.querySelector("[data-native-composer]")).toBe(null);
  expect(h.target.textContent).not.toContain("Canonical visible message");
});
// Desktop has no board pane: the board is always full width, behind its toggle.
test("real RoomShell retains one Board DOM instance across full-board openings", async () => {
  const h = await actualRoomShell();
  h.publish(h.canonical);
  await flush();
  const toggle = h.target.querySelector<HTMLButtonElement>(
    "[data-native-board-toggle]",
  )!;
  expect(toggle !== null).toBe(true);
  toggle.click();
  await flush();
  await waitForView(h.target, "[data-board-scope]");
  const board = h.target.querySelector("[data-board-scope]");
  expect(board !== null).toBe(true);
  toggle.click();
  await flush();
  h.services.actions.selectPane("doc");
  await flush();
  toggle.click();
  await flush();
  expect(h.target.querySelectorAll("[data-board-scope]").length).toBe(1);
  expect(h.target.querySelector("[data-board-scope]") === board).toBe(true);
});
test("real RoomShell revokes connected outgoing Composer controls before a removed frame reaches the DOM", async () => {
  const h = await actualRoomShell();
  h.publish(h.canonical);
  await flush();
  const input = h.target.querySelector<HTMLTextAreaElement>(
      "[data-native-composer] textarea",
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
  expect(h.target.querySelector("[data-native-composer]")).toBe(null);
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
      `[data-native-room-status="${terminal}"]`,
    );
    expect(status !== null).toBe(true);
    expect(status?.textContent).toContain(
      h.services.t(
        terminal === "removed"
          ? "Você foi removido deste vibebook."
          : "Sem acesso a este vibebook. Peça para alguém de dentro te convidar.",
      ),
    );
    expect(h.target.textContent).not.toContain("Canonical visible message");
    expect(h.target.querySelector("[data-native-document]")).toBe(null);
    const home = [
      ...status!.querySelectorAll<HTMLButtonElement>("button"),
    ].find(
      (button) => button.textContent?.trim() === h.services.t("seus vibebooks"),
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
    providers: { google: false, github: false },
  }),
  name: async (name) => ({ ok: true, name }),
  avatar: async () => ({ ok: true, avatar: 1 }),
  connect: async () => ({ ok: true as const }),
  dismiss: async () => ({ ok: true as const }),
  answerInvite: async () => ({ ok: true as const }),
};
test("native Home renders untrusted room metadata as text and passes exact room identity", async () => {
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
        onlanguage: () => {},
        lang: "en",
        ago: () => "now",
        onnavigate: (value: RoomTarget) => navigation.push(value),
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroomsettings: () => {},
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
    'a[data-home-card][href="/b/aaaaaa?ui=svelte"]',
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
test("native Home ask box is the room's chat box: emoji, + menu and dictation that keeps listening", async () => {
  const rec: import("../svelte/features/composer/speech").SpeechRecognizer = {
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
        onlanguage: () => {},
        lang: "en",
        ago: () => "now",
        onnavigate: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: (trigger?: HTMLElement) => opened.push(trigger),
        onsettings: () => {},
        onroomsettings: () => {},
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
  ).toEqual(["Emoji", "More options", "Dictate message", "Send"]);
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
test("detached native tile link/settings actions cannot navigate after canonical row replacement", async () => {
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
        onsettings: (id: string, trigger: HTMLElement) =>
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
          onlanguage: () => {},
          lang: "en",
          ago: () => "now",
          onnavigate: (value: RoomTarget) => navigation.push(value),
          onhome: () => {},
          onarchived: () => {},
          onnew: () => {},
          onsettings: () => {},
          onroomsettings: () => {},
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
        onlanguage: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroomsettings: () => {},
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
test("actual Home mounts three onboarding steps, preserves drafts across Back and skips into ordinary Home", async () => {
  let canonical = me({ name: "", books: [] });
  const { personal, rooms, pwa, profile, creator } = await setup({
    me: async () => canonical,
  });
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
        onlanguage: () => {},
        onhome: () => {},
        onarchived: () => {},
        onnew: () => {},
        onsettings: () => {},
        onroomsettings: () => {},
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
  const click = (label: string) => {
    const button = [...target.querySelectorAll("button")].find(
      (value) => value.textContent?.trim() === label,
    );
    expect(!!button).toBe(true);
    button!.click();
  };
  const step = () =>
    target
      .querySelector("[data-native-onboarding]")
      ?.getAttribute("data-onboarding-step");
  expect(step()).toBe("1");
  expect(target.querySelector('[role="dialog"]')).toBe(null);
  const name = target.querySelector<HTMLInputElement>(
    'input[autocomplete="given-name"]',
  )!;
  name.value = "Ada";
  name.dispatchEvent(new Event("input", { bubbles: true }));
  target
    .querySelector("form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await flush();
  expect(step()).toBe("1"); // An HTTP success is not the canonical profile.
  canonical = me({ name: "Ada", books: [] });
  await personal.refresh();
  await flush();
  expect(step()).toBe("2");
  click("Skip for now");
  await flush();
  expect(step()).toBe("3");
  const draft = target.querySelector("textarea")!;
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
  expect(get(creator.state).busy).toBe(false);
  click("Back");
  await flush();
  expect(step()).toBe("2");
  click("Skip for now");
  await flush();
  expect(target.querySelector("textarea")!.value).toBe("A careful first room");
  click("Skip and see the home");
  await flush();
  expect(step()).toBe(undefined);
  expect(target.querySelector("#home-ask") === null).toBe(false);
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
  await waitForView(document, "#native-new-room");
  expect(document.querySelector("[role=combobox]")).toBeNull();
  expect(document.activeElement).toBe(
    document.querySelector("#native-new-room"),
  );
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

test("direct Search stacks over Settings without replacing its fields, while CtrlK keeps its explicit close behavior", async () => {
  const { controller, trigger, code } = await pendingNavigation();
  controller.openSettings("aaaaaa", trigger);
  await flush();
  code.resolve(NavigationDialogs);
  await flush();
  await waitForView(document, "#native-room-icon");
  const icon = document.querySelector<HTMLInputElement>("#native-room-icon")!;
  const settings = icon.closest('[role="dialog"]')!;
  icon.focus();
  controller.openSearch(icon);
  await flush();
  await waitForView(document, '[role="combobox"]');
  expect(document.querySelector("#native-room-icon")).toBe(icon);
  expect(settings.isConnected).toBe(true);
  expect(get(controller.state).settingsId).toBe("aaaaaa");
  expect(document.activeElement).toBe(
    document.querySelector('[role="combobox"]'),
  );
  controller.search.close();
  await flush();
  expect(document.querySelector("#native-room-icon")).toBe(icon);
  expect(document.activeElement).toBe(icon);
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(get(controller.state).settingsId).toBeNull();
  await flush();
  await waitForView(document, '[role="combobox"]');
  expect(document.querySelector("#native-room-icon")).toBeNull();
});

test("old connected Settings controls cannot mutate a replacement room opening", async () => {
  let writes = 0;
  const { h, controller, trigger, code } = await pendingNavigation({
    tint: async () => {
      writes++;
      return { ok: true };
    },
  });
  h.canonical(me({ books: [room("aaaaaa"), room("bbbbbb")] }));
  await h.services.personal.refresh();
  controller.openSettings("aaaaaa", trigger);
  await flush();
  code.resolve(NavigationDialogs);
  await flush();
  await waitForView(document, "#native-room-icon");
  const oldIcon =
    document.querySelector<HTMLInputElement>("#native-room-icon")!;
  const oldTint = oldIcon
    .closest('[role="dialog"]')!
    .querySelector<HTMLButtonElement>("fieldset button")!;
  controller.closeSettings();
  controller.openSettings("bbbbbb", trigger);
  expect(oldTint.isConnected).toBe(true);
  oldTint.click();
  expect(writes).toBe(0);
  expect(get(controller.state).settingsId).toBe("bbbbbb");
  await flush();
  await waitForView(document, "#native-room-icon");
  expect(document.querySelector("#native-room-icon")).not.toBe(oldIcon);
});

// Actual native RoomShell with typed synthetic HTTP/transport ports; no Worker claim.
test("room Inbox is nonmodal and retains existing Composer, document and Board nodes and draft", async () => {
  const h = await actualRoomShell({
    inbox: async () => ({ waits: [], mentions: [], tasks: [] }),
  });
  h.publish(h.canonical);
  await flush();
  // Mount the board (full width), then come back to the chat.
  const toggle = h.target.querySelector<HTMLButtonElement>(
    "[data-native-board-toggle]",
  )!;
  toggle.click();
  await flush();
  await waitForView(h.target, "[data-board-scope]");
  toggle.click();
  await flush();
  const board = h.target.querySelector("[data-board-scope]"),
    documentNode = h.target.querySelector("[data-native-document]"),
    composer = h.target.querySelector("[data-native-composer]");
  const input = h.target.querySelector<HTMLTextAreaElement>(
    "[data-native-composer] textarea",
  )!;
  expect(!!input).toBe(true);
  input.value = "Retained room draft";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await flush();
  h.inbox.open();
  await flush();
  await waitForView(h.target, "[data-native-room-inbox-close]");
  expect(document.querySelector('[role="dialog"]') === null).toBe(true);
  expect(h.target.querySelector("[data-board-scope]") === board).toBe(true);
  expect(
    h.target.querySelector("[data-native-document]") === documentNode,
  ).toBe(true);
  expect(h.target.querySelector("[data-native-composer]") === composer).toBe(
    true,
  );
  expect(composer?.closest("[inert]") !== null).toBe(true);
  h.target
    .querySelector<HTMLButtonElement>("[data-native-room-inbox-close]")!
    .click();
  await flush();
  expect(h.target.querySelector("[data-native-room-inbox]") === null).toBe(
    true,
  );
  expect(h.target.querySelector("[data-board-scope]") === board).toBe(true);
  expect(input.value).toBe("Retained room draft");
});
test("room Inbox rejects connected old-opening and removed-room task controls before DOM flush", async () => {
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
  const h = await actualRoomShell({
    inbox: async () => ({ waits: [], mentions: [], tasks: [task] }),
  });
  h.publish(h.canonical);
  await flush();
  h.inbox.open();
  await flush();
  await waitForView(h.target, "[data-native-room-inbox] button");
  const find = () =>
    [
      ...h.target.querySelectorAll<HTMLButtonElement>(
        "[data-native-room-inbox] button",
      ),
    ].find((node) => node.textContent?.trim() === task.title);
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
  h.connectionCallbacks.at(-1)!.onRemoved?.();
  expect(fresh.isConnected).toBe(true);
  fresh.click();
  expect(h.href()).toBe(before);
  expect(get(h.inbox.state).binding === null).toBe(true);
  await flush();
  expect(h.target.querySelector("[data-native-room-inbox]") === null).toBe(
    true,
  );
});

test("room Inbox old connected question controls cannot act on a same-ID canonical edit before flush", async () => {
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
  const h = await actualRoomShell({
    resolve: async () => {
      writes++;
      return { ok: true };
    },
  });
  h.publish(h.canonical);
  await flush();
  h.canonicalPersonal(me({ waits: [original] }));
  await h.services.personal.refresh();
  h.inbox.open();
  await flush();
  await waitForView(h.target, "[data-room-inbox-message] button");
  const article = h.target.querySelector("[data-room-inbox-message]")!,
    oldGo = article.querySelector<HTMLButtonElement>("button")!,
    oldResolve = [
      ...article.querySelectorAll<HTMLButtonElement>("button"),
    ].find((node) => node.textContent?.trim() === h.services.t("Resolvido"))!;
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
  expect(writes).toBe(0);
  expect(h.href()).toBe(before);
  await flush();
  const freshArticle = h.target.querySelector("[data-room-inbox-message]")!,
    freshGo = freshArticle.querySelector<HTMLButtonElement>("button")!,
    freshResolve = [
      ...freshArticle.querySelectorAll<HTMLButtonElement>("button"),
    ].find((node) => node.textContent?.trim() === h.services.t("Resolvido"))!;
  expect(freshGo !== oldGo).toBe(true);
  expect(freshArticle.textContent).toContain(edited.text);
  freshResolve.click();
  await settle();
  expect(writes).toBe(1);
  await flush();
  h.target
    .querySelector<HTMLButtonElement>("[data-room-inbox-message] button")!
    .click();
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
  await waitForView(h.target, '[data-native-card-answer="approve"]');
  const old = h.target.querySelector<HTMLButtonElement>(
    '[data-native-card-answer="approve"]',
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
  await waitForView(h.target, '[data-native-card-answer="approve"]');
  const current = h.target.querySelector<HTMLButtonElement>(
    '[data-native-card-answer="approve"]',
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
    await import("../svelte/features/app-navigation/Requests.svelte");
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
  expect(invite.textContent).toContain("Ana invited you · 3 people");
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

test("the new-vibebook welcome shows once to a returning person, never to a new account", async () => {
  const { mount, unmount, flushSync } = await import("svelte");
  const { default: NewUiWelcome } =
    await import("../svelte/features/onboarding/NewUiWelcome.svelte");
  const open = async (returning: boolean) => {
    const target = document.createElement("div");
    document.body.append(target);
    const instance = flushSync(() =>
      mount(NewUiWelcome, { target, props: { returning, lang: "en" } }),
    );
    await flush();
    const shown =
      document.querySelector("[data-new-ui-welcome]")?.textContent ?? "";
    await unmount(instance);
    target.remove();
    return shown;
  };
  localStorage.clear();
  expect(await open(false)).toBe("");
  expect(await open(true)).toBe(""); // the new account's first visit already counted
  localStorage.clear();
  expect(await open(true)).toContain("Welcome to the new vibebook");
  expect(await open(true)).toBe("");
});

test("a DM still loading draws your real DM list beside the placeholder chat; a room keeps its own skeleton", async () => {
  const { default: RoomSkeleton } =
    await import("../svelte/features/room-shell/RoomSkeleton.svelte");
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

test("a DM still loading is named after the other person and its main thread reads Conversation", async () => {
  const { default: RoomSkeleton } =
    await import("../svelte/features/room-shell/RoomSkeleton.svelte");
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
    await import("../svelte/lib/components/PersonAvatar.svelte");
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
