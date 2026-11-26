// "Copiar" in the forward bar (web/features/forward): the real bar, copyForward, the package and the clipboard helper.
// Only the browser's copy command is a stub, so the test reads what went to the clipboard.
process.env.TZ = "America/Sao_Paulo";
import { afterEach, expect, test } from "bun:test";
import { plugin } from "bun";
import { readFileSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";
import { Window } from "happy-dom";
import { get } from "svelte/store";
import type { ChatMessage } from "../web/app/chatTypes";
import { createApplicationCopy } from "../web/features/application/copy";
import { forwardPackage } from "../web/features/forward/model";
import {
  clickForward,
  copyForward,
  forwardSelection,
  startForward,
  stopForward,
} from "../web/features/forward/selection";

const environment = new Window({ url: "https://vibebook.test/b/aaaaaa" });
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
  name: "forward-components",
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
const { default: ForwardBar } =
  await import("../web/features/forward/ForwardBar.svelte");

const pt = createApplicationCopy("pt");
const names: Record<string, string> = {
  "ana@example.test": "Ana Souza",
  "bruno@example.test": "Bruno Lima",
};
// 14:32 and 14:35 in São Paulo, 25/11/2026.
const message = (id: number, extra: Partial<ChatMessage>): ChatMessage => ({
  id,
  text: "",
  thread: "main",
  author: "ana@example.test",
  ts: Date.UTC(2026, 10, 25, 17, 30 + id),
  ...extra,
});
const list = [
  message(2, { text: "Fechei o orçamento" }),
  message(5, {
    author: "bruno@example.test",
    text: "Segue o plano",
    files: [
      {
        id: "f1",
        name: "plano.pdf",
        type: "application/pdf",
        size: 10,
        ts: 1,
        author: "bruno@example.test",
      },
    ],
  }),
];
const expected = [
  "Encaminhado de Sala de teste",
  "> **Ana Souza** · 14:32, 25/11/2026",
  "> Fechei o orçamento",
  ">",
  "> **Bruno Lima** · 14:35, 25/11/2026",
  "> Segue o plano",
  "> Anexo: plano.pdf",
].join("\n");

// What the browser's copy command got: copyChatText selects a hidden textarea with the text, then runs "copy".
let clipboard: string | null = null,
  refuse = false;
Object.defineProperty(document, "execCommand", {
  configurable: true,
  value: (command: string) => {
    if (command !== "copy" || refuse) return false;
    const field = document.activeElement;
    clipboard = field instanceof HTMLTextAreaElement ? field.value : null;
    return true;
  },
});
Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: undefined,
});

const instances: ReturnType<typeof mount>[] = [];
afterEach(() => {
  for (const instance of instances.splice(0))
    flushSync(() => {
      void unmount(instance);
    });
  document.body.replaceChildren();
  stopForward();
  clipboard = null;
  refuse = false;
});
async function settle() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve();
    flushSync();
    await tick();
  }
}
function render() {
  const copied: { n: number; ranged: boolean }[] = [];
  const port = {
    text: (messages: readonly ChatMessage[]) =>
      forwardPackage(messages, "Sala de teste", {
        t: pt,
        name: (email: string) => names[email] ?? email,
        locale: "pt-BR",
      }),
    copied: (messages: readonly ChatMessage[], ranged: boolean) => {
      copied.push({ n: messages.length, ranged });
    },
  };
  const target = document.createElement("div");
  document.body.append(target);
  instances.push(
    mount(ForwardBar, {
      target,
      props: {
        get count() {
          return get(forwardSelection)?.ids.length ?? 0;
        },
        vb: { t: pt },
        oncancel: stopForward,
        onforward: () => {},
        oncopy: () => copyForward(port),
      },
    }),
  );
  flushSync();
  const button = target.querySelector<HTMLButtonElement>("[data-forward-copy]");
  if (!button) throw new Error("no Copiar button");
  return { target, button, copied };
}

test("Copiar puts the picked messages in the clipboard as the forward package, then leaves selection mode", async () => {
  // Picked newest first: the package still reads in thread order.
  startForward(list[1]!, "aaaaaa");
  clickForward(list, 2, false);
  const { button, copied } = render();
  expect(button.textContent?.trim()).toBe("Copiar");
  expect(button.disabled).toBe(false);
  button.click();
  await settle();
  expect(clipboard).toBe(expected);
  expect(copied).toEqual([{ n: 2, ranged: false }]);
  expect(get(forwardSelection)).toBeNull();
});

test("a refused copy shows the error and keeps selection mode", async () => {
  startForward(list[0]!, "aaaaaa");
  const { target, button, copied } = render();
  refuse = true;
  button.click();
  await settle();
  expect(clipboard).toBeNull();
  expect(copied).toEqual([]);
  expect(get(forwardSelection)?.ids).toEqual([2]);
  expect(
    target.querySelector("[data-forward-copy-error]")?.textContent?.trim(),
  ).toBe("Não deu pra copiar. Tente de novo.");
  // The next copy works and clears the error.
  refuse = false;
  button.click();
  await settle();
  expect(clipboard).toBe(
    "Encaminhado de Sala de teste\n> **Ana Souza** · 14:32, 25/11/2026\n> Fechei o orçamento",
  );
  expect(get(forwardSelection)).toBeNull();
});
