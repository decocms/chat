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
import {
  createRichPreparation,
  type HtmlTreeLoader,
} from "../svelte/features/rich-text/preparation";
import type { RichMode, RichPolicy } from "../svelte/features/rich-text/types";
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
type ContentInput = {
  text: string;
  room: Room;
  mode?: RichMode;
  policy?: RichPolicy;
};
function show(
  text: string,
  loadHtml?: HtmlTreeLoader,
  createHtmlPreparation?: typeof createRichPreparation,
) {
  const value = writable<ContentInput>({ text, room: room() });
  flushSync(() => {
    mounted.push(
      mount(Harness, {
        target: document.body,
        props: { value, loadHtml, createHtmlPreparation },
      }),
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
test("actual normal content allocates zero HTML gates/owners/AbortControllers; a raw HTML mount proves instrumentation", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(
      globalThis,
      "AbortController",
    ),
    Original = globalThis.AbortController;
  let controllers = 0,
    owners = 0,
    disposed = 0,
    loads = 0;
  Object.defineProperty(globalThis, "AbortController", {
    configurable: true,
    writable: true,
    value: class extends Original {
      constructor() {
        super();
        controllers++;
      }
    },
  });
  const create: typeof createRichPreparation = (options) => {
    owners++;
    const owner = createRichPreparation(options);
    return {
      ...owner,
      dispose() {
        disposed++;
        owner.dispose();
      },
    };
  };
  try {
    const value = show(
      "# Ordinary\n\n`<b>code</b>`",
      async () => {
        loads++;
        return full();
      },
      create,
    );
    expect(document.querySelector("h1")?.textContent).toBe("Ordinary");
    for (const [mode, text] of [
      ["human", "literal <b>human</b>"],
      ["inline", "@a"],
      ["markdown", "## Next\n\n**bold**"],
    ] as const) {
      flushSync(() => value.set({ text, room: room(), mode }));
      expect(document.querySelector("[data-rich-content]")).not.toBeNull();
      expect(document.querySelector("[data-rich-loading]")).toBeNull();
    }
    expect([owners, controllers, loads]).toEqual([0, 0, 0]);
    flushSync(() =>
      value.set({ text: "before <em>actual HTML</em>", room: room() }),
    );
    expect(document.querySelector("[data-rich-loading]")).not.toBeNull();
    expect(owners).toBe(1);
    expect(controllers).toBeGreaterThan(0);
    await settle();
    expect(document.querySelector("em")?.textContent).toBe("actual HTML");
    expect(loads).toBe(1);
    expect(disposed).toBe(1);
    flushSync(() =>
      value.set({
        text: "before <em>actual HTML</em>",
        room: { ...room(), names: { a: "New name" } },
      }),
    );
    expect(owners).toBe(1);
    expect(disposed).toBe(1);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "AbortController", descriptor);
    else Reflect.deleteProperty(globalThis, "AbortController");
  }
});
test("actual HTML to ordinary to HTML transitions reject late old imports and release each adopted gate", async () => {
  const pending = [deferred<HtmlTreeFactory>(), deferred<HtmlTreeFactory>()],
    signals: AbortSignal[] = [];
  let loads = 0,
    owners = 0,
    disposed = 0;
  const create: typeof createRichPreparation = (options) => {
    owners++;
    const owner = createRichPreparation(options);
    return {
      ...owner,
      dispose() {
        disposed++;
        owner.dispose();
      },
    };
  };
  const value = show(
    "<b>old A</b>",
    (signal) => {
      signals.push(signal);
      return pending[loads++]!.promise;
    },
    create,
  );
  await settle();
  flushSync(() => value.set({ text: "# Ordinary B", room: room() }));
  expect(signals[0]!.aborted).toBe(true);
  expect(disposed).toBe(1);
  expect(document.querySelector("h1")?.textContent).toBe("Ordinary B");
  flushSync(() => value.set({ text: "<i>fresh C</i>", room: room() }));
  await settle();
  expect(owners).toBe(2);
  pending[0]!.resolve(await full());
  await settle();
  expect(document.body.textContent).not.toContain("old A");
  expect(document.querySelector("[data-rich-loading]")).not.toBeNull();
  pending[1]!.resolve(await full());
  await settle();
  expect(document.querySelector("i")?.textContent).toBe("fresh C");
  expect(disposed).toBe(2);
});
test("same HTML changing account/room before adoption cannot pair an old parsed result with the new scope", async () => {
  const pending = [deferred<HtmlTreeFactory>(), deferred<HtmlTreeFactory>()],
    signals: AbortSignal[] = [];
  let loads = 0,
    owners = 0,
    disposed = 0;
  const create: typeof createRichPreparation = (options) => {
    owners++;
    const owner = createRichPreparation(options);
    return {
      ...owner,
      dispose() {
        disposed++;
        owner.dispose();
      },
    };
  };
  const source = "<em>same source</em>",
    value = show(
      source,
      (signal) => {
        signals.push(signal);
        return pending[loads++]!.promise;
      },
      create,
    );
  await settle();
  pending[0]!.resolve(await full());
  // Replace live props before any rendering/adoption flush of that resolution.
  value.set({ text: source, room: room("bbbbbb", "b") });
  await settle();
  expect(signals[0]!.aborted).toBe(true);
  expect(loads).toBe(2);
  expect(disposed).toBe(0);
  expect(document.querySelector("[data-rich-loading]")).not.toBeNull();
  pending[1]!.resolve(await full());
  await settle();
  expect(document.querySelector("em")?.textContent).toBe("same source");
  expect(disposed).toBe(1);
  expect(owners).toBe(1);
});
