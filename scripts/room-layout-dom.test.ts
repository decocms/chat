// DOM ownership/identity only. Happy DOM does not prove CSS geometry or browser history.
import { afterEach, expect, test } from "bun:test";
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";
import { Window } from "happy-dom";
import { createRoomGeometry } from "../svelte/features/room-layout/geometry";
import { createRoomLayoutBrowser } from "../svelte/features/room-layout/browser";
import type {
  RoomLayoutCells,
  RoomLayoutState,
} from "../svelte/features/room-layout/types";
const environment = new Window({
  url: "https://vibebook.test/app?ui=svelte&gallery=1&probe=room-layout",
});
for (const name of [
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "localStorage",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLTextAreaElement",
  "HTMLButtonElement",
  "HTMLAnchorElement",
  "DocumentFragment",
  "Text",
  "Comment",
  "MutationObserver",
  "ResizeObserver",
  "Event",
  "InputEvent",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
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
    writable: true,
    configurable: true,
  });
}
plugin({
  name: "room-layout-source-components",
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
const { default: Fixture } =
  await import("../svelte/gallery/RoomLayoutFixture.svelte");
let cleanup: (() => Promise<void>) | null = null;
const settle = async () => {
  await Promise.resolve();
  flushSync();
  await tick();
};
afterEach(async () => {
  await cleanup?.();
  cleanup = null;
  document.body.replaceChildren();
  localStorage.removeItem("vb.room-layout-fixture.docW");
});
function button(name: string) {
  const node = [...document.querySelectorAll("button")].find(
    (node) => node.textContent?.trim() === name,
  );
  if (!node) throw Error(`Missing fixture control ${name}`);
  return node;
}
test("Board node, draft and component owner survive full/pane placement and rail updates", async () => {
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() => mount(Fixture, { target }));
  cleanup = async () => {
    await unmount(component);
  };
  await settle();
  const board = target.querySelector("[data-layout-fixture-board]"),
    draft = target.querySelector<HTMLTextAreaElement>(
      "#layout-fixture-board-draft",
    );
  expect(board).not.toBeNull();
  expect(draft).not.toBeNull();
  draft!.value = "Owned Board Unicode 🧪";
  draft!.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await settle();
  button("Board pane").click();
  await settle();
  const chat = target.querySelector("[data-room-chat]")!;
  const foreign = document.createElement("div");
  foreign.id = "kanban";
  foreign.className = "doc";
  foreign.textContent = "Untrusted duplicate legacy identity";
  chat.append(foreign);
  draft!.focus();
  draft!.setSelectionRange(3, 8);
  button("Full Board").click();
  await settle();
  expect(document.activeElement === draft).toBe(true);
  button("Sidebar rail").click();
  await settle();
  expect(document.activeElement === draft).toBe(true);
  button("Board pane").click();
  await settle();
  expect(target.querySelector("[data-layout-fixture-board]") === board).toBe(
    true,
  );
  expect(target.querySelector("#layout-fixture-board-draft") === draft).toBe(
    true,
  );
  expect(document.activeElement === draft).toBe(true);
  expect(draft!.selectionStart).toBe(3);
  expect(draft!.selectionEnd).toBe(8);
  expect(foreign.parentElement === chat).toBe(true);
  expect(draft!.value).toBe("Owned Board Unicode 🧪");
  expect(target.querySelector("[data-layout-mounts]")?.textContent).toBe("1");
});
test("native range has a real input path; detached/disposed callbacks cannot change geometry owner", async () => {
  const target = document.createElement("div");
  document.body.append(target);
  const component = flushSync(() => mount(Fixture, { target }));
  cleanup = async () => {
    await unmount(component);
  };
  await settle();
  const input = target.querySelector<HTMLInputElement>("[data-room-width]");
  expect(input?.type).toBe("range");
  expect(input?.min).toBe("260");
  expect(input?.step).toBe("1");
  if (input) {
    input.value = "260";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
  await settle();
  expect(localStorage.getItem("vb.room-layout-fixture.docW")).toBe("260");
  button("Dispose layout").click();
  await settle();
  expect(input?.disabled).toBe(true);
  const before = input?.getAttribute("max");
  if (input) {
    input.value = "999";
    input.dispatchEvent(new InputEvent("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
  }
  await settle();
  expect(input?.getAttribute("max")).toBe(before);
  expect(localStorage.getItem("vb.room-layout-fixture.docW")).toBe("260");
  window.dispatchEvent(new Event("resize"));
  await settle();
  expect(input?.getAttribute("max")).toBe(before);
  button("Dispose layout").click();
  await settle();
  expect(localStorage.getItem("vb.room-layout-fixture.docW")).toBe("260");
});

test("geometry snapshots container and visual metrics before publication, initializes synchronously and ignores unchanged width publications", () => {
  // Instrument native read boundaries; Happy DOM does not establish real
  // layout cost, first paint, CSS-animation geometry or performance savings.
  const root = document.createElement("div"),
    events: string[] = [];
  document.body.append(root);
  let width = 1440,
    height = 800,
    visualHeight = 700;
  Object.defineProperty(root, "clientWidth", {
    get() {
      events.push("width");
      return width;
    },
  });
  Object.defineProperty(root, "clientHeight", {
    get() {
      events.push("height");
      return height;
    },
  });
  const rect = root.getBoundingClientRect.bind(root);
  root.getBoundingClientRect = () => {
    events.push("rect");
    return rect();
  };
  const descriptor = Object.getOwnPropertyDescriptor(window, "visualViewport");
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: {
      get offsetTop() {
        events.push("visualOffset");
        return 0;
      },
      get height() {
        events.push("visualHeight");
        return visualHeight;
      },
      addEventListener() {},
      removeEventListener() {},
    },
  });
  const node = () => {
    const value = document.createElement("div");
    root.append(value);
    return value;
  };
  const cells: RoomLayoutCells = {
    root,
    viewport: node(),
    sidebar: node(),
    header: node(),
    peek: node(),
    attention: node(),
    chat: node(),
    composer: node(),
    documentToolbar: node(),
    document: node(),
    board: node(),
    scrim: node(),
  };
  let state: RoomLayoutState = {
    pane: "doc",
    sheet: null,
    boardFull: false,
    documentVisible: true,
    sidebarCollapsed: false,
    mobile: false,
    closingUnconfirmed: false,
    presentedSheet: null,
    draggingSheet: null,
    documentWidth: 380,
    documentMaximum: 380,
    resizing: false,
    active: true,
    animationUnavailable: false,
  };
  const queued: (() => void)[] = [];
  let publications = 0;
  const geometry = createRoomGeometry({
    cells,
    browser: {
      ...createRoomLayoutBrowser(window),
      storage: { getItem: () => "473", setItem() {} },
      enqueue: (run) => queued.push(run),
    },
    current: () => true,
    read: () => state,
    changed(patch) {
      if (
        patch.documentWidth !== undefined ||
        patch.documentMaximum !== undefined
      ) {
        publications++;
        events.push("publish");
      }
      state = { ...state, ...patch };
    },
    mobile(value) {
      state = { ...state, mobile: value };
    },
    settled() {},
  });
  try {
    expect(events.slice(0, 6)).toEqual([
      "width",
      "height",
      "rect",
      "visualOffset",
      "visualHeight",
      "publish",
    ]);
    expect(state.documentWidth).toBe(473);
    expect(state.documentMaximum).toBe(848);
    expect(publications).toBe(1);
    // Width must still be re-read even when no state patch is necessary. A
    // visual-only resize also needs viewport playback with no width publish.
    events.length = 0;
    height = 760;
    visualHeight = 600;
    window.dispatchEvent(new Event("resize"));
    expect(events).toEqual([
      "width",
      "height",
      "rect",
      "visualOffset",
      "visualHeight",
    ]);
    expect(publications).toBe(1);
    width = 1372;
    window.dispatchEvent(new Event("resize"));
    expect(state.documentWidth).toBe(473);
    expect(state.documentMaximum).toBe(780);
    expect(publications).toBe(2);
    geometry.sync(state);
    geometry.dispose();
    const before = events.length;
    for (const run of queued.splice(0)) run();
    window.dispatchEvent(new Event("resize"));
    expect(events).toHaveLength(before);
  } finally {
    geometry.dispose();
    root.remove();
    if (descriptor) Object.defineProperty(window, "visualViewport", descriptor);
    else Reflect.deleteProperty(window, "visualViewport");
  }
});
