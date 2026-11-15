// Source component tests only: no Worker, browser process, database or OAuth grant is fabricated here.
import { afterEach, expect, test } from "bun:test";
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";
import { Window } from "happy-dom";
import { writable } from "svelte/store";
import type { Room } from "../shared/room";
const environment = new Window({
  url: "https://vibebook.test/b/aaaaaa?ui=svelte",
});
// One environment boundary: Svelte sees the same Happy DOM constructors as the mounted DOM nodes.
for (const name of [
  "window",
  "document",
  "navigator",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLFormElement",
  "HTMLAnchorElement",
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
  "FormData",
  "getComputedStyle",
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
  name: "rich-preparation-components",
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
const { default: Harness } = await import("./rich-preparation-harness.svelte");
import type { HtmlTreeFactory } from "../svelte/features/rich-text/markdownTree";
const full = async () =>
  (await import("../svelte/features/rich-text/htmlTree")).createHtmlTree;
import type { HtmlTreeLoader } from "../svelte/features/rich-text/preparation";
const room = (id = "aaaaaa", me = "a"): Room => ({
  id,
  me,
  members: [me],
  book: { title: "Room", owner: me },
  messages: [],
  epics: [],
  online: [],
  suggestions: [],
  typing: {},
});
const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
  for (const instance of mounted.splice(0))
    flushSync(() => {
      void unmount(instance);
    });
  document.body.replaceChildren();
});
async function settle() {
  for (let index = 0; index < 8; index++) {
    await tick();
    await new Promise((yes) => setTimeout(yes, 0));
    flushSync();
  }
}
function show(text: string, loadHtml?: HtmlTreeLoader) {
  const value = writable({ text, room: room() });
  flushSync(() => {
    mounted.push(
      mount(Harness, { target: document.body, props: { value, loadHtml } }),
    );
  });
  return value;
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test("actual RichContent keeps ordinary Markdown first render synchronous and cold HTML resolves through the real adapter", async () => {
  let loads = 0;
  show("# Ready\n\nCode `<b>literal</b>`", async () => {
    loads++;
    return full();
  });
  expect(document.querySelector("[data-rich-content] h1")?.textContent).toBe(
    "Ready",
  );
  expect(loads).toBe(0);
  show("<details open><summary>Title</summary>\n\n**Body**\n\n</details>");
  expect(document.querySelector("[data-rich-loading]")).not.toBeNull();
  await settle();
  expect(document.querySelector("details strong")?.textContent).toBe("Body");
  expect(document.querySelector("[data-rich-loading]")).toBeNull();
});
test("actual RichContent shows bounded cold-loader failure and Retry without rendering raw HTML as literal fallback", async () => {
  let attempts = 0;
  show("before <em>safe **strong**</em> after", async () => {
    if (++attempts === 1) throw Error("not exposed");
    return full();
  });
  await settle();
  expect(document.querySelector("[data-rich-error]")).not.toBeNull();
  expect(document.body.textContent).not.toContain("not exposed");
  expect(document.body.textContent).not.toContain("<em>");
  (
    document.querySelector("[data-rich-error] button") as HTMLButtonElement
  ).click();
  await settle();
  expect(document.querySelector("em strong")?.textContent).toBe("strong");
  expect(attempts).toBe(2);
});
test("actual RichContent source/account/room replacement aborts the old loader and never paints late old source", async () => {
  const old = deferred<HtmlTreeFactory>();
  const signals: AbortSignal[] = [];
  const value = show("<b>old private source</b>", (signal) => {
    signals.push(signal);
    return old.promise;
  });
  await settle();
  flushSync(() => value.set({ text: "# New room", room: room("bbbbbb", "b") }));
  expect(signals[0]!.aborted).toBe(true);
  expect(document.querySelector("h1")?.textContent).toBe("New room");
  old.resolve(await full());
  await settle();
  expect(document.body.textContent).not.toContain("old private source");
  expect(document.querySelector("h1")?.textContent).toBe("New room");
});
test("actual RichContent disposal aborts acquisition and ignores late parser completion", async () => {
  const pending = deferred<HtmlTreeFactory>();
  let signal: AbortSignal | undefined;
  show("<b>gone</b>", (next) => {
    signal = next;
    return pending.promise;
  });
  await settle();
  const instance = mounted.pop()!;
  flushSync(() => {
    void unmount(instance);
  });
  expect(signal?.aborted).toBe(true);
  pending.resolve(await full());
  await settle();
  expect(document.body.textContent).toBe("");
});
