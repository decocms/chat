import { createRoomMutations } from "../web/features/room-sidebar/session";
import { createFileChipIndex } from "../web/features/rich-text/fileIndex";
import {
  createDocumentDrafts,
  createDocumentSession,
} from "../web/features/documents/session";
import type { DocumentProps } from "../web/features/documents/types";
import { afterEach, describe, expect, test } from "bun:test";
import { plugin } from "bun";
import type { Component, ComponentProps } from "svelte";
import { get, writable } from "svelte/store";
import { readFileSync } from "node:fs";
import { compile, compileModule } from "svelte/compiler";
import { Window as HappyDOMWindow } from "happy-dom";
import type { Room } from "../web/app/roomStore";
import type { ChatProps } from "../web/app/chatTypes";
import type { CommandOutcome, RoomCommand } from "../shared/commands";
import type { PanelBridge, PanelProps } from "../web/app/panels";
import type { SidebarProps } from "../web/app/sidebar";
import { createNavigationSession } from "../web/features/navigation/session";
import {
  disposePinsSession,
  requestPinnedFiles,
  syncPinsSession,
} from "../web/features/pins/session";
import { createFilesSession } from "../web/features/files/session";
import type { FilesProps } from "../web/features/files/types";
import type { PeopleAction } from "../web/features/people/model";
import { createComposerDrafts } from "../web/features/composer/drafts";

// Compile the real components, then run their DOM events with the browser Svelte
// runtime. Run with: bun test --conditions=browser scripts/ui-panels.test.ts
// Happy DOM implements the browser surface used by Svelte, but its declarations
// carry different Event/Element brands. Adapt once at the test environment boundary;
// component props, DOM queries and event calls below use standard browser types.
const window = new HappyDOMWindow({
  url: "http://localhost/",
}) as unknown as Window & typeof globalThis;
for (const key of [
  "window",
  "document",
  "navigator",
  "location",
  "Node",
  "Element",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLButtonElement",
  "HTMLIFrameElement",
  "HTMLFormElement",
  "HTMLAnchorElement",
  "HTMLImageElement",
  "Image",
  "HTMLMediaElement",
  "Image",
  "HTMLSelectElement",
  "HTMLTextAreaElement",
  "SVGElement",
  "DocumentFragment",
  "Text",
  "Comment",
  "MutationObserver",
  "DOMRect",
  "ResizeObserver",
  "Event",
  "MouseEvent",
  "PointerEvent",
  "KeyboardEvent",
  "CustomEvent",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "localStorage",
]) {
  const value = key === "window" ? window : Reflect.get(window, key);
  Object.defineProperty(globalThis, key, {
    value:
      [
        "getComputedStyle",
        "requestAnimationFrame",
        "cancelAnimationFrame",
      ].includes(key) && typeof value === "function"
        ? value.bind(window)
        : value,
    configurable: true,
    writable: true,
  });
}
plugin({
  name: "svelte-panel-tests",
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
const { flushSync, tick, mount, unmount, createRawSnippet } =
  await import("svelte");
const { default: AccountPanel } =
  await import("../web/features/account/AccountPanel.svelte");
const { default: SuggestionPreviewHarness } =
  await import("./suggestion-preview-harness.svelte");
const { mountView, dismissDialogs } = await import("./ui-panel-mount");
const { default: People } =
  await import("../web/features/people/People.svelte");
const { default: PeopleView } = await import("./UiPanelView.svelte");
const vb: PanelBridge = {
  t: (s, vars) =>
    s.replace(/\{(\w+)\}/g, (_, key) => String(vars?.[key] ?? "")),
  ago: () => "agora",
  name: (email) => email,
  avatarVersion: () => undefined,
  locale: "en-US",
};
const fixture = (): Room => ({
  id: "r",
  me: "me@test",
  book: { title: "Room", owner: "me@test" },
  members: ["me@test", "you@test"],
  online: [],
  messages: [],
  typing: {},
  suggestions: [],
  epics: [
    {
      id: "e",
      title: "Epic",
      tasks: [
        {
          id: "t",
          title: "Original title",
          done: false,
          status: "todo",
          owner: "me@test",
        },
      ],
    },
  ],
});
const active: { destroy(): void }[] = [];
const originalFetch = globalThis.fetch;
const originalClipboardWrite = window.navigator.clipboard.writeText;
const peopleCleanups: (() => void)[] = [];
afterEach(() => {
  globalThis.fetch = originalFetch;
  window.navigator.clipboard.writeText = originalClipboardWrite;
  for (const destroy of peopleCleanups.splice(0)) destroy();
  for (const c of active.splice(0)) c.destroy();
  window.document.body.innerHTML = "";
  window.localStorage.clear();
});
async function expectInteractiveReady(target: HTMLElement) {
  for (let frame = 0; frame < 20; frame++) {
    if (
      target.querySelector('[data-interactive-state="ready"]') &&
      !target.querySelector(
        '[data-interactive-state]:not([data-interactive-state="ready"])',
      )
    )
      return;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    flushSync();
    await tick();
  }
  expect(
    target.querySelectorAll(
      '[data-interactive-state]:not([data-interactive-state="ready"])',
    ),
  ).toHaveLength(0);
  expect(
    target.querySelector('[data-interactive-state="ready"]') !== null,
  ).toBe(true);
}
// Poll actual DOM state and report identity as a boolean, avoiding huge DOM graphs.
async function expectFocusedAfterUpdates(expected: Element | null) {
  expect(expected instanceof HTMLElement).toBe(true);
  // ACK, canonical reconciliation and Svelte's scheduled focus settle separately.
  // Always cross a frame, including when checking that intervening focus stays put.
  for (let frame = 0; frame < 10; frame++) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    flushSync();
    await tick();
    if (document.activeElement === expected) break;
  }
  expect(document.activeElement === expected).toBe(true);
}
// Bits retains closed content until its exit-animation frame completes.
async function expectAlertDialogClosed() {
  for (let frame = 0; frame < 10; frame++) {
    if (!document.querySelector('[role="alertdialog"]')) break;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    flushSync();
    await tick();
  }
  expect(document.querySelector('[role="alertdialog"]') === null).toBe(true);
}

function render(
  kind: "tasks" | "files" | "reminders" | "decisions",
  room: Room,
  extra: Partial<PanelProps & FilesProps> = {},
) {
  const target = window.document.createElement("div");
  window.document.body.append(target);
  const events: RoomCommand[] = [];
  const filesSession = createFilesSession(room.id);
  const props = {
    room,
    thread: "e",
    vb,
    send: (event: RoomCommand) => {
      events.push(event);
      return true;
    },
    request: async (event: RoomCommand) => {
      events.push(event);
      return { ok: true } as const;
    },
    ...(kind === "files"
      ? {
          session: filesSession,
          onfolderchange: () => {},
          onopenfile: () => {},
        }
      : {}),
    ...extra,
  };
  const view = mountView(kind, target, props);
  active.push(view);
  flushSync();
  return {
    target,
    events,
    destroy() {
      active.splice(active.indexOf(view), 1);
      view.destroy();
    },
    update(next: Room, thread = props.thread) {
      view.update({ ...props, room: next, thread });
    },
  };
}
/** The People header's "+" opens the invite modal (portaled on document.body); open it unless it already is. */
function openInvite(target: ParentNode) {
  const toggle = target.querySelector<HTMLButtonElement>(
    "[data-invite-toggle]",
  );
  if (!toggle) return;
  toggle.click();
  flushSync();
}

function change(el: Element) {
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
  flushSync();
}
const selectTrigger = "[data-slot=select-trigger]";
/** Opens a Studio Select from its trigger and picks one option, as a mouse does. */
function choose(trigger: Element, value: string) {
  trigger.dispatchEvent(
    new window.PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerType: "mouse",
    }),
  );
  flushSync();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const list = window.document.getElementById(
    trigger.getAttribute("aria-controls") ?? "",
  );
  const option = [
    ...(list?.querySelectorAll<HTMLElement>("[data-slot=select-item]") ?? []),
  ].find((item) => item.dataset.value === value);
  if (!option) throw new Error(`Missing select option: ${value}`);
  option.dispatchEvent(
    new window.PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerType: "mouse",
    }),
  );
  flushSync();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
}
/** Opens a Studio dropdown from its trigger, as a mouse does, and returns its item named `name`. */
function menuItem(trigger: Element, name: string) {
  trigger.dispatchEvent(
    new window.PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      pointerType: "mouse",
    }),
  );
  flushSync();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  const item = [
    ...window.document.querySelectorAll<HTMLElement>("[role=menuitem]"),
  ].find((el) => el.textContent?.trim() === name);
  if (!item) throw new Error(`Missing menu item: ${name}`);
  return item;
}
/** The label a closed Studio Select shows for its committed value. */
const shown = (trigger: Element) =>
  trigger.querySelector("[data-slot=select-value]")?.textContent?.trim();

/** A field the person moved to (outside the threads list): a focus restore must not take it away. */
function otherField(target: HTMLElement) {
  const field = document.createElement("input");
  target.append(field);
  return field;
}

/** The chat's hover toolbar mounts on the first pointer in a message (web/features/chat/Message.svelte). */
function hoverMessages(target: HTMLElement) {
  for (const row of target.querySelectorAll("[data-chat-message]"))
    row.dispatchEvent(new PointerEvent("pointerenter"));
  flushSync();
}

test("a copy across messages reads as WhatsApp's; inside one message's text the browser copies (Gimenes #3955)", async () => {
  const { selectedMessageIds, transcriptText } =
    await import("../web/features/chat/clipboard");
  const root = window.document.createElement("section");
  root.innerHTML =
    '<article data-chat-message="1"><div data-message-avatar>✻</div><div data-message-head>Ana</div><div data-rich-content><p id="a">first line</p></div></article>' +
    '<article data-chat-message="2"><div data-message-head>Bia</div><div data-rich-content><p id="b">second</p></div></article>';
  window.document.body.append(root);
  const range = (from: Node, to: Node) => {
    const r = window.document.createRange();
    r.setStart(from, 0);
    r.setEnd(to, 1);
    return r as unknown as Range;
  };
  const a = root.querySelector("#a")!.firstChild!;
  const b = root.querySelector("#b")!.firstChild!;
  expect(selectedMessageIds(range(a, a), root as unknown as Element)).toBe(
    null,
  );
  expect(selectedMessageIds(range(a, b), root as unknown as Element)).toEqual([
    "1",
    "2",
  ]);
  const head = root.querySelector("[data-message-head]")!.firstChild!;
  expect(
    selectedMessageIds(range(head, a), root as unknown as Element),
  ).toEqual(["1"]);
  expect(
    transcriptText([
      { when: "14:02, 23/11/2026", who: "Ana", text: "first line\nmore " },
      { when: "14:03, 23/11/2026", who: "Bia", text: "  " },
      { when: "14:04, 23/11/2026", who: "Claude de Bia", text: "second" },
    ]),
  ).toBe(
    "[14:02, 23/11/2026] Ana: first line\nmore\n[14:04, 23/11/2026] Claude de Bia: second",
  );
  root.remove();
});

describe("room panels", () => {
  test("tasks send canonical toggles, assignment and rename without flag text entering title", () => {
    const room = fixture();
    room.epics[0].tasks[0].flags = ["review note"];
    const { target, events } = render("tasks", room);
    const checkbox = target.querySelector<HTMLElement>("[role=checkbox]")!;
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    checkbox.dispatchEvent(
      new window.MouseEvent("click", { bubbles: true, cancelable: true }),
    );
    flushSync();
    expect(checkbox.getAttribute("aria-checked")).toBe("false");
    const owner = target.querySelector("[data-owner]")!;
    expect(shown(owner)).toBe("você");
    choose(owner, "you@test");
    target.querySelector<HTMLElement>("[data-task-title]")!.click();
    flushSync();
    const edit = target.querySelector<HTMLInputElement>("[data-task-edit]")!;
    expect(edit.value).toBe("Original title");
    edit.value = "New title";
    edit.dispatchEvent(new window.Event("input", { bubbles: true }));
    edit.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    flushSync();
    expect(events).toEqual([
      { t: "task.toggle", id: "t" },
      { t: "task.assign", id: "t", owner: "you@test" },
      { t: "task.rename", id: "t", title: "New title" },
    ]);
  }, 30_000);
  test("an epic's task list shows its count and bar only once it has tasks (Gimenes #3957)", () => {
    const empty = fixture();
    empty.epics[0].tasks = [];
    expect(
      render("tasks", empty).target.querySelector("[data-task-progress]"),
    ).toBe(null);
    const one = render("tasks", fixture()).target;
    expect(
      one.querySelector("[data-task-progress]")?.getAttribute("aria-valuetext"),
    ).toBe("0/1");
  });
  test("task drafts and active edits stay in their room/thread scope", () => {
    const room = fixture();
    room.epics.push({
      id: "other",
      title: "Other epic",
      tasks: [
        { id: "other-task", title: "Other task", done: false, status: "todo" },
      ],
    });
    const { target, events, update } = render("tasks", room);
    const draft = target.querySelector<HTMLInputElement>("#newTask input")!;
    draft.value = "Draft for original epic";
    draft.dispatchEvent(new window.Event("input", { bubbles: true }));
    target.querySelector<HTMLElement>("[data-task-title]")!.click();
    flushSync();
    update({ ...room });
    expect(
      target.querySelector<HTMLInputElement>("#newTask input")?.value,
    ).toBe("Draft for original epic");
    expect(target.querySelector("[data-task-edit]")).not.toBeNull();
    update(room, "other");
    expect(
      target.querySelector<HTMLInputElement>("#newTask input")?.value,
    ).toBe("");
    expect(target.querySelector("[data-task-edit]")).toBeNull();
    target
      .querySelector("#newTask")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    expect(events).toEqual([]);
    const next = target.querySelector<HTMLInputElement>("#newTask input")!;
    next.value = "Task for other epic";
    next.dispatchEvent(new window.Event("input", { bubbles: true }));
    target
      .querySelector("#newTask")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    expect(events).toEqual([
      { t: "task.add", epic: "other", title: "Task for other epic" },
    ]);
    update({ ...room, id: "another-room" }, "other");
    expect(
      target.querySelector<HTMLInputElement>("#newTask input")?.value,
    ).toBe("");
  }, 30_000);
  test("task commands retain drafts and controls when disconnected", () => {
    const { target, events } = render("tasks", fixture(), {
      send: () => false,
    });
    const draft = target.querySelector<HTMLInputElement>("#newTask input")!;
    draft.value = "Keep this offline draft";
    draft.dispatchEvent(new window.Event("input", { bubbles: true }));
    target
      .querySelector("#newTask")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    flushSync();
    expect(draft.value).toBe("Keep this offline draft");
    expect(target.querySelector('[role="alert"]')?.textContent).toContain(
      "Não deu pra enviar agora",
    );
    const owner = target.querySelector("[data-owner]")!;
    choose(owner, "you@test");
    expect(shown(owner)).toBe("você");
    target.querySelector<HTMLElement>("[data-task-title]")!.click();
    flushSync();
    const edit = target.querySelector<HTMLInputElement>("[data-task-edit]")!;
    edit.value = "Keep this rename";
    edit.dispatchEvent(new window.Event("input", { bubbles: true }));
    edit.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();
    expect(
      target.querySelector<HTMLInputElement>("[data-task-edit]")?.value,
    ).toBe("Keep this rename");
    expect(events).toEqual([]);
  }, 30_000);
  test("task due dialog saves typed assignments and tears down before native modal handoff", async () => {
    const room = fixture();
    const { target, events, update } = render("tasks", room);
    target.querySelector<HTMLElement>("[data-due]")!.click();
    flushSync();
    await tick();
    const dialog = window.document.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    const input = dialog.querySelector<HTMLInputElement>("input")!;
    input.value = "Friday";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    dialog
      .querySelector("form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    flushSync();
    await tick();
    expect(events).toEqual([{ t: "task.assign", id: "t", due: "Friday" }]);
    expect(window.document.querySelector('[role="dialog"]')).toBeNull();
    room.epics[0].tasks[0].due = "Friday";
    update({ ...room });
    target.querySelector<HTMLElement>("[data-due]")!.click();
    flushSync();
    await tick();
    expect(
      window.document.querySelector<HTMLInputElement>('[role="dialog"] input')
        ?.value,
    ).toBe("Friday");
    dismissDialogs();
    await tick();
    expect(window.document.querySelector('[role="dialog"]')).toBeNull();
    target.querySelector<HTMLElement>("[data-due]")!.click();
    flushSync();
    await tick();
    update({ ...room, epics: [{ ...room.epics[0], tasks: [] }] });
    await tick();
    expect(window.document.querySelector('[role="dialog"]')).toBeNull();
    expect(events).toHaveLength(1);
  }, 30_000);
  test("files group versions in folders, filter and send pin events", () => {
    const room = fixture();
    room.files = [
      {
        id: "new",
        name: "docs/note.md",
        type: "text/markdown",
        author: "me@test",
        ts: 2,
        size: 40,
      },
      {
        id: "old",
        name: "docs/note.md",
        type: "text/markdown",
        author: "me@test",
        ts: 1,
        size: 20,
      },
      {
        id: "img",
        name: "photo.png",
        type: "image/png",
        author: "me@test",
        ts: 3,
        size: 100,
      },
    ];
    const { target, events } = render("files", room);
    target.querySelector<HTMLElement>("[data-fdir=docs]")!.click();
    flushSync();
    expect(target.querySelectorAll("[data-file-id]").length).toBe(1);
    expect(target.textContent).toContain("2 versões");
    target
      .querySelector<HTMLElement>('[data-file-id="new"] button[aria-pressed]')!
      .click();
    expect(events).toEqual([{ t: "pin.add", kind: "file", ref: "new" }]);
    target.querySelector<HTMLElement>("[data-fkind=img]")!.click();
    flushSync();
    expect(target.querySelectorAll("[data-file-id]").length).toBe(1);
    expect(
      target.querySelector("[data-file-id]")?.getAttribute("data-file-id"),
    ).toBe("img");
  }, 30_000);

  test("shared switch keeps default local updates and rejects them only in controlled mode", async () => {
    const Switch = (await import("../web/lib/studio/Switch.svelte")).default;
    for (const controlled of [false, true]) {
      const target = document.createElement("div");
      document.body.append(target);
      const desired: boolean[] = [];
      // Controlled callers bind a getter that keeps the canonical value and a setter that only asks for the change.
      const props = controlled
        ? {
            get checked() {
              return true;
            },
            set checked(value: boolean) {
              desired.push(value);
            },
          }
        : {
            checked: true,
            onCheckedChange: (value: boolean) => desired.push(value),
          };
      const instance = flushSync(() => mount(Switch, { target, props }));
      try {
        const control =
          target.querySelector<HTMLButtonElement>("[role=switch]")!;
        flushSync(() => control.click());
        expect(control.getAttribute("aria-checked")).toBe(String(controlled));
        expect(control.getAttribute("data-state")).toBe(
          controlled ? "checked" : "unchecked",
        );
        expect(desired).toEqual([false]);
      } finally {
        await unmount(instance);
        target.remove();
      }
    }
  }, 30_000);
  test("account row: you at a sidebar's foot (or a phone's top bar) is a link to your settings page", async () => {
    const { default: AccountRow } =
      await import("../web/features/app-navigation/AccountRow.svelte");
    const me = {
      email: "ana@example.test",
      name: "Ana",
      avatar: null,
    } as unknown as import("../shared/schemas").MeResult;
    for (const row of [true, false]) {
      const target = document.createElement("div");
      document.body.append(target);
      const instance = flushSync(() =>
        mount(AccountRow, { target, props: { me, row, current: !row } }),
      );
      try {
        const link = target.querySelector<HTMLAnchorElement>(
          "a[data-account-row]",
        );
        expect(link?.getAttribute("href")).toBe("/settings");
        // The shell follows data-nav links in place (no reload).
        expect(link?.hasAttribute("data-nav")).toBe(true);
        expect(link?.getAttribute("aria-label")).toBe("Ana");
        expect(link?.getAttribute("aria-current")).toBe(row ? null : "page");
        expect(target.textContent?.includes("Ana")).toBe(row);
        expect(target.querySelector("[data-user-menu]")).toBeNull();
      } finally {
        await unmount(instance);
        target.remove();
      }
    }
  });
  test("one avatar language: people are round beam faces, agents square marks, rooms marble tiles", async () => {
    const { default: PersonAvatar } =
      await import("../web/lib/components/PersonAvatar.svelte");
    const { default: AgentMark } =
      await import("../web/lib/components/AgentMark.svelte");
    const { default: RoomTile } =
      await import("../web/features/home/RoomTile.svelte");
    const { beam, marble } = await import("../web/lib/components/boring");
    const classes = (el: Element | null | undefined) =>
      (el?.getAttribute("class") ?? "").split(/\s+/);
    const cases: [Component<any>, Record<string, unknown>][] = [
      [PersonAvatar, { email: "ana@test.com", "data-avatar": "person" }],
      [
        PersonAvatar,
        { email: "ana@test.com", size: "2xs", "data-avatar": "person" },
      ],
      [AgentMark, { mark: "✻" }],
      [AgentMark, { via: "codex", size: "2xs", class: "text-success" }],
      [AgentMark, { via: "gemini-3-pro", size: "xs", tint: true }],
      [
        RoomTile,
        {
          room: {
            id: "r1",
            title: "Room",
            last_human_id: 0,
            last_agent_id: 0,
            read_id: 0,
          },
          lang: "en",
          now: 0,
          onnavigate: () => {},
        },
      ],
    ];
    const seen: Record<string, Element[]> = { person: [], agent: [] };
    let cover: Element | null = null;
    for (const [component, props] of cases) {
      const target = document.createElement("div");
      document.body.append(target);
      const instance = flushSync(() => mount(component, { target, props }));
      try {
        for (const el of target.querySelectorAll("[data-avatar]"))
          seen[el.getAttribute("data-avatar")!]!.push(
            el.cloneNode(true) as Element,
          );
        if (component === RoomTile)
          cover = target
            .querySelector("[data-room-cover]")
            ?.cloneNode(true) as Element;
      } finally {
        await unmount(instance);
        target.remove();
      }
    }
    expect(seen.person).toHaveLength(2);
    expect(seen.agent).toHaveLength(3);
    for (const person of seen.person) {
      expect(classes(person)).toContain("rounded-full");
      expect(person.getAttribute("aria-hidden")).toBe("true");
      // No picture: the face the email draws (whatever label is beside it), never initials.
      expect(person.querySelector("svg > rect")?.getAttribute("fill")).toBe(
        beam("ana@test.com").background,
      );
      expect(person.textContent?.trim()).toBe("");
    }
    expect(
      seen.person.map((el) => classes(el).filter((c) => /^size-/.test(c))),
    ).toEqual([["size-6"], ["size-4"]]);
    for (const agent of seen.agent) {
      expect(classes(agent)).not.toContain("rounded-full");
      expect(agent.getAttribute("aria-hidden")).toBe("true");
    }
    // The radius follows the box, so a 16px mark never gets the 32px radius.
    expect(
      seen.agent.map((agent) =>
        classes(agent).filter((c) => /^(size|rounded)-/.test(c)),
      ),
    ).toEqual([
      ["size-8", "rounded-[0.625rem]"],
      ["size-4", "rounded-sm"],
      ["size-6", "rounded-lg"],
    ]);
    expect(seen.agent.map((agent) => agent.textContent?.trim())).toEqual([
      "✻",
      "◎",
      "✦",
    ]);
    expect(classes(seen.agent[1])).toContain("text-success");
    // A tinted mark paints the provider's tile; an untinted one stays muted.
    expect(seen.agent[0]!.querySelector("[data-agent-tile]")).toBeNull();
    expect(
      classes(seen.agent[2]!.querySelector('[data-agent-tile="gemini"]')),
    ).toContain("bg-agent-gemini");
    // A room without an icon is the marble its title draws.
    expect(cover?.getAttribute("data-room-cover")).toBe("marble");
    expect(cover?.querySelector("svg > rect")?.getAttribute("fill")).toBe(
      marble("Room").background,
    );
  }, 30_000);
  test("a rail room is marked current by a bar on the rail's edge, never a ring, and explains itself in a tooltip", async () => {
    const RailRoom = (
      await import("../web/features/app-navigation/RailRoom.svelte")
    ).default;
    const summary = (extra: Record<string, unknown> = {}) =>
      ({
        id: "r1",
        title: "Room",
        last_human_id: 0,
        last_agent_id: 0,
        read_id: 0,
        ...extra,
      }) as never;
    const cases: [string, Record<string, unknown>, boolean][] = [
      ["idle", {}, false],
      ["human", { last_human_id: 5 }, false],
      ["agent", { last_agent_id: 5 }, false],
      ["selected", { last_human_id: 5 }, true],
    ];
    for (const [label, extra, selected] of cases) {
      const target = document.createElement("div");
      document.body.append(target);
      const instance = flushSync(() =>
        mount(RailRoom, {
          target,
          props: {
            room: summary(extra),
            lang: "en",
            now: 0,
            selected,
            onnavigate: () => {},
          },
        }),
      );
      try {
        const pill = target.querySelector("[data-rail-pill]");
        const pillClass = pill?.getAttribute("class")?.split(/\s+/) ?? [];
        if (label === "idle") expect(pill, label).toBeNull();
        else expect(pill?.getAttribute("data-rail-pill"), label).toBe(label);
        // The current room: the tall bar. New messages: a short mark in the same place, strong for people, muted for agents.
        if (selected) expect(pillClass, label).toContain("md:w-[3px]");
        if (label === "human") expect(pillClass).toContain("bg-foreground");
        if (label === "agent")
          expect(pillClass).toContain("bg-muted-foreground");
        if (label === "human" || label === "agent")
          expect(pillClass, label).toContain("md:h-2");
        const link = target.querySelector("a")!;
        // A styled tooltip (bits trigger), not the slow native title.
        expect(link.hasAttribute("title"), label).toBe(false);
        expect(link.getAttribute("data-state"), label).toBe("closed");
        expect(link.className, label).not.toMatch(/(^| )ring/);
        // In the rail, new messages are the edge mark only: no number and no dot on the avatar.
        expect(
          target.querySelector('[data-room-badge^="unread"]'),
          label,
        ).toBeNull();
      } finally {
        await unmount(instance);
        target.remove();
      }
    }
  }, 30_000);
  test("a rail room without an icon draws the marble its title makes; with an icon it shows the icon", async () => {
    const RailRoom = (
      await import("../web/features/app-navigation/RailRoom.svelte")
    ).default;
    const { marble } = await import("../web/lib/components/boring");
    const cases = [
      { title: "Casa da Praia", icon: undefined, tint: "purple" },
      { title: "Design System", icon: undefined, tint: null },
      { title: "Casa da Praia", icon: 3, tint: "purple" },
    ];
    for (const { title, icon, tint } of cases) {
      const target = document.createElement("div");
      document.body.append(target);
      const instance = flushSync(() =>
        mount(RailRoom, {
          target,
          props: {
            room: {
              id: "r1",
              title,
              icon,
              tint,
              last_human_id: 0,
              last_agent_id: 0,
              read_id: 0,
            } as never,
            lang: "en",
            now: 0,
            onnavigate: () => {},
          },
        }),
      );
      try {
        const label = `${title} icon=${icon ?? "none"}`;
        const cover = target.querySelector<HTMLElement>("[data-room-cover]")!;
        if (icon) {
          expect(cover.getAttribute("data-room-cover"), label).toBe("icon");
          expect(cover.querySelector("svg rect"), label).toBeNull();
        } else {
          expect(cover.getAttribute("data-room-cover"), label).toBe("marble");
          expect(
            cover.querySelector("svg > rect")?.getAttribute("fill"),
            label,
          ).toBe(marble(title).background);
        }
        // The tint is the rail group's backdrop, never the tile.
        const link = target.querySelector<HTMLElement>("a")!;
        expect(link.getAttribute("data-room-tint"), label).toBe(tint ?? null);
        expect(link.className.split(/\s+/), label).not.toContain("room-tint");
      } finally {
        await unmount(instance);
        target.remove();
      }
    }
  }, 30_000);
  test("a home-grid room without an icon draws its marble and its badges keep their own background", async () => {
    const RoomTile = (await import("../web/features/home/RoomTile.svelte"))
      .default;
    const { marble } = await import("../web/lib/components/boring");
    const target = document.createElement("div");
    document.body.append(target);
    const instance = flushSync(() =>
      mount(RoomTile, {
        target,
        props: {
          room: {
            id: "r1",
            title: "Design System",
            tint: "purple",
            busy_until: 10,
            sandboxes_running: 1,
            last_human_id: 2,
            last_agent_id: 0,
            read_id: 0,
          } as never,
          waits: [{ ref: "m1" }, { ref: "t2" }],
          lang: "en",
          now: 0,
          onnavigate: () => {},
        },
      }),
    );
    try {
      // Three signals: the one number (asks and reviews together), the new-messages dot, the ✻. The cloud is words only.
      expect(target.querySelector("[data-room-badge=cloud]")).toBeNull();
      expect(target.querySelector("[data-count]")?.textContent).toBe("2");
      expect(
        target.querySelector('[data-room-badge="unread-human"]'),
      ).not.toBeNull();
      expect(target.querySelector("a")!.getAttribute("aria-label")).toContain(
        "cloud sandbox running",
      );
      const mark = target.querySelector<HTMLElement>("[data-room-cover]")!;
      expect(mark.getAttribute("data-room-cover")).toBe("marble");
      expect(mark.querySelector("svg > rect")?.getAttribute("fill")).toBe(
        marble("Design System").background,
      );
      // The tint colors only a room with an icon, never the marble.
      expect(mark.className.split(/\s+/)).not.toContain("bg-secondary");
      expect(target.querySelector("a")!.hasAttribute("data-room-tint")).toBe(
        false,
      );
      const badges = [
        ...target
          .querySelector("[data-room-avatar]")!
          .querySelectorAll<HTMLElement>("[role=img]"),
      ];
      expect(badges).toHaveLength(3);
      // On the page, the shared RoomAvatar rings its badges in the page colour, never the rail's.
      for (const badge of badges) {
        expect(badge.className, badge.textContent ?? "").toMatch(
          /(bg|ring)-background/,
        );
        expect(badge.className, badge.textContent ?? "").not.toContain(
          "sidebar",
        );
      }
    } finally {
      await unmount(instance);
      target.remove();
    }
  }, 30_000);
  test("decisions render escaped canonical rows in reverse order and preserve empty state", () => {
    const room = fixture();
    room.decisions = [
      {
        id: 7,
        kind: "decision",
        text: "<script>bad()</script>",
        who: "<who>",
        ts: 1,
      },
      { id: 8, kind: "approval", text: "approved", who: "you@test", ts: 2 },
    ];
    const { target, update } = render("decisions", room);
    expect(
      Array.from(target.querySelectorAll("[data-decision-id]"), (el) =>
        el.getAttribute("data-decision-id"),
      ),
    ).toEqual(["8", "7"]);
    expect(target.querySelector("script")).toBeNull();
    expect(target.textContent).toContain("<script>bad()</script>");
    expect(target.textContent).toContain("<who>");
    expect(target.textContent).toContain("✓ aprovado");
    expect(target.textContent).toContain("decidido");
    update({ ...room, decisions: [] });
    expect(target.querySelector("[data-ddel]")).toBeNull();
    expect(target.textContent).toContain("Nenhuma decisão ainda");
  });
  test("decision deletion requires confirmation, restores cancellation focus and waits for canonical removal", async () => {
    const room = fixture();
    room.decisions = [
      {
        id: 7,
        kind: "decision",
        text: "Keep this until canonical removal",
        who: "me@test",
        ts: 1,
      },
    ];
    let answer!: (value: { ok: true }) => void;
    const response = new Promise<{ ok: true }>((resolve) => {
      answer = resolve;
    });
    const events: RoomCommand[] = [];
    const { target, update } = render("decisions", room, {
      request: (command) => {
        events.push(command);
        return response;
      },
      send: () => {
        throw new Error("Decisions must use correlated request");
      },
    });
    const trigger = target.querySelector<HTMLButtonElement>("[data-ddel]")!;
    trigger.focus();
    trigger.click();
    flushSync();
    await tick();
    let dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!;
    const cancel = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.includes("Cancelar"))!;
    expect(document.activeElement === cancel).toBe(true);
    expect(events).toEqual([]);
    cancel.click();
    flushSync();
    await tick();
    expect(document.activeElement === trigger).toBe(true);
    await expectAlertDialogClosed();
    trigger.click();
    flushSync();
    await tick();
    dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!;
    const confirm = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.includes("Apagar registro"))!;
    confirm.click();
    flushSync();
    await tick();
    expect(events).toEqual([{ t: "decision.del", id: 7 }]);
    expect(trigger.disabled).toBe(true);
    expect(confirm.disabled).toBe(true);
    answer({ ok: true });
    await tick();
    flushSync();
    expect(target.querySelector("[data-decision-id]")).not.toBeNull();
    expect(document.querySelector('[role="alertdialog"]')).not.toBeNull();
    update({ ...room, decisions: [] });
    await tick();
    flushSync();
    await expectAlertDialogClosed();
    expect(document.activeElement).toBe(
      target.querySelector("[data-decisions-panel]"),
    );
  }, 30_000);
  test("decision failure remains visible for retry; canonical removal and room changes clear issues", async () => {
    const room = fixture();
    room.decisions = [
      { id: 7, kind: "decision", text: "record", who: "me@test", ts: 1 },
    ];
    let answer!: (value: { ok: false; error: string }) => void;
    const response = new Promise<{ ok: false; error: string }>((resolve) => {
      answer = resolve;
    });
    const { target, update } = render("decisions", room, {
      request: () => response,
    });
    target.querySelector<HTMLButtonElement>("[data-ddel]")!.click();
    flushSync();
    await tick();
    const confirm = Array.from(
      document
        .querySelector('[role="alertdialog"]')!
        .querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.includes("Apagar registro"))!;
    confirm.click();
    flushSync();
    await tick();
    answer({ ok: false, error: "forbidden" });
    await tick();
    flushSync();
    expect(
      document.querySelector('[role="alertdialog"]')!.textContent,
    ).toContain("forbidden");
    expect(confirm.disabled).toBe(false);
    expect(target.querySelector("[data-decision-id]")).not.toBeNull();
    update({ ...room, decisions: [] });
    await tick();
    flushSync();
    await expectAlertDialogClosed();
    update({ ...room, id: "other-room" });
    await tick();
    flushSync();
    expect(target.textContent).not.toContain("forbidden");
    expect(
      target.querySelector<HTMLButtonElement>("[data-ddel]")!.disabled,
    ).toBe(false);
  }, 30_000);
  for (const transition of ["remote removal", "room switch"] as const) {
    test(`decision pending dialog closes on ${transition} and ignores late rejection`, async () => {
      const room = fixture();
      room.decisions = [
        { id: 7, kind: "decision", text: "record", who: "me@test", ts: 1 },
      ];
      let answer!: (value: { ok: false; error: string }) => void;
      const response = new Promise<{ ok: false; error: string }>((resolve) => {
        answer = resolve;
      });
      const { target, update } = render("decisions", room, {
        request: () => response,
      });
      target.querySelector<HTMLButtonElement>("[data-ddel]")!.click();
      flushSync();
      await tick();
      const confirm = Array.from(
        document
          .querySelector('[role="alertdialog"]')!
          .querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent?.includes("Apagar registro"))!;
      confirm.click();
      flushSync();
      await tick();
      update(
        transition === "remote removal"
          ? { ...room, decisions: [] }
          : { ...room, id: "other" },
      );
      await tick();
      flushSync();
      await expectAlertDialogClosed();
      answer({ ok: false, error: "late failure" });
      await tick();
      flushSync();
      expect(target.textContent).not.toContain("late failure");
      if (transition === "room switch")
        expect(
          target.querySelector<HTMLButtonElement>("[data-ddel]")!.disabled,
        ).toBe(false);
    }, 30_000);
  }
  test("reminder disclosure and controlled switches wait for server acknowledgement", async () => {
    const room = fixture();
    room.reminders = [
      {
        id: "rem",
        name: "daily",
        text: "Every Monday at 9am UTC: report",
        owner: "me@test",
        enabled: true,
      },
    ];
    let answer!: (value: { ok: false; error: string }) => void;
    const pending = new Promise<{ ok: false; error: string }>((resolve) => {
      answer = resolve;
    });
    const { target, update } = render("reminders", room, {
      request: () => pending,
    });
    const disclosure =
      target.querySelector<HTMLButtonElement>("[data-rem-open]")!;
    expect(disclosure.tagName).toBe("BUTTON");
    expect(disclosure.type).toBe("button");
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    disclosure.click();
    flushSync();
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    expect(target.querySelector<HTMLPreElement>("pre")?.hidden).toBe(false);
    const enabled = target.querySelector<HTMLButtonElement>(
      "[data-rem-on][role=switch]",
    )!;
    expect(enabled.getAttribute("aria-checked")).toBe("true");
    enabled.click();
    flushSync();
    expect(enabled.getAttribute("aria-checked")).toBe("true");
    expect(enabled.disabled).toBe(true);
    answer({ ok: false, error: "offline" });
    await tick();
    flushSync();
    expect(enabled.getAttribute("aria-checked")).toBe("true");
    expect(enabled.disabled).toBe(false);
    expect(target.textContent).toContain("sem conexão");
    update({
      ...room,
      reminders: room.reminders.map((r) => ({ ...r, enabled: false })),
    });
    expect(enabled.getAttribute("aria-checked")).toBe("false");
  }, 30_000);
  test("reminder deletion requires its native alert dialog and restores focus after cancellation", async () => {
    const room = fixture();
    room.reminders = [
      {
        id: "rem",
        name: "daily",
        text: "Every Monday at 9am UTC: report",
        owner: "me@test",
        enabled: true,
      },
    ];
    const { target, events } = render("reminders", room);
    const trigger = target.querySelector<HTMLButtonElement>("[data-rem-del]")!;
    trigger.focus();
    trigger.click();
    flushSync();
    await tick();
    expect(events).toEqual([]);
    const dialog = document.querySelector<HTMLElement>('[role="alertdialog"]')!;
    expect(dialog).not.toBeNull();
    const cancel = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("Cancelar"))!;
    expect(document.activeElement === cancel).toBe(true);
    cancel.click();
    flushSync();
    await tick();
    expect(events).toEqual([]);
    await expectAlertDialogClosed();
    expect(document.activeElement === trigger).toBe(true);
    trigger.click();
    flushSync();
    await tick();
    const confirm = Array.from(
      document
        .querySelector('[role="alertdialog"]')!
        .querySelectorAll<HTMLButtonElement>("button"),
    ).find((button) => button.textContent?.includes("Apagar lembrete"))!;
    confirm.click();
    flushSync();
    await tick();
    expect(events).toEqual([{ t: "reminder.delete", id: "rem" }]);
  }, 30_000);
  test("late upload completion cannot close the draft in another room", async () => {
    let finish!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      finish = resolve;
    });
    globalThis.fetch = Object.assign(async () => response, {
      preconnect: originalFetch.preconnect,
    });
    const { target, update } = render("reminders", fixture());
    target.querySelector<HTMLElement>("#remNew")!.click();
    flushSync();
    for (const [selector, value] of [
      ["input[name=name]", "daily"],
      ["textarea", "Every Monday at 9am UTC: old"],
    ]) {
      const input = target.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new window.Event("input", { bubbles: true }));
    }
    target
      .querySelector("form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    flushSync();
    update({ ...fixture(), id: "other" });
    target.querySelector<HTMLElement>("#remNew")!.click();
    flushSync();
    const text = target.querySelector<HTMLTextAreaElement>("textarea")!;
    text.value = "new room draft";
    text.dispatchEvent(new window.Event("input", { bubbles: true }));
    finish(
      new Response(
        JSON.stringify({
          id: "file",
          name: "reminders/daily.md",
          type: "text/markdown",
          size: 12,
          author: "me@test",
          ts: 1,
          reminder: { ok: true },
        }),
        { status: 200 },
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "new room draft",
    );
  }, 30_000);
  test("files preserve exact viewer selection, pin ACK errors and disposed callbacks", async () => {
    const room = fixture();
    const file = {
      id: "v1",
      name: "docs/report.md",
      type: "text/markdown",
      author: "me@test",
      ts: 1,
      size: 20,
    };
    room.files = [file];
    room.filesAll = true;
    const opened: string[] = [];
    const session = createFilesSession(room.id);
    let rejectPin = true;
    let fileRequests = 0;
    const { target, update, destroy } = render("files", room, {
      session,
      onopenfile: (file) => opened.push(file.id),
      request: async () => {
        fileRequests++;
        return rejectPin ? { ok: false, error: "offline" } : { ok: true };
      },
    });
    target.querySelector<HTMLElement>('[data-fdir="docs"]')!.click();
    flushSync();
    const oldTile = target.querySelector<HTMLElement>(
      '[data-file-id="v1"] button',
    )!;
    oldTile.click();
    expect(opened).toEqual(["v1"]);
    target
      .querySelector<HTMLElement>('[data-file-id="v1"] button[aria-pressed]')!
      .click();
    await tick();
    flushSync();
    expect(target.querySelector('[role="alert"]')?.textContent).toContain(
      "offline",
    );
    expect(target.textContent).toContain("docs/");
    rejectPin = false;
    target
      .querySelector<HTMLElement>('[data-file-id="v1"] button[aria-pressed]')!
      .click();
    await tick();
    flushSync();
    expect(
      target.querySelector('[data-file-id] button[aria-pressed="true"]'),
    ).toBeNull();
    // Finish the first mutation while its control is still mounted and enabled.
    const pins = [{ id: "p", kind: "file" as const, ref: "v1" }];
    update({ ...room, pins });
    const oldPin = target.querySelector<HTMLButtonElement>(
      '[data-file-id="v1"] button[aria-pressed]',
    )!;
    expect(oldPin.disabled).toBe(false);
    const latest = { ...file, id: "v2", ts: 2 };
    update({
      ...room,
      files: [latest, file],
      pins,
    });
    expect(target.querySelector('[data-file-id="v2"]')).not.toBeNull();
    expect(oldTile.isConnected).toBe(false);
    expect(oldPin.isConnected).toBe(false);
    const beforeStaleRequests = fileRequests;
    oldTile.click();
    oldPin.click();
    await tick();
    flushSync();
    expect(opened).toEqual(["v1"]);
    expect(fileRequests).toBe(beforeStaleRequests);
    const latestTile = target.querySelector<HTMLElement>(
      '[data-file-id="v2"] button',
    )!;
    latestTile.click();
    expect(opened.at(-1)).toBe("v2");
    const beforeDestroy = [...opened];
    destroy();
    latestTile.click();
    expect(opened).toEqual(beforeDestroy);
  });
  test("reminders preserve draft across a server reminder update", () => {
    const room = fixture();
    room.reminders = [
      {
        id: "rem",
        name: "daily",
        text: "Every day at 9",
        owner: "me@test",
        enabled: true,
      },
    ];
    const { target, events, update } = render("reminders", room);
    target.querySelector<HTMLElement>("#remNew")!.click();
    flushSync();
    const text = target.querySelector<HTMLTextAreaElement>("textarea")!;
    text.value = "Every Monday at 10: report";
    text.dispatchEvent(new window.Event("input", { bubbles: true }));
    target.querySelector<HTMLButtonElement>("[data-rem-on]")!.click();
    flushSync();
    expect(events).toEqual([{ t: "reminder.enable", id: "rem", on: false }]);
    update({
      ...room,
      reminders: room.reminders?.map((r) => ({ ...r, enabled: false })),
    });
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Every Monday at 10: report",
    );
  }, 30_000);
  test("reminder upload displays typed schedule and HTTP errors without losing draft", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let status = 200;
    globalThis.fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
        calls.push({ url: String(input), init });
        return new Response(
          JSON.stringify(
            status === 200
              ? {
                  id: "upload",
                  name: "reminders/daily.md",
                  type: "text/markdown",
                  size: 30,
                  author: "me@test",
                  ts: 1,
                  reminder: { ok: false, error: "Schedule needs a time" },
                }
              : { error: "Upload rejected" },
          ),
          { status },
        );
      },
      { preconnect: originalFetch.preconnect },
    );
    const { target } = render("reminders", fixture());
    target.querySelector<HTMLElement>("#remNew")!.click();
    flushSync();
    const name = target.querySelector<HTMLInputElement>("input[name=name]")!;
    name.value = "daily.md";
    name.dispatchEvent(new window.Event("input", { bubbles: true }));
    const text = target.querySelector<HTMLTextAreaElement>("textarea")!;
    text.value = "Every Monday: report";
    text.dispatchEvent(new window.Event("input", { bubbles: true }));
    target
      .querySelector("form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    expect(calls[0].url).toBe("/api/books/r/files");
    const sent = new Headers(calls[0].init?.headers);
    expect(sent.get("content-type")).toBe("text/markdown");
    expect(sent.get("x-filename")).toBe("reminders%2Fdaily.md");
    expect(target.querySelector("#remErr")?.textContent).toContain(
      "Schedule needs a time",
    );
    expect(
      target.querySelector<HTMLInputElement>("input[name=name]")?.readOnly,
    ).toBe(true);
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Every Monday: report",
    );
    status = 400;
    target
      .querySelector("form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    expect(target.querySelector("#remErr")?.textContent).toBe(
      "Upload rejected",
    );
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "Every Monday: report",
    );
  }, 30_000);
});

describe("chat", () => {
  const message = (
    id: number,
    text: string,
  ): import("../web/app/chatTypes").ChatMessage => ({
    id,
    text,
    thread: "e",
    author: "you@test",
    kind: "agent",
    ts: id * 1000,
  });
  const bridge = (
    overrides: Partial<import("../web/app/chatTypes").ChatBridge> = {},
  ): import("../web/app/chatTypes").ChatBridge => ({
    t: vb.t,
    name: vb.name,
    avatarVersion: vb.avatarVersion,
    ago: vb.ago,
    hhmm: () => "09:00",
    waiting: () => false,
    ...overrides,
  });
  function renderChat(room: Room, extra: Partial<ChatProps> = {}) {
    const target = window.document.createElement("div");
    window.document.body.append(target);
    const props: ChatProps = {
      room,
      thread: "e",
      list: room.messages,
      more: false,
      replyCount: 0,
      vb: bridge(),
      actions: {
        request: async (): Promise<CommandOutcome> => ({ ok: true }),
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
      },
      onloadolder: () => {},
      ...extra,
    };
    const view = mountView("chat", target, props);
    active.push(view);
    return {
      target,
      update(next: Room, vb = props.vb) {
        view.update({ ...props, room: next, list: next.messages, vb });
      },
    };
  }
  test("production endcard shows requested corrections without rewriting verified or archived state", async () => {
    const room = fixture();
    room.epics = [
      {
        id: "e",
        title: "Deployed",
        tasks: [],
        prod: { stage: "verified", at: 1000, note: "Verified deployment" },
      },
    ];
    room.messages = [
      { ...message(2, "please change it"), author: room.me, kind: null },
    ];
    const h = renderChat(room);
    flushSync();
    expect(
      h.target.querySelector("[data-chat-production]")?.textContent,
    ).toContain("🚀↻");
    expect(
      h.target.querySelector("[data-chat-production]")?.textContent,
    ).toContain("correções em andamento");
    expect(
      h.target.querySelector("[data-chat-production]")?.textContent,
    ).not.toContain("Verified deployment");
    const archived = {
      ...room,
      epics: [{ ...room.epics[0]!, archived: true }],
    };
    h.update(archived);
    await tick();
    flushSync();
    expect(h.target.querySelector("[data-chat-end]")?.textContent).toContain(
      "Agent fez",
    );
    expect(
      h.target.querySelector("[data-chat-production]")?.textContent,
    ).toContain("✓✓");
    expect(
      h.target.querySelector("[data-chat-production]")?.textContent,
    ).toContain("Verified deployment");
    expect(
      h.target.querySelector("[data-chat-production]")?.textContent,
    ).not.toContain("correções em andamento");
  });
  test("older bare file chips request one canonical index and replace localized fallback with the exact escaped filename", async () => {
    const url = "https://vibebook.test/api/books/abc123/files/aa11";
    const room: Room = {
      ...fixture(),
      id: "abc123",
      filesAll: false,
      files: [],
      messages: [message(91, url), message(92, url)],
    };
    const sent: RoomCommand[] = [],
      opened: string[] = [];
    const owner = createFileChipIndex(
      room.id,
      room.me,
      () => true,
      async (command) => {
        sent.push(command);
        return { ok: true };
      },
    );
    owner.sync(room);
    const actions: ChatProps["actions"] = {
      request: async () => ({ ok: true }),
      draftReply: () => {},
      reply: () => {},
      navigate: () => {},
      openFile: (file) => opened.push(file.id),
      ensureFileIndex: () => {
        void owner.load();
      },
    };
    const { target, update } = renderChat(room, {
      vb: bridge({
        pageUrl: "https://vibebook.test/b/abc123",
        t: (text) => (text === "arquivo" ? "file" : text),
      }),
      actions,
    });
    await tick();
    flushSync();
    const chip = () =>
      target.querySelector<HTMLAnchorElement>('#m91 [data-rich-link="file"]')!;
    expect(chip().textContent).toContain("file");
    expect(chip().title).toBe("file");
    expect(sent).toEqual([{ t: "files.get" }]);
    const file = {
      id: "aa11",
      name: "<b>Older report</b>.md",
      type: "text/markdown",
      author: "you@test",
      ts: 1,
      size: 12,
    };
    const full = {
      ...room,
      filesAll: true,
      files: [{ ...file, id: "bb22", ts: 2 }, file],
    };
    owner.sync(full);
    update(full);
    await tick();
    flushSync();
    expect(chip().textContent).toContain(file.name);
    expect(chip().textContent).toContain("v1");
    expect(chip().querySelector("b")).toBeNull();
    expect(chip().getAttribute("href")).toBe("/api/books/abc123/files/aa11");
    chip().click();
    expect(opened).toEqual(["aa11"]);
    expect(sent).toHaveLength(1);
    owner.dispose();
  }, 30_000);
  test("fenced code is a keyboard focus target without changing its canonical text", () => {
    const code = "const wide = " + "x".repeat(240) + ";";
    const room = {
      ...fixture(),
      messages: [message(1, "```js\n" + code + "\n```")],
    };
    const { target } = renderChat(room);
    const pre = target.querySelector<HTMLPreElement>(
      "#m1 [data-rich-content] pre",
    );
    expect(pre).not.toBeNull();
    expect(pre!.tabIndex).toBe(0);
    expect(pre!.textContent?.trim()).toBe(code);
    pre!.focus();
    expect(document.activeElement).toBe(pre);
    expect(pre!.classList.contains("focus-visible:outline-ring")).toBe(true);
  });
  test("rich content preserves safe semantics and exact direct actions without HTML hooks", () => {
    const file = {
      id: "aa11",
      name: "report.html",
      type: "text/html",
      author: "you@test",
      size: 10,
      ts: 1,
    };
    const room = {
      ...fixture(),
      id: "abc123",
      files: [file],
      messages: [
        message(
          1,
          '<details open><summary>More</summary>\n\n**Body** @AI :fire: [message](#m12) [thread](#eabc) [file](/api/books/abc123/files/aa11) [external](https://example.test)\n\n</details>\n\n<div id="m99" class="vcard" data-cardbtn="evil" onclick="evil()"><b>safe</b></div><script>evil()</script>',
        ),
      ],
    };
    const navigated: number[] = [],
      threads: string[] = [],
      files: string[] = [];
    const { target } = renderChat(room, {
      vb: bridge({ pageUrl: "https://example.test/b/abc123" }),
      actions: {
        request: async (): Promise<CommandOutcome> => ({ ok: true }),
        draftReply: () => {},
        reply: () => {},
        navigate: (id) => navigated.push(id),
        openFile: (attachment) => files.push(attachment.id),
        navigateRich: (target) => threads.push(target.id || ""),
      },
    });
    const body = target.querySelector("#m1 [data-rich-content]")!;
    expect(body.querySelector("details[open] summary")?.textContent).toBe(
      "More",
    );
    expect(body.querySelector("strong")?.textContent).toBe("Body");
    expect(body.querySelector('[data-rich-mention="ai"]')?.textContent).toBe(
      "@AI",
    );
    expect(body.textContent).toContain("🔥");
    expect(
      body.querySelector("script,[onclick],[data-cardbtn],.vcard,#m99") ===
        null,
    ).toBe(true);
    body
      .querySelector<HTMLAnchorElement>('[data-rich-link="message"]')!
      .click();
    body.querySelector<HTMLAnchorElement>('[data-rich-link="thread"]')!.click();
    body.querySelector<HTMLAnchorElement>('[data-rich-link="file"]')!.click();
    expect(navigated).toEqual([12]);
    expect(threads).toEqual(["abc"]);
    expect(files).toEqual(["aa11"]);
    const external = body.querySelector<HTMLAnchorElement>(
      'a[href="https://example.test"]',
    )!;
    expect(external.target).toBe("_blank");
    expect(external.rel).toContain("noopener");
  }, 30_000);
  test("live cards expose four-series legend/axis/tooltips, Field delta and primary links", async () => {
    const card = {
      root: "c",
      elements: {
        c: { type: "Card", children: ["v", "fields", "actions"] },
        v: {
          type: "Chart",
          props: {
            title: "Live metrics",
            kind: "line",
            labels: ["A", "B", "C"],
            series: [
              { name: "Revenue", values: [0, 40, 80] },
              { name: "Cost", values: [-20, 10, 0] },
              { name: "<img src=x>", values: [5, 10, 20] },
              { name: "Fourth", values: [2, 1, 0] },
            ],
          },
        },
        fields: { type: "Fields", children: ["f"] },
        f: {
          type: "Field",
          props: {
            label: "Metric",
            value: "4",
            delta: "-3%",
            good: "down",
            trend: "Safe <b>trend</b>",
          },
        },
        actions: { type: "Actions", children: ["link"] },
        link: {
          type: "LinkButton",
          props: {
            label: "Primary external",
            url: "https://example.test/",
            style: "primary",
          },
        },
      },
    };
    const { target } = renderChat({
      ...fixture(),
      id: "abc123",
      messages: [{ ...message(331, "Live card"), card: JSON.stringify(card) }],
    });
    await expectInteractiveReady(target);
    expect(
      target.querySelectorAll("[data-card-chart-legend] > span"),
    ).toHaveLength(4);
    expect(
      [...target.querySelectorAll("[data-card-chart-axis] span")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["80", "30", "-20"]);
    expect(target.querySelectorAll("[data-card-chart] polyline")).toHaveLength(
      4,
    );
    expect(
      target.querySelectorAll("[data-card-chart] rect title"),
    ).toHaveLength(3);
    expect(target.querySelector("[data-card-chart] img")).toBe(null);
    expect(target.textContent).toContain("Safe <b>trend</b>");
    expect(target.querySelector("dd")?.textContent).toContain("-3%");
    const link = target.querySelector<HTMLAnchorElement>(
      'a[href="https://example.test/"]',
    )!;
    expect(!!link).toBe(true);
    expect(link.classList.contains("bg-primary")).toBe(true);
    expect(link.rel).toBe("noopener noreferrer");
  });
  test("native card catalog keeps plain text, table expansion, owner-only replies and canonical answer state", async () => {
    const input = JSON.parse(
      readFileSync(
        new URL("./fixtures/card-wire.json", import.meta.url),
        "utf8",
      ),
    ).input;
    const q = {
      ...message(31, "Surrounding **message**"),
      author: fixture().me,
      card: JSON.stringify(input),
    };
    let room: Room = { ...fixture(), id: "abc123", messages: [q] };
    const sent: RoomCommand[] = [];
    let resolve!: (result: CommandOutcome) => void;
    const { target, update } = renderChat(room, {
      actions: {
        request: (command) => {
          sent.push(command);
          return new Promise((done) => (resolve = done));
        },
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
      },
    });
    await expectInteractiveReady(target);
    const card = target.querySelector("[data-card]")!;
    expect(card.textContent).toContain("historical alias");
    expect(card.querySelector("td")?.textContent).toBe("1");
    expect(card.querySelector("polyline") !== null).toBe(true);
    expect(card.querySelector("img")?.getAttribute("src")).toBe(
      "/api/books/abc123/files/aa11",
    );
    const tableTrigger = Array.from(card.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Abrir em tela cheia"),
    )!;
    tableTrigger.click();
    flushSync();
    await tick();
    expect(document.querySelector('[role="dialog"] table') !== null).toBe(true);
    document
      .querySelector<HTMLButtonElement>('[role="dialog"] [data-dialog-close]')!
      .click();
    flushSync();
    await tick();
    const button = card.querySelector<HTMLButtonElement>(
      '[data-card-answer="3"]',
    )!;
    button.click();
    button.click();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      t: "msg",
      thread: "e",
      reply_to: 31,
      text: "3",
    });
    resolve({ ok: true });
    await tick();
    flushSync();
    expect(
      target.querySelector('[data-card-answer="3"]')?.hasAttribute("disabled"),
    ).toBe(true);
    room = {
      ...room,
      messages: [
        q,
        { ...message(32, "3"), author: room.me, kind: null, reply_to: 31 },
      ],
    };
    update(room);
    expect(target.querySelector('[data-card-answer="3"]') === null).toBe(true);
    expect(target.querySelector('[data-card-picked="3"]') !== null).toBe(true);
    update({ ...room, messages: [{ ...q, card: "{invalid" }] });
    expect(target.querySelector("[data-card]") === null).toBe(true);
    expect(target.querySelector("[data-rich-content]")?.textContent).toBe(
      "Surrounding message",
    );
  }, 30_000);
  test("choices populate editable composer drafts with Other and never submit", async () => {
    const q = {
      ...message(41, "Question"),
      author: fixture().me,
      choices: JSON.stringify({ options: ["First", "Second"], multi: false }),
    };
    const room = { ...fixture(), messages: [q] };
    const drafts: { messageId: number; thread: string; text: string }[] = [],
      commands: RoomCommand[] = [];
    const { target, update } = renderChat(room, {
      actions: {
        request: async (command) => {
          commands.push(command);
          return { ok: true };
        },
        draftReply: (draft) => drafts.push(draft),
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
      },
    });
    await expectInteractiveReady(target);
    const radios = target.querySelectorAll<HTMLButtonElement>(
      '[data-choices] [role="radio"]',
    );
    radios[0].click();
    flushSync();
    expect(drafts.at(-1)).toEqual({
      messageId: 41,
      thread: "e",
      text: "First",
    });
    radios[2].click();
    flushSync();
    expect(drafts.at(-1)?.text).toBe("");
    expect(commands).toHaveLength(0);
    const detached = radios[0];
    update({
      ...room,
      messages: [
        {
          ...q,
          choices: JSON.stringify({
            options: ["First", "Second"],
            closed: "terminal",
          }),
        },
      ],
    });
    detached.click();
    flushSync();
    expect(drafts).toHaveLength(2);
    expect(
      target.querySelector(
        '[data-choices] input, [data-choices] [role="radio"]',
      ) === null,
    ).toBe(true);
    expect(target.textContent).toContain("foi pro terminal");
    update({ ...room, me: "you@test", messages: [q] });
    expect(
      target.querySelector(
        '[data-choices] input, [data-choices] [role="radio"]',
      ) === null,
    ).toBe(true);
  }, 30_000);
  test("multi choices keep option order and Other clears draft without submitting", async () => {
    const q = {
        ...message(42, "Question"),
        author: fixture().me,
        choices: JSON.stringify({ options: ["First", "Second"], multi: true }),
      },
      drafts: string[] = [];
    const { target } = renderChat(
      { ...fixture(), messages: [q] },
      {
        actions: {
          request: async () => ({ ok: true }),
          draftReply: (draft) => drafts.push(draft.text),
          reply: () => {},
          navigate: () => {},
          openFile: () => {},
        },
      },
    );
    await expectInteractiveReady(target);
    const checks = target.querySelectorAll<HTMLButtonElement>(
      '[data-choices] [role="checkbox"]',
    );
    for (const index of [1, 0, 2]) {
      checks[index].click();
      flushSync();
    }
    expect(drafts).toEqual(["Second", "First · Second", ""]);
  }, 30_000);
  test("permission confirmation cancels safely and canonical target removal suppresses late errors", async () => {
    const q = {
      ...message(51, "⏸ Seu Claude pede permissão"),
      author: fixture().me,
      choices: '{"options":["Aprovar","Negar"],"multi":false}',
    };
    const room = { ...fixture(), messages: [q] };
    const sent: RoomCommand[] = [];
    let resolve!: (result: CommandOutcome) => void;
    const { target, update } = renderChat(room, {
      actions: {
        request: (command) => {
          sent.push(command);
          return new Promise((done) => (resolve = done));
        },
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
      },
    });
    await expectInteractiveReady(target);
    target
      .querySelector<HTMLButtonElement>('[data-permission-value="Aprovar"]')!
      .click();
    flushSync();
    await tick();
    expect(sent).toHaveLength(0);
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    )
      .find((button) => button.textContent === "Cancelar")!
      .click();
    flushSync();
    await tick();
    await expectAlertDialogClosed();
    expect(sent).toHaveLength(0);
    target
      .querySelector<HTMLButtonElement>('[data-permission-value="Negar"]')!
      .click();
    flushSync();
    await tick();
    Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    )
      .find((button) => button.textContent === "Confirmar")!
      .click();
    expect(sent[0]).toMatchObject({ t: "msg", text: "Negar", reply_to: 51 });
    update({ ...room, messages: [] });
    resolve({ ok: false, error: "late permission failure" });
    await tick();
    flushSync();
    await expectAlertDialogClosed();
    expect(target.textContent).not.toContain("late permission failure");
  }, 30_000);
  test("poll votes retain canonical pressed state, report failure and gate closure by author", async () => {
    const q = { ...message(61, ""), poll: "p" };
    const poll = {
      id: "p",
      question: "Vote",
      options: ["First", "Second"],
      author: fixture().me,
      multi: true,
      closed: false,
      votes: [[], []],
    };
    const room = { ...fixture(), messages: [q], polls: { p: poll } };
    const sent: RoomCommand[] = [];
    let resolve!: (result: CommandOutcome) => void;
    const { target, update } = renderChat(room, {
      actions: {
        request: (command) => {
          sent.push(command);
          return new Promise((done) => (resolve = done));
        },
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
      },
    });
    await expectInteractiveReady(target);
    const stale = target.querySelector<HTMLButtonElement>('[data-vote="0"]')!;
    stale.click();
    expect(sent[0]).toEqual({ t: "vote", id: "p", opt: 0 });
    expect(stale.getAttribute("aria-pressed")).toBe("false");
    resolve({ ok: false, error: "server refused" });
    await tick();
    flushSync();
    expect(target.textContent).toContain("server refused");
    update({ ...room, polls: { p: { ...poll, votes: [[room.me], []] } } });
    expect(
      target.querySelector('[data-vote="0"]')?.getAttribute("aria-pressed"),
    ).toBe("true");
    expect(target.querySelector("[data-poll-close]") !== null).toBe(true);
    update({ ...room, me: "you@test" });
    expect(target.querySelector("[data-poll-close]") === null).toBe(true);
    const before = sent.length;
    stale.click();
    expect(sent).toHaveLength(before);
  }, 30_000);
  test("same-ID permission replacement invalidates old confirmation before any request", async () => {
    const q = {
      ...message(71, "⏸ Seu Claude pede permissão: old"),
      author: fixture().me,
      choices: '{"options":["Aprovar","Negar"],"multi":false}',
    };
    const room = { ...fixture(), messages: [q] },
      sent: RoomCommand[] = [];
    const { target, update } = renderChat(room, {
      actions: {
        request: async (command) => {
          sent.push(command);
          return { ok: true };
        },
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
      },
    });
    await expectInteractiveReady(target);
    target
      .querySelector<HTMLButtonElement>('[data-permission-value="Aprovar"]')!
      .click();
    flushSync();
    await tick();
    const stale = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        '[role="alertdialog"] button',
      ),
    ).find((button) => button.textContent === "Confirmar")!;
    update({
      ...room,
      messages: [{ ...q, text: "⏸ Seu Claude pede permissão: replacement" }],
    });
    stale.click();
    flushSync();
    await tick();
    await expectAlertDialogClosed();
    expect(sent).toHaveLength(0);
  }, 30_000);
  test("dense supported card tables stay accessible through lazy full-data dialogs", async () => {
    const elements: Record<string, unknown> = {
      c: { type: "Card", children: ["a", "b", "c2"] },
    };
    for (const id of ["a", "b", "c2"])
      elements[id] = {
        type: "Table",
        props: {
          headers: [id],
          rows: Array.from({ length: 50 }, (_, row) =>
            Array.from({ length: 10 }, (_, col) => `${id}-${row}-${col}`),
          ),
        },
      };
    const { target } = renderChat({
      ...fixture(),
      messages: [
        {
          ...message(72, "Tables"),
          card: JSON.stringify({ root: "c", elements }),
        },
      ],
    });
    await expectInteractiveReady(target);
    expect(target.querySelectorAll("[data-card-table]")).toHaveLength(3);
    expect(
      target.querySelectorAll("[data-card-table] td").length,
    ).toBeLessThanOrEqual(1000);
    const tables = target.querySelectorAll("[data-card-table]");
    tables[2].querySelector<HTMLButtonElement>("button")!.click();
    flushSync();
    await tick();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "c2-49-9",
    );
  }, 30_000);
  test("lost poll ACK disables repeat toggles until late canonical vote reconciles", async () => {
    const q = { ...message(81, ""), poll: "p" },
      poll = {
        id: "p",
        question: "Vote",
        options: ["First", "Second"],
        author: fixture().me,
        multi: false,
        closed: false,
        votes: [[], []],
      },
      room = { ...fixture(), messages: [q], polls: { p: poll } },
      sent: RoomCommand[] = [];
    let resolve!: (result: CommandOutcome) => void;
    const { target, update } = renderChat(room, {
      actions: {
        request: (command) => {
          sent.push(command);
          return new Promise((done) => (resolve = done));
        },
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
      },
    });
    await expectInteractiveReady(target);
    const vote = target.querySelector<HTMLButtonElement>('[data-vote="0"]')!;
    vote.click();
    resolve({ ok: false, error: "disconnected" });
    await tick();
    flushSync();
    expect(target.textContent).toContain("Ainda sem confirmação");
    expect(vote.disabled).toBe(true);
    vote.click();
    expect(sent).toHaveLength(1);
    update({ ...room, polls: { p: { ...poll, votes: [[room.me], []] } } });
    const current = target.querySelector<HTMLButtonElement>('[data-vote="0"]')!;
    expect(current.disabled).toBe(false);
    expect(current.getAttribute("aria-pressed")).toBe("true");
    expect(sent).toHaveLength(1);
  }, 30_000);
  test("streaming typing notes and repeated text updates retain message anchors", async () => {
    let room: Room = {
      ...fixture(),
      messages: [message(1, "")],
      typing: { "1": "smart" },
    };
    const { target, update } = renderChat(room, {
      vb: bridge({
        typingLabel: () => "com calma",
        typingNote: () => "<img src=x onerror=alert(1)> Working",
      }),
    });
    const row = target.querySelector("#m1")!;
    expect(row.querySelector("[data-message-typing]")?.textContent).toBe(
      "<img src=x onerror=alert(1)> Working…",
    );
    expect(row.querySelector("img")).toBeNull();
    for (const text of ["H", "Hello", "Hello **world**", "Final response"]) {
      room = { ...room, messages: [message(1, text)], typing: {} };
      update(room);
      expect(target.querySelector("#m1")).toBe(row);
      expect(row.querySelector("[data-rich-content]")?.textContent).toBe(
        text.replace(/\*\*/g, ""),
      );
      expect(row.querySelector("[data-message-typing]")).toBeNull();
    }
    update({ ...room, messages: [...room.messages, message(2, "next reply")] });
    expect(target.querySelectorAll("[data-chat-message]")).toHaveLength(2);
    // The hover toolbar mounts on the first pointer or focus in a message.
    expect(target.querySelectorAll("[data-reply]")).toHaveLength(0);
    expect(
      target.querySelectorAll("[data-message-toolbar-entry]"),
    ).toHaveLength(2);
    // Keyboard: the one tab stop opens the toolbar and moves focus to its first button.
    target
      .querySelector<HTMLButtonElement>("#m2 [data-message-toolbar-entry]")!
      .focus();
    await tick();
    flushSync();
    await tick();
    expect(
      document.activeElement?.closest("#m2 [data-message-toolbar]"),
    ).not.toBeNull();
    expect(target.querySelector("#m2 [data-message-toolbar-entry]")).toBeNull();
    // Shift+Tab from after the message lands on the toolbar's last button.
    const lastOfM2 = [
      ...target.querySelectorAll<HTMLElement>(
        "#m2 [data-message-toolbar] button",
      ),
    ].at(-1)!;
    const view = target.ownerDocument.defaultView as unknown as {
      FocusEvent: typeof FocusEvent;
    };
    target
      .querySelector<HTMLButtonElement>("#m1 [data-message-toolbar-entry]")!
      .dispatchEvent(new view.FocusEvent("focus", { relatedTarget: lastOfM2 }));
    await tick();
    flushSync();
    await tick();
    const m1Buttons = [
      ...target.querySelectorAll<HTMLElement>(
        "#m1 [data-message-toolbar] button",
      ),
    ];
    expect(m1Buttons.length).toBeGreaterThan(1);
    expect(document.activeElement).toBe(m1Buttons.at(-1)!);
    update({
      ...room,
      messages: [
        ...room.messages,
        message(2, "next reply"),
        message(3, "third"),
      ],
    });
    flushSync();
    // A screen reader's browse mode clicks without focus.
    target
      .querySelector<HTMLButtonElement>("#m3 [data-message-toolbar-entry]")!
      .click();
    await tick();
    flushSync();
    await tick();
    expect(
      document.activeElement?.closest("#m3 [data-message-toolbar]"),
    ).not.toBeNull();
    hoverMessages(target);
    expect(target.querySelectorAll('[data-reply="1"]')).toHaveLength(1);
  }, 30_000);
  test("empty failed initial history mounts the real older control and clicks explicit retry", async () => {
    const { createChatViewport } =
      await import("../web/features/chat-viewport/controller");
    const room = { ...fixture(), messages: [] };
    let queued = false;
    const sent: RoomCommand[] = [];
    const owner = createChatViewport({
      current: () => true,
      send: (command) => {
        sent.push(command);
        return queued;
      },
      render: () => {},
      selectThread: () => {},
      notice: () => {},
      schedule: () => 0,
      cancel: () => {},
    });
    try {
      owner.sync(room, "e", 1, true);
      owner.ensureFilled();
      const { target } = renderChat(room, {
        ...owner.selection(),
        onloadolder: () => owner.loadOlder(),
      });
      const button = target.querySelector<HTMLButtonElement>("#olderBtn");
      expect(button).not.toBeNull();
      expect(button?.disabled).toBe(false);
      owner.ensureFilled();
      expect(sent).toHaveLength(1);
      queued = true;
      button!.click();
      expect(sent).toEqual([
        { t: "older", thread: "e", before: 0 },
        { t: "older", thread: "e", before: 0 },
      ]);
    } finally {
      owner.dispose();
    }
  }, 30_000);
  test("quotes, actions and origin survive chat refresh; @vibe notices are hidden", () => {
    const origin = message(7, "Original request");
    const reply = { ...message(8, "A response"), reply_to: 7 };
    const notice = {
      ...message(9, "Archived safely"),
      author: "ai",
      tag: "notice",
    };
    const room = { ...fixture(), messages: [reply, notice] };
    let pages = 0;
    const { target, update } = renderChat(room, {
      origin,
      more: true,
      replyCount: 2,
      onloadolder: () => pages++,
    });
    expect(target.querySelector("[data-chat-origin] #m7")).toBeNull();
    expect(
      target.querySelector('[data-chat-origin] [data-origin-id="7"]'),
    ).not.toBeNull();
    expect(
      target.querySelector("#m8 [data-quote]")?.getAttribute("data-quote"),
    ).toBe("7");
    // @vibe's routine notices are hidden (Gui #3317).
    expect(target.querySelector("#m9")).toBeNull();
    hoverMessages(target);
    expect(target.querySelector('#m8 [data-copylink="8"]')).not.toBeNull();
    target.querySelector<HTMLElement>("#olderBtn")!.click();
    expect(pages).toBe(1);
    update({
      ...room,
      messages: [{ ...reply, text: "Updated response" }, notice],
    });
    expect(target.querySelector("#m8 [data-rich-content]")?.textContent).toBe(
      "Updated response",
    );
    expect(target.querySelectorAll("[data-chat-origin]")).toHaveLength(1);
    expect(target.querySelectorAll("#m9")).toHaveLength(0);
  }, 30_000);
  test("Criar thread on a message: one click makes the thread from that message and opens it, no title step (Gimenes #4310)", async () => {
    const room = {
      ...fixture(),
      messages: [
        message(8, "**Vamos** refazer o onboarding do celular\nmais detalhes"),
        message(10, "Already a thread"),
      ],
    };
    room.epics = [
      ...room.epics,
      { id: "f", title: "From ten", tasks: [], from_msg: 10 },
    ];
    const sent: RoomCommand[] = [],
      opened: string[] = [];
    const { target } = renderChat(room, {
      actions: {
        request: async (command: RoomCommand): Promise<CommandOutcome> => {
          sent.push(command);
          return { ok: true };
        },
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
        openThread: (id) => opened.push(id),
      },
    });
    hoverMessages(target);
    // A message that already started a thread has its card, not a second Criar thread.
    expect(target.querySelector("#m10 [data-start-thread]")).toBeNull();
    target
      .querySelector<HTMLButtonElement>('#m8 [data-start-thread="8"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    // No title line: the click itself creates the thread, titled from the message.
    expect(target.querySelector("input")).toBeNull();
    expect(sent).toHaveLength(1);
    const command = sent[0] as Extract<RoomCommand, { t: "epic" }>;
    expect(command).toMatchObject({
      t: "epic",
      title: "Vamos refazer o onboarding do celular",
      from: 8,
    });
    expect(command.id).toMatch(/^[0-9a-f]{8}$/);
    expect(opened).toEqual([command.id!]);
  }, 30_000);
  test("a thread just started from a message in main offers Desfazer until somebody writes in it (Gimenes #4310)", async () => {
    const source = {
      ...message(8, "Vamos refazer o onboarding"),
      thread: "main",
    };
    const room = { ...fixture(), messages: [source] };
    const sent: RoomCommand[] = [],
      opened: string[] = [],
      navigated: [number, string | undefined][] = [];
    const actions = {
      request: async (command: RoomCommand): Promise<CommandOutcome> => {
        sent.push(command);
        return { ok: true };
      },
      draftReply: () => {},
      reply: () => {},
      navigate: (id: number, thread?: string) => {
        navigated.push([id, thread]);
      },
      openFile: () => {},
      openThread: (id: string) => {
        opened.push(id);
      },
    };
    const main = renderChat(room, { thread: "main", actions });
    hoverMessages(main.target);
    main.target
      .querySelector<HTMLButtonElement>('#m8 [data-start-thread="8"]')!
      .click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    const id = opened[0]!;
    const started = {
      ...room,
      messages: [],
      epics: [
        ...room.epics,
        { id, title: "Vamos refazer o onboarding", tasks: [], from_msg: 8 },
      ],
    };
    // A reply already in the thread: no undo, it would delete that reply.
    const answered = renderChat(started, {
      thread: id,
      origin: source,
      replyCount: 1,
      actions,
    });
    expect(answered.target.querySelector("[data-thread-undo]")).toBeNull();
    const view = renderChat(started, { thread: id, origin: source, actions });
    const undo = view.target.querySelector("[data-thread-undo]")!;
    expect(undo.textContent).toContain("Thread criada");
    undo.querySelector<HTMLButtonElement>("button")!.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();
    expect(sent.at(-1)).toEqual({ t: "epic.del", id });
    expect(navigated).toEqual([[8, "main"]]);
    expect(view.target.querySelector("[data-thread-undo]")).toBeNull();
  }, 30_000);
  test("a DM's messages have no Criar thread", () => {
    const room = { ...fixture(), messages: [message(8, "oi")] };
    room.book = { ...room.book, dm: true };
    const { target } = renderChat(room);
    hoverMessages(target);
    expect(target.querySelector("#m8 [data-start-thread]")).toBeNull();
  }, 30_000);
  test("special reminder origins omit self-linking cards without removing DOM", () => {
    const origin = { ...message(7, "Reminder origin"), tag: "reminder" };
    const normal = { ...message(8, "Reminder reply"), tag: "reminder" };
    const room = {
      ...fixture(),
      messages: [normal],
      epics: [
        { id: "origin-card", title: "Origin thread", tasks: [], from_msg: 7 },
        { id: "normal-card", title: "Reply thread", tasks: [], from_msg: 8 },
      ],
    };
    const { target, update } = renderChat(room, { origin });
    expect(
      target.querySelector("[data-chat-origin] [data-thread-card]"),
    ).toBeNull();
    expect(target.querySelector("[data-chat-origin] #m7")).toBeNull();
    expect(target.querySelectorAll("#m8 [data-thread-card]")).toHaveLength(1);
    update({ ...room, messages: [{ ...normal, text: "Updated reminder" }] });
    expect(
      target.querySelector("[data-chat-origin] [data-thread-card]"),
    ).toBeNull();
    expect(target.querySelectorAll("#m8 [data-thread-card]")).toHaveLength(1);
  }, 30_000);
  test("thread cards use canonical descendants and exact metadata-only file callbacks", async () => {
    const source = message(71, "Request"),
      room: Room = {
        ...fixture(),
        messages: [source],
        epics: [
          {
            id: "child",
            title: "<b>Thread</b>",
            tasks: [],
            from_msg: 71,
            files: [
              { id: "aa11", name: "report.pdf", type: "application/pdf", n: 4 },
            ],
          },
        ],
      };
    const targets: import("../web/features/rich-text/types").RichNavigation[] =
        [],
      files: import("../web/features/rich-text/types").RichFileReference[] = [];
    const { target, update } = renderChat(room, {
      actions: {
        request: async () => ({ ok: true }),
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
        navigateRich: (value) => targets.push(value),
        openFileReference: (value) => files.push(value),
      },
    });
    const card = target.querySelector<HTMLButtonElement>(
      '[data-thread-card="child"]',
    )!;
    expect(card.textContent).toContain("<b>Thread</b>");
    expect(card.querySelector("b")).toBeNull();
    card.click();
    expect(targets).toEqual([{ kind: "thread", id: "child" }]);
    const file = target.querySelector<HTMLAnchorElement>('a[href*="aa11"]')!;
    expect(file.textContent).toContain("v4");
    file.click();
    expect(files).toEqual([
      { roomId: room.id, id: "aa11", name: "report.pdf" },
    ]);
    update({ ...room, epics: [] });
    card.click();
    file.click();
    await tick();
    expect(targets).toHaveLength(1);
    expect(files).toHaveLength(1);
  }, 30_000);
  test("chat controls call typed actions and preserve exact attachment versions and sandbox restrictions", async () => {
    const file = (id: string, type: string, embed = false) => ({
      id,
      name: "report.html",
      type,
      embed,
      author: "you@test",
      ts: 1,
      size: 10,
    });
    const files = [
      file("old-version", "text/html"),
      file("image", "image/png"),
      file("audio", "audio/mpeg"),
      file("embedded", "text/html", true),
      { ...file("room-app", "text/html"), name: "apps/demo.html" },
    ];
    const origin = { ...message(7, "Original <request>"), thread: "main" };
    const row = { ...message(8, "Body"), reply_to: 7, files };
    const room = { ...fixture(), messages: [row], origins: [origin] };
    const mountedEmbeds: Parameters<
      NonNullable<ChatProps["actions"]["mountEmbed"]>
    >[] = [];
    const replied: number[] = [],
      navigated: { id: number; thread?: string }[] = [],
      opened: string[] = [],
      apps: { connection: string; tool: string }[] = [],
      copied: string[] = [];
    window.navigator.clipboard.writeText = async (text) => {
      copied.push(text);
    };
    const { target } = renderChat(room, {
      origin,
      actions: {
        request: async (): Promise<CommandOutcome> => ({ ok: true }),
        draftReply: () => {},
        reply: (id) => replied.push(id),
        navigate: (id, thread) => navigated.push({ id, thread }),
        openFile: (selected) => opened.push(selected.id),
        openApp: (target) => apps.push(target),
        mountEmbed: (...args) => {
          mountedEmbeds.push(args);
          return () => {};
        },
      },
    });
    hoverMessages(target);
    target.querySelector<HTMLButtonElement>("#m8 [data-reply]")!.click();
    target.querySelector<HTMLButtonElement>("#m8 [data-quote]")!.click();
    target.querySelector<HTMLButtonElement>("[data-origin-id]")!.click();
    expect(replied).toEqual([8]);
    expect(navigated).toEqual([
      { id: 7, thread: "main" },
      { id: 7, thread: "main" },
    ]);
    target.querySelector<HTMLButtonElement>("#m8 [data-copy]")!.click();
    await tick();
    flushSync();
    expect(copied).toContain("Body");
    target.querySelector<HTMLButtonElement>("#m8 [data-copylink]")!.click();
    await tick();
    flushSync();
    expect(copied.at(-1)).toContain("/b/r?t=e#m8");
    const attachments = target.querySelector<HTMLElement>(
      "#m8 [data-message-attachments]",
    )!;
    attachments
      .querySelector<HTMLAnchorElement>('a[href$="old-version"]')!
      .click();
    expect(opened).toEqual(["old-version"]);
    expect(attachments.querySelector("audio")?.getAttribute("src")).toContain(
      "/audio",
    );
    expect(attachments.querySelector("img")?.getAttribute("src")).toContain(
      "/image",
    );
    const appRow = attachments.querySelector("[data-room-app-row]")!;
    expect(appRow.textContent).toContain("demo");
    expect(appRow.querySelector("iframe,a")).toBeNull();
    appRow.querySelector<HTMLButtonElement>("button")!.click();
    expect(apps).toEqual([{ connection: "room", tool: "demo" }]);
    expect(attachments.querySelectorAll("iframe")).toHaveLength(1);
    const iframe = attachments.querySelector("iframe")!;
    expect(mountedEmbeds).toHaveLength(1);
    expect(mountedEmbeds[0][0]).toBe(iframe);
    expect(mountedEmbeds[0][1]).toEqual(files[3]);
    expect(iframe.getAttribute("src")).toBeNull();
    expect(iframe.getAttribute("aria-busy")).toBe("true");
    mountedEmbeds[0][2].ready();
    flushSync();
    expect(iframe.getAttribute("aria-busy")).toBe("false");
    expect(iframe.getAttribute("src")).toBeNull();
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    expect(iframe.hasAttribute("srcdoc")).toBe(false);
  }, 30_000);
  test("image attachment previews preserve exact file actions and detached removed images stay inert", () => {
    const first = {
      id: "aa11",
      name: "tall.png",
      type: "image/png",
      author: "you@test",
      size: 10,
      ts: 1,
    };
    const second = { ...first, id: "bb22", name: "normal.png" };
    const row = { ...message(8, "Images"), files: [first, second] };
    const room = { ...fixture(), files: [first, second], messages: [row] };
    const opened: import("../shared/room").Attachment[] = [];
    const { target, update } = renderChat(room, {
      actions: {
        request: async () => ({ ok: true }),
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: (file) => opened.push(file),
      },
    });
    const old = target.querySelector<HTMLAnchorElement>(
      '[data-message-image][href$="aa11"]',
    )!;
    old.click();
    expect(opened).toEqual([first]);
    update({ ...room, messages: [{ ...row, files: [second] }] });
    expect(old.isConnected).toBe(false);
    old.click();
    expect(opened).toEqual([first]);
    target
      .querySelector<HTMLAnchorElement>('[data-message-image][href$="bb22"]')!
      .click();
    expect(opened).toEqual([first, second]);
  });
  test("compact receipts show five faces, overflow and read/delivery details on focus and tap", async () => {
    const room: Room = {
      ...fixture(),
      messages: [message(1, "Receipt target")],
    };
    room.receipts = Array.from({ length: 7 }, (_, i) => ({
      email: `reader${i}@test.com`,
      who: i % 2 ? "Codex" : "Claude",
      read: i < 6 ? 1 : 0,
      delivered: 1,
    }));
    room.acks = [
      {
        msg_id: 1,
        email: "blocked@test.com",
        who: "Codex",
        status: "blocked",
        ts: 1,
        note: "<script>unsafe()</script>",
      },
    ];
    const { target, update } = renderChat(room);
    const footer = target.querySelector<HTMLElement>(
      "#m1 [data-message-footer]",
    )!;
    expect(footer.querySelectorAll("[data-reader-read]")).toHaveLength(5);
    expect(footer.textContent).toContain("+2");
    expect(footer.querySelector("script") === null).toBe(true);
    expect(footer.textContent).toContain("<script>unsafe()</script>");
    const seen = footer.querySelector<HTMLButtonElement>(
      "button[aria-expanded]",
    )!;
    expect(seen.getAttribute("aria-label")).toBe("visto por 6 de 7");
    seen.focus();
    await tick();
    flushSync();
    expect(footer.querySelector('[role="tooltip"]')?.textContent).toContain(
      "reader6@test.com",
    );
    expect(footer.querySelector('[role="tooltip"]')?.textContent).toContain(
      "recebeu",
    );
    seen.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    flushSync();
    expect(footer.querySelector('[role="tooltip"]') === null).toBe(true);
    seen.click();
    flushSync();
    expect(seen.getAttribute("aria-expanded")).toBe("true");
    seen.click();
    flushSync();
    expect(seen.getAttribute("aria-expanded")).toBe("false");
    const anchor = target.querySelector("#m1");
    update({ ...room, receipts: [{ ...room.receipts[6], read: 1 }], acks: [] });
    expect(target.querySelector("#m1") === anchor).toBe(true);
    expect(
      target
        .querySelector("#m1 [data-message-footer] button")
        ?.getAttribute("aria-label"),
    ).toBe("visto por 1");
    expect(target.querySelectorAll("[data-message-footer]")).toHaveLength(1);
  }, 30_000);
  test("quiet rows retain folding, status ownership and canonical thread cards", async () => {
    const reminder = {
      ...message(1, "⏰ **daily** report\n\nDetails"),
      tag: "reminder",
    };
    const latest = { ...reminder, id: 2, ts: 2000 };
    const interactive = {
      ...message(3, "@person **rich**"),
      card: JSON.stringify({
        root: "c",
        elements: {
          c: { type: "Card", children: ["a"] },
          a: { type: "Actions", children: ["b"] },
          b: { type: "Button", props: { label: "Pick" } },
        },
      }),
      choices: JSON.stringify({ options: ["A", "B"], multi: false }),
      poll: "p",
    };
    const room = {
      ...fixture(),
      messages: [reminder, latest, interactive],
      polls: {
        p: {
          id: "p",
          author: "ai",
          question: "Poll",
          options: ["A", "B"],
          multi: false,
          closed: false,
          votes: [[], []],
        },
      },
      acks: [
        {
          msg_id: 2,
          email: "agent@test",
          who: "Codex",
          status: "done",
          ts: 2000,
        },
      ],
    };
    room.epics = [
      { id: "card-one", title: "One", tasks: [], from_msg: 1 },
      { id: "card-two", title: "Two", tasks: [], from_msg: 2 },
    ];
    const { target } = renderChat(room);
    expect(target.querySelector("#m1") === null).toBe(true);
    expect(target.querySelector("#m2 details")?.textContent).toContain(
      "rodou 2×",
    );
    expect(
      target.querySelector("#m2 [data-message-footer]")?.textContent,
    ).toContain("fez isso");
    expect(target.querySelector("#m3 [data-rich-content]")?.textContent).toBe(
      "@person rich",
    );
    await expectInteractiveReady(target);
    expect(target.querySelector("#m3 [data-card]") !== null).toBe(true);
    expect(target.querySelector("#m3 [data-choices]") !== null).toBe(true);
    expect(target.querySelector("#m3 [data-vote]") !== null).toBe(true);
    expect(target.querySelectorAll("#m2 [data-thread-card]")).toHaveLength(2);
  });
  test("room replacement disposes action feedback and detached message handlers", async () => {
    let resolveCopy!: () => void;
    window.navigator.clipboard.writeText = () =>
      new Promise<void>((resolve) => {
        resolveCopy = resolve;
      });
    const room = {
      ...fixture(),
      messages: [message(1, "Old room [jump](#m7)")],
    };
    const replied: number[] = [];
    const navigated: number[] = [];
    const { target, update } = renderChat(room, {
      actions: {
        request: async (): Promise<CommandOutcome> => ({ ok: true }),
        draftReply: () => {},
        reply: (id) => replied.push(id),
        navigate: (id) => navigated.push(id),
        openFile: () => {},
      },
    });
    hoverMessages(target);
    const staleReply = target.querySelector<HTMLButtonElement>("[data-reply]")!;
    const staleRich = target.querySelector<HTMLAnchorElement>(
      '[data-rich-link="message"]',
    )!;
    target.querySelector<HTMLButtonElement>("[data-copy]")!.click();
    update({ ...room, id: "next", messages: [message(2, "Next room")] });
    staleReply.click();
    staleRich.click();
    resolveCopy();
    await tick();
    flushSync();
    expect(replied).toEqual([]);
    expect(navigated).toEqual([]);
    expect(target.textContent).not.toContain("Copiado");
    expect(target.querySelector("#m1") === null).toBe(true);
    expect(target.querySelector("#m2") !== null).toBe(true);
  }, 30_000);
  test("embeds own consent, bounded media geometry and cleanup while retaining the typed protocol integration", async () => {
    const embedded = {
      id: "embedded",
      name: "app.html",
      type: "text/html",
      embed: true,
      author: "you@test",
      ts: 1,
      size: 10,
    };
    const room = {
      ...fixture(),
      messages: [{ ...message(1, "App"), files: [embedded] }],
    };
    let controls: import("../web/app/chatTypes").ChatEmbedControls | undefined;
    let detached = 0;
    const mounted: string[] = [];
    const { target, update } = renderChat(room, {
      actions: {
        request: async (): Promise<CommandOutcome> => ({ ok: true }),
        draftReply: () => {},
        reply: () => {},
        navigate: () => {},
        openFile: () => {},
        mountEmbed: (frame, file, next) => {
          mounted.push(file.id);
          controls = next;
          expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
          return () => {
            detached++;
          };
        },
      },
    });
    const original = controls!;
    const frame = target.querySelector("iframe")!;
    expect(mounted).toEqual(["embedded"]);
    expect(frame.hasAttribute("src")).toBe(false);
    original.ready();
    flushSync();
    expect(frame.hasAttribute("src")).toBe(false);
    expect(frame.hasAttribute("srcdoc")).toBe(false);
    expect(frame.getAttribute("aria-busy")).toBe("false");
    original.resize(Number.POSITIVE_INFINITY);
    flushSync();
    expect(frame.getAttribute("height")).toBe("320");
    original.resize(1000);
    flushSync();
    expect(Number(frame.getAttribute("height"))).toBeLessThanOrEqual(420);
    expect(frame.hasAttribute("style")).toBe(false);
    const consent = original.ask(
      "post a message",
      "<script>hostile detail</script>",
    );
    flushSync();
    expect(target.querySelector("script") === null).toBe(true);
    expect(target.querySelector("q")?.textContent).toBe(
      "<script>hostile detail</script>",
    );
    const cancel = Array.from(
      target.querySelectorAll<HTMLButtonElement>('[role="group"] button'),
    ).find((button) => button.textContent?.includes("Cancelar"))!;
    cancel.click();
    await expect(consent).resolves.toBe(false);
    const firstQuestion = original.ask("A", "visible A"),
      secondQuestion = original.ask("B", "unseen B");
    flushSync();
    const oldAllow = Array.from(
      target.querySelectorAll<HTMLButtonElement>('[role="group"] button'),
    ).find((button) => button.textContent?.includes("Permitir"))!;
    oldAllow.click();
    oldAllow.click();
    await expect(firstQuestion).resolves.toBe(true);
    for (
      let frame = 0;
      frame < 10 && target.querySelector("q")?.textContent !== "unseen B";
      frame++
    ) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      flushSync();
      await tick();
    }
    expect(target.querySelector("q")?.textContent).toBe("unseen B");
    oldAllow.click();
    flushSync();
    expect(target.querySelector("q")?.textContent).toBe("unseen B");
    const nextCancel = Array.from(
      target.querySelectorAll<HTMLButtonElement>('[role="group"] button'),
    ).find((button) => button.textContent?.includes("Cancelar"))!;
    nextCancel.click();
    await expect(secondQuestion).resolves.toBe(false);
    const lateConsent = original.ask("write after switch", "old room");
    flushSync();
    update({ ...room, id: "next" });
    await expect(lateConsent).resolves.toBe(false);
    expect(detached).toBe(1);
    expect(target.textContent).not.toContain("old room");
    const current = target.querySelector("iframe")!;
    const before = current.getAttribute("height");
    original.resize(40);
    flushSync();
    expect(current.getAttribute("height")).toBe(before);
  }, 30_000);
  test("revoked embed retains only a hidden denial frame and reopens a fresh owned iframe", async () => {
    const embedded = {
      id: "document-file",
      name: "app.html",
      type: "text/html",
      embed: true,
      author: "you@test",
      ts: 1,
      size: 10,
    };
    const controls: import("../web/app/chatTypes").ChatEmbedControls[] = [];
    let detached = 0;
    const { target } = renderChat(
      { ...fixture(), messages: [{ ...message(1, "App"), files: [embedded] }] },
      {
        actions: {
          request: async (): Promise<CommandOutcome> => ({ ok: true }),
          draftReply: () => {},
          reply: () => {},
          navigate: () => {},
          openFile: () => {},
          mountEmbed: (_frame, _file, control) => {
            controls.push(control);
            return () => {
              detached++;
            };
          },
        },
      },
    );
    await tick();
    flushSync();
    expect(controls).toHaveLength(1);
    const original = controls[0],
      oldFrame = target.querySelector("iframe");
    if (!(oldFrame instanceof HTMLIFrameElement))
      throw Error("Expected real initial iframe");
    const asking = original.ask("write", "Old document consent");
    flushSync();
    original.revoked?.();
    original.fail?.();
    flushSync();
    await expect(asking).resolves.toBe(false);
    expect(oldFrame.isConnected).toBe(true);
    expect(oldFrame.hidden).toBe(true);
    const reopen = [
      ...target.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Abrir app de novo"));
    expect(reopen).toBeDefined();
    reopen!.click();
    // The old iframe is still connected before the keyed DOM flush. Its saved
    // callbacks must already be unable to corrupt the requested fresh grant.
    expect(oldFrame.isConnected).toBe(true);
    original.deny?.();
    original.fail?.();
    original.revoked?.();
    original.ready();
    original.resize(1000);
    const oldAsk = original.ask(
      "late old write",
      "Must not reopen old consent",
    );
    reopen!.click();
    expect(oldFrame.isConnected).toBe(true);
    flushSync();
    await tick();
    flushSync();
    await expect(oldAsk).resolves.toBe(false);
    const fresh = target.querySelector("iframe");
    expect(fresh).not.toBe(oldFrame);
    expect(oldFrame.isConnected).toBe(false);
    expect(controls).toHaveLength(2);
    expect(detached).toBe(1);
    original.deny?.();
    original.resize(1000);
    original.ready();
    flushSync();
    expect(target.querySelector("iframe")).toBe(fresh);
    expect(fresh?.getAttribute("src")).toBeNull();
    expect(fresh?.getAttribute("srcdoc")).toBeNull();
    expect(fresh?.getAttribute("height")).toBe("320");
    expect(fresh?.getAttribute("aria-busy")).toBe("true");
    expect(target.textContent).not.toContain("Old document consent");
    expect(target.textContent).not.toContain("Must not reopen old consent");
  }, 30_000);
  test("origin embeds retain their source thread in the explicit protocol integration", () => {
    const embedded = {
      id: "origin-file",
      name: "origin.html",
      type: "text/html",
      embed: true,
      author: "you@test",
      ts: 1,
      size: 10,
    };
    const threads: string[] = [];
    renderChat(
      { ...fixture(), messages: [message(8, "Epic reply")] },
      {
        origin: { ...message(7, "Origin"), thread: "main", files: [embedded] },
        actions: {
          request: async (): Promise<CommandOutcome> => ({ ok: true }),
          draftReply: () => {},
          reply: () => {},
          navigate: () => {},
          openFile: () => {},
          mountEmbed: (_frame, _file, controls) => {
            threads.push(controls.thread);
            return () => {};
          },
        },
      },
    );
    expect(threads).toEqual(["main"]);
  });
  test("multitouch cancels a locked swipe before it can reply or copy", () => {
    const replied: number[] = [];
    const { target } = renderChat(
      { ...fixture(), messages: [message(1, "Swipe target")] },
      {
        actions: {
          request: async (): Promise<CommandOutcome> => ({ ok: true }),
          draftReply: () => {},
          reply: (id) => replied.push(id),
          navigate: () => {},
          openFile: () => {},
        },
      },
    );
    const row = target.querySelector<HTMLElement>("#m1")!;
    const touch = (
      type: string,
      points: { clientX: number; clientY: number }[],
    ) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "touches", { value: points });
      row.dispatchEvent(event);
    };
    touch("touchstart", [{ clientX: 0, clientY: 0 }]);
    touch("touchmove", [{ clientX: 75, clientY: 1 }]);
    expect(row.getAttribute("data-swipe")).toBe("reply");
    touch("touchstart", [
      { clientX: 75, clientY: 1 },
      { clientX: 90, clientY: 5 },
    ]);
    touch("touchend", []);
    expect(replied).toEqual([]);
    expect(row.hasAttribute("data-swipe")).toBe(false);
    touch("touchstart", [{ clientX: 0, clientY: 0 }]);
    touch("touchmove", [{ clientX: 75, clientY: 1 }]);
    touch("touchmove", [
      { clientX: 75, clientY: 1 },
      { clientX: 90, clientY: 5 },
    ]);
    touch("touchend", []);
    expect(replied).toEqual([]);
    touch("touchstart", [{ clientX: 0, clientY: 0 }]);
    touch("touchmove", [{ clientX: 75, clientY: 1 }]);
    touch("touchend", []);
    expect(replied).toEqual([1]);
  });
});

test("phone edge observes installed Back without consuming browser gestures or replying", async () => {
  const { swipeMessage } = await import("../web/features/chat/swipe");
  const { attachRoomEdgeBack } =
    await import("../web/features/room-shell/edgeBack");
  const width = Object.getOwnPropertyDescriptor(window, "innerWidth");
  Object.defineProperty(window, "innerWidth", {
    value: 390,
    configurable: true,
  });
  const root = window.document.createElement("div"),
    row = window.document.createElement("div");
  root.append(row);
  window.document.body.append(root);
  let installed = false,
    backs = 0,
    replies = 0;
  const stop = attachRoomEdgeBack(root, {
    mobile: () => true,
    standalone: () => installed,
    current: () => true,
    target: () => "main",
    back: () => {
      backs++;
    },
  });
  const swipe = swipeMessage(row, {
    reply: () => {
      replies++;
    },
    copy: () => {},
  });
  function touch(
    type: string,
    points: { clientX: number; clientY: number }[],
    changed = points,
  ) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: points });
    Object.defineProperty(event, "changedTouches", { value: changed });
    row.dispatchEvent(event);
    return event.defaultPrevented;
  }
  try {
    for (const mode of [false, true]) {
      installed = mode;
      touch("touchstart", [{ clientX: 10, clientY: 0 }]);
      expect(touch("touchmove", [{ clientX: 90, clientY: 1 }])).toBe(false);
      touch("touchend", [], [{ clientX: 90, clientY: 1 }]);
    }
    expect(backs).toBe(1);
    expect(replies).toBe(0);
    touch("touchstart", [{ clientX: 40, clientY: 0 }]);
    touch("touchmove", [{ clientX: 120, clientY: 1 }]);
    touch("touchend", [], [{ clientX: 120, clientY: 1 }]);
    expect(replies).toBe(1);
    stop();
    touch("touchstart", [{ clientX: 10, clientY: 0 }]);
    touch("touchend", [], [{ clientX: 90, clientY: 1 }]);
    expect(backs).toBe(1);
  } finally {
    stop();
    swipe.destroy();
    if (width) Object.defineProperty(window, "innerWidth", width);
    else Reflect.deleteProperty(window, "innerWidth");
    root.remove();
  }
});

test("a left swipe copies the text from the top half and the link from the bottom half", async () => {
  const { swipeMessage } = await import("../web/features/chat/swipe");
  const row = window.document.createElement("div");
  window.document.body.append(row);
  const copies: boolean[] = [];
  const swipe = swipeMessage(row, {
    reply: () => {},
    copy: (link) => copies.push(link),
  });
  const touch = (
    type: string,
    points: { clientX: number; clientY: number }[],
  ) => {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, "touches", { value: points });
    row.dispatchEvent(event);
  };
  try {
    touch("touchstart", [{ clientX: 200, clientY: 0 }]);
    touch("touchmove", [{ clientX: 120, clientY: -1 }]);
    expect(row.dataset.swipeDir).toBe("left");
    expect(row.dataset.swipePick).toBe("copy");
    expect(row.dataset.swipe).toBe("copy");
    touch("touchend", []);
    expect(row.hasAttribute("data-swipe-dir")).toBe(false);
    touch("touchstart", [{ clientX: 200, clientY: 4 }]);
    touch("touchmove", [{ clientX: 120, clientY: 5 }]);
    expect(row.dataset.swipePick).toBe("link");
    expect(row.dataset.swipe).toBe("link");
    touch("touchend", []);
    touch("touchstart", [{ clientX: 200, clientY: 4 }]);
    touch("touchmove", [{ clientX: 170, clientY: 5 }]);
    expect(row.dataset.swipe).toBe("tracking");
    touch("touchend", []);
    expect(copies).toEqual([false, true]);
  } finally {
    swipe.destroy();
    row.remove();
  }
});

test("fenced document cards reuse presentation read-only, including nested cards and malformed fallback", async () => {
  const card = {
    root: "c",
    elements: {
      c: {
        type: "Card",
        props: { title: "Document result" },
        children: ["text", "actions"],
      },
      text: {
        type: "Text",
        props: { content: "Safe <img src=x onerror=evil()>" },
      },
      actions: { type: "Actions", children: ["answer", "link"] },
      answer: { type: "Button", props: { label: "Do it", value: "write" } },
      link: { type: "LinkButton", props: { label: "Epic", url: "#eabcd" } },
    },
  };
  const raw = JSON.stringify(card),
    fence = "```card\n" + raw + "\n```";
  const room = {
    ...fixture(),
    epics: [
      ...fixture().epics,
      { id: "abcd", title: "Card destination", tasks: [] },
    ],
    doc:
      fence +
      "\n\n> " +
      fence.replaceAll("\n", "\n> ") +
      "\n\n```card\n{broken-json}\n```",
  };
  const commands: RoomCommand[] = [],
    navigated: unknown[] = [];
  const owner = createDocumentSession({
    drafts: createDocumentDrafts(),
    request: async (command) => {
      commands.push(command);
      return { ok: true };
    },
    name: () => "Member",
    color: () => "#123456",
  });
  owner.sync(room, "main", true, true, 1);
  const props: DocumentProps = {
    room,
    thread: "main",
    lang: "en",
    pane: "doc",
    send: () => true,
    taskProps: {
      room,
      thread: "main",
      vb,
      send: () => true,
      request: async (command) => {
        commands.push(command);
        return { ok: true };
      },
    },
    actions: {
      navigate() {},
      openFile() {},
      navigateRich: (target) => navigated.push(target),
    },
    onPane() {},
    onAuthorize() {},
  };
  const target = document.createElement("div");
  document.body.append(target);
  const view = mountView("document", target, { owner, props });
  active.push(view);
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      await tick();
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      flushSync();
      if (target.querySelectorAll("[data-card-readonly]").length === 2) break;
    }
    expect(target.querySelectorAll("[data-card-readonly]").length).toBe(2);
    expect(target.textContent).toContain("Document result");
    expect(target.textContent).toContain("Safe <img src=x onerror=evil()>");
    expect(target.querySelector("img,script,[data-card-answer]") === null).toBe(
      true,
    );
    expect(target.querySelector("pre code")?.textContent).toContain(
      "{broken-json}",
    );
    const link = [
      ...target.querySelectorAll<HTMLButtonElement>(
        "[data-card-readonly] button",
      ),
    ].find((button) => button.textContent?.includes("Epic"));
    expect(link !== undefined).toBe(true);
    link!.click();
    expect(navigated).toEqual([{ kind: "thread", id: "abcd" }]);
    for (const node of target.querySelectorAll<HTMLElement>(
      "[data-card-readonly] span",
    ))
      node.click();
    expect(commands.filter((command) => command.t === "msg")).toEqual([]);
    owner.sync({ ...room, members: [] }, "main", true, true, 1);
    expect(link!.isConnected).toBe(true);
    link!.click();
    expect(navigated).toHaveLength(1);
  } finally {
    owner.dispose();
    target.remove();
  }
}, 30_000);

test("document task slots dispose across suggestion scope and detached controls cannot write", async () => {
  const room = fixture();
  room.doc = "# Room document";
  room.docs = { e: "# Epic document\n\n## Tarefas\n" };
  const events: RoomCommand[] = [];
  const owner = createDocumentSession({
    drafts: createDocumentDrafts(),
    request: async () => ({ ok: true }),
    name: () => "Member",
    color: () => "#123456",
  });
  owner.sync(room, "e", true, true, 1);
  const props: DocumentProps = {
    room,
    thread: "e",
    lang: "en",
    pane: "doc",
    send: (command) => {
      // The version picker's read on mount (doc.versions) isn't one of the writes this test counts.
      if (command.t !== "doc.versions") events.push(command);
      return true;
    },
    taskProps: {
      room,
      thread: "e",
      vb,
      send: (command) => {
        events.push(command);
        return true;
      },
      request: async (command) => {
        events.push(command);
        return { ok: true };
      },
    },
    actions: { navigate: () => {}, openFile: () => {} },
    onPane: () => {},
    onAuthorize: () => {},
  };
  const target = document.createElement("div");
  document.body.append(target);
  const view = mountView("document", target, { owner, props });
  active.push(view);
  try {
    const original = target.querySelector<HTMLButtonElement>(
      '[data-document-tasks] [role="checkbox"]',
    );
    expect(original instanceof HTMLButtonElement).toBe(true);
    owner.sync(room, "pre:0", true, true, 1);
    view.update({ owner, props: { ...props, thread: "pre:0" } });
    await tick();
    flushSync();
    expect(target.querySelectorAll("[data-document-tasks]").length).toBe(0);
    original!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    expect(events).toEqual([]);
    owner.sync(room, "e", true, true, 1);
    view.update({ owner, props });
    await tick();
    flushSync();
    const current = target.querySelector<HTMLButtonElement>(
      '[data-document-tasks] [role="checkbox"]',
    );
    expect(current instanceof HTMLButtonElement).toBe(true);
    expect(current === original).toBe(false);
    current!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await tick();
    expect(events).toEqual([
      { t: "task.toggle", id: "t" } satisfies RoomCommand,
    ]);
  } finally {
    owner.dispose();
  }
});

describe("stable sidebar integration", () => {
  function deferredOutcome() {
    let resolve!: (outcome: CommandOutcome) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<CommandOutcome>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, resolve, reject };
  }
  function sidebar(room: Room, extra: Partial<SidebarProps> = {}) {
    const target = window.document.createElement("div");
    window.document.body.append(target);
    const events: RoomCommand[] = [];
    const outcomes: ReturnType<typeof deferredOutcome>[] = [];
    const opened: string[] = [];
    const props: SidebarProps = {
      room,
      thread: "e",
      navigation: createNavigationSession(room.id),
      pins: syncPinsSession(null, room),
      request: (command) => {
        events.push(command);
        const outcome = deferredOutcome();
        outcomes.push(outcome);
        return outcome.promise;
      },
      onopenpinfile: () => {},
      onopenpinapp: () => {},
      send: (command) => {
        events.push(command);
        return true;
      },
      onopen: (id) => {
        opened.push(id);
      },
      onarchchange: () => {},
      vb: {
        ...vb,
        epicBusy: () => null,
        waitsIn: () => [],
      },
      ...extra,
    };
    const view = mountView("sidebar", target, props);
    active.push(view);
    return {
      target,
      props,
      view,
      events,
      outcomes,
      async settle(index: number, outcome: CommandOutcome) {
        outcomes[index].resolve(outcome);
        await outcomes[index].promise;
        await tick();
        flushSync();
      },
      opened,
      destroy() {
        active.splice(active.indexOf(view), 1);
        view.destroy();
        target.remove();
      },
    };
  }
  /** Open a pin row's menu the way a right-click (or Shift+F10) does, and return its items. */
  async function pinMenu(
    rendered: ReturnType<typeof sidebar>,
    id: string,
    via: "pointer" | "keyboard" | "enter" = "pointer",
  ) {
    const trigger = rendered.target.querySelector<HTMLElement>(
      `[data-pin-id="${id}"] [data-context-menu-trigger]`,
    )!;
    expect(trigger).not.toBeNull();
    if (via !== "pointer") {
      trigger.focus();
      trigger.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: via === "enter" ? "Enter" : "F10",
          shiftKey: via === "keyboard",
          bubbles: true,
          cancelable: true,
        }),
      );
    } else
      trigger.dispatchEvent(
        new window.MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 20,
          clientY: 20,
        }),
      );
    for (let frame = 0; frame < 10; frame++) {
      await tick();
      flushSync();
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (window.document.querySelector(`[data-pin-menu="${id}"]`)) break;
    }
    const menu = window.document.querySelector<HTMLElement>(
      `[data-pin-menu="${id}"]`,
    )!;
    expect(menu).not.toBeNull();
    expect(menu.getAttribute("role")).toBe("menu");
    const items = [
      ...menu.querySelectorAll<HTMLElement>(
        "[role=menuitem], [role=separator]",
      ),
    ];
    return {
      trigger,
      menu,
      items,
      labels: items.map((item) =>
        item.getAttribute("role") === "separator"
          ? "---"
          : item.textContent!.trim(),
      ),
      item: (label: string) =>
        items.find((item) => item.textContent!.trim() === label)!,
    };
  }
  async function settleMenu() {
    for (let frame = 0; frame < 5; frame++) {
      await tick();
      flushSync();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  test("titled sidebar sections share one header with a heading and a ghost + that opens an inline row", async () => {
    const room = fixture();
    room.pins = [
      { id: "p", kind: "link", ref: "https://example.com/", title: "Example" },
    ];
    const rendered = sidebar(room);
    const pins = rendered.target.querySelector("[data-pins]")!;
    // People & agents moved to the pane beside the chat (like Discord's member list).
    expect(rendered.target.querySelector("[data-people-panel]")).toBe(null);
    const header = pins.querySelector<HTMLElement>("[data-section-header]")!;
    const heading = header.querySelector("h3")!;
    expect(heading.className.split(/\s+/)).toContain("text-xs");
    expect(heading.className.split(/\s+/)).not.toContain("uppercase");
    expect(heading.textContent).toBe("Fixados");
    const label = document.getElementById(
      pins.getAttribute("aria-labelledby")!,
    );
    expect(heading.contains(label)).toBe(true);
    expect(label?.textContent).toBe("Fixados");
    const add = header.querySelector<HTMLButtonElement>(
      'button[aria-label="Fixar um link"]',
    )!;
    expect(add.hasAttribute("title")).toBe(false);
    add.click();
    await tick();
    flushSync();
    expect(pins.querySelector("form input[name=url]")).not.toBeNull();
    expect(header.querySelector('button[aria-label="Fixar um link"]')).toBe(
      null,
    );
    rendered.destroy();
  });
  test("epic tree shows no deploy icon, and production does not make an epic Feito (Gimenes #4247)", () => {
    const room = fixture();
    room.epics = [
      {
        id: "e",
        title: "Deployed",
        tasks: [],
        prod: { stage: "verified", at: 1000 },
      },
    ];
    room.messages = [
      { id: 50, thread: "e", text: "correction", author: room.me, ts: 2000 },
    ];
    const h = sidebar(room);
    flushSync();
    const row = h.target.querySelector('[data-epic-thread="e"]');
    expect(row).not.toBe(null);
    expect(row?.querySelector("[data-epic-prod]")).toBe(null);
    expect(
      row
        ?.querySelector("[data-epic-status-icon]")
        ?.getAttribute("data-epic-status-icon"),
    ).toBe("todo");
  });
  test("epic row: the status sits last and task progress is a bar, gray at 0 and green after", () => {
    const room = fixture();
    room.epics = [
      {
        id: "p",
        title: "Progress",
        tasks: [
          { id: "t1", title: "One", done: true },
          { id: "t2", title: "Two" },
          { id: "t3", title: "Three" },
        ],
      },
      { id: "z", title: "Zero", tasks: [{ id: "t4", title: "Four" }] },
      { id: "n", title: "None", tasks: [] },
    ] as typeof room.epics;
    const h = sidebar(room);
    flushSync();
    const row = (id: string) =>
      h.target.querySelector(`[data-epic-thread="${id}"]`)!;
    // The status icon is the last thing in the row's line.
    const line = [...row("p").children].filter(
      (el) => !el.matches("[data-epic-progress]"),
    );
    expect(line.at(-1)?.hasAttribute("data-epic-status-icon")).toBe(true);
    // No "x/y" text: a bar with its count for screen readers.
    expect(row("p").textContent).not.toContain("1/3");
    const bar = row("p").querySelector("[data-epic-progress]");
    expect(bar?.getAttribute("data-epic-progress")).toBe("1/3");
    expect(bar?.getAttribute("aria-label")).toBe("1 de 3 tarefas");
    expect(bar?.querySelector("progress")?.className).toContain("text-success");
    expect(
      bar?.querySelector<HTMLProgressElement>("progress")?.value,
    ).toBeCloseTo(33.33, 1);
    expect(
      row("z").querySelector<HTMLProgressElement>(
        "[data-epic-progress] progress",
      )?.value,
    ).toBe(0);
    expect(row("n").querySelector("[data-epic-progress]")).toBeNull();
    // No ⋯ on any row, on desktop or phone: the actions are inside the epic (Gimenes #3933).
    expect(h.target.querySelector("[data-epic-actions]")).toBeNull();
  });
  test("selected archived epic remains in normal order, marked by its background, with a readable cue", async () => {
    const room = fixture();
    room.epics = [
      { id: "a", title: "First", tasks: [] },
      {
        id: "b",
        title: "Archived target",
        archived: true,
        tasks: [],
      },
      { id: "c", title: "Last", tasks: [] },
    ];
    const h = sidebar(room, { thread: "b" });
    flushSync();
    expect(
      [...h.target.querySelectorAll<HTMLElement>("[data-epic-thread]")].map(
        (row) => row.getAttribute("data-epic-thread"),
      ),
    ).toEqual(["a", "b", "c"]);
    const row = h.target.querySelector<HTMLElement>('[data-epic-thread="b"]');
    expect(row !== null).toBe(true);
    expect(row!.textContent).toContain("Arquivado");
    // Selection is only a background change: no accent bar on the left.
    expect(row!.parentElement!.classList.contains("bg-sidebar-accent")).toBe(
      true,
    );
    expect(row!.parentElement!.className.split(/\s+/)).not.toContain(
      "border-l",
    );
    expect(row!.parentElement!.classList.contains("opacity-50")).toBe(false);
    h.view.update({ ...h.props, thread: "main" });
    await tick();
    flushSync();
    expect(h.target.querySelector('[data-epic-thread="b"]') === null).toBe(
      true,
    );
  });
  test("the room title is a button that opens the main thread and shows when it is selected", async () => {
    const room = fixture();
    const h = sidebar(room, { thread: "e" });
    const title = h.target.querySelector<HTMLButtonElement>(
      "button[data-room-title]",
    );
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain(room.book.title);
    expect(title!.hasAttribute("title")).toBe(false);
    // No hover tooltip on the main thread row (it repeated the room's name and summary).
    expect(title!.hasAttribute("data-state")).toBe(false);
    expect(title!.getAttribute("aria-current")).toBeNull();
    title!.click();
    expect(h.opened).toEqual(["main"]);
    h.view.update({ ...h.props, thread: "main" });
    await tick();
    flushSync();
    expect(title!.getAttribute("aria-current")).toBe("page");
  });
  test("on a desktop the room's name is the main thread: no separate row, no message count, what waits on you (Gimenes #3989)", async () => {
    const room = fixture();
    const h = sidebar(room, {
      thread: "e",
      vb: {
        ...vb,
        epicBusy: () => null,
        waitsIn: (id: string) => (id === "main" ? [{ ref: "m1" }] : []),
        waitsInRoom: () => [],
      },
    });
    const name = h.target.querySelector<HTMLButtonElement>(
      "button[data-room-home]",
    )!;
    expect(name.textContent).toContain(room.book.title);
    expect(
      name.querySelector("[data-wait-badge] [data-count]")?.textContent,
    ).toBe("1");
    expect(name.getAttribute("aria-current")).toBeNull();
    // The room's own row is for phones only; nothing in the sidebar opens a task board.
    expect(
      h.target
        .querySelector("button[data-room-title]")!
        .parentElement!.className.split(/\s+/),
    ).toContain("md:hidden");
    expect(h.target.querySelector("[data-board-toggle]")).toBeNull();
    expect(h.target.textContent).not.toContain("Sala principal");
    name.click();
    expect(h.opened).toEqual(["main"]);
    h.view.update({ ...h.props, thread: "main" });
    await tick();
    flushSync();
    expect(name.getAttribute("aria-current")).toBe("page");
  });
  test("the room row is the room's mark, title and what waits on you in its main thread, with ✎ right after the title (Gimenes #4108)", async () => {
    const room = fixture();
    const h = sidebar(room, {
      thread: "main",
      vb: {
        ...vb,
        epicBusy: () => null,
        waitsIn: (id: string) =>
          id === "main" ? [{ ref: "m1" }, { ref: "a2" }, { ref: "t3" }] : [],
        waitsInRoom: () => [{ ref: "m9" }],
      },
    });
    const title = h.target.querySelector<HTMLButtonElement>(
      "button[data-room-title]",
    )!;
    expect(title.querySelector("[data-room-mark]")).not.toBeNull();
    expect(
      title.querySelector("[data-wait-badge] [data-count]")?.textContent,
    ).toBe("3");
    // The Inbox is global (the rail, or the phone Home's bar): a room has no entry to it.
    expect(h.target.querySelector("[data-inbox-toggle]")).toBeNull();
    const rename = title.parentElement!.querySelector(
      'button[aria-label="Editar sala"]',
    );
    expect(rename).not.toBeNull();
    expect(title.nextElementSibling).toBe(rename);
    expect(rename!.className.split(/\s+/)).not.toContain("opacity-0");
  });
  test("phone drawer: the room's row is the first item, and the open thread's title and status are gone (Gimenes #4065)", () => {
    const room = fixture();
    const h = sidebar(room, { thread: "e" });
    const panel = h.target.querySelector("[data-room-sidebar-panel]")!;
    const row = panel.querySelector("button[data-room-title]")!.parentElement!;
    // Before the shortcuts, the tabs and the threads: nothing but the sheet's handle comes first.
    const before = [...panel.children].slice(
      0,
      [...panel.children].indexOf(row),
    );
    expect(
      before.every((node) =>
        node.matches("button[use\\:sheetHandle], button[aria-label='Fechar']"),
      ),
    ).toBe(true);
    expect(panel.querySelector("[data-thread-header]")).toBeNull();
    expect(panel.querySelector("[data-epic-status]")).toBeNull();
  });
  test("the room row shows no count when nothing waits in its main thread", () => {
    const room = fixture();
    const h = sidebar(room, { thread: "main" });
    const title = h.target.querySelector("button[data-room-title]")!;
    expect(title.querySelector("[data-wait-badge]")).toBeNull();
  });
  test("epic and rail indicators count asks and task reviews in one lime number", async () => {
    const room = fixture();
    const base = {
      ...vb,
      epicBusy: () => "Claude",
      waitsIn: (id: string) =>
        id === "e"
          ? [{ ref: "m1" }, { ref: "a2" }, { ref: "t3" }, { ref: "t4" }]
          : [],
    };
    const h = sidebar(room, { vb: base });
    const epic = h.target.querySelector('[data-epic="e"]')!;
    const badge = epic.querySelector("[data-wait-badge] [data-count]");
    expect(badge?.textContent?.trim()).toBe("4");
    // One colour: your Claude's ask (a2) does not turn the number red.
    expect(badge?.className.split(/\s+/)).toContain("bg-brand");
    expect(badge?.className).not.toContain("destructive");
    // One slot at the end (Gimenes #3904): the count takes the status's place.
    expect(epic.querySelector("[data-epic-status-icon]")).toBeNull();
    h.view.update({
      ...h.props,
      vb: {
        ...base,
        waitsIn: (id: string) => (id === "e" ? [{ ref: "t3" }] : []),
      },
    });
    await tick();
    flushSync();
    expect(
      h.target.querySelector('[data-epic="e"] [data-wait-badge] [data-count]')
        ?.textContent,
    ).toBe("1");
    h.view.update({
      ...h.props,
      collapsed: true,
      vb: { ...base, waitsIn: () => [{ ref: "t3" }] },
    });
    await tick();
    flushSync();
    expect(
      h.target.querySelector("[data-wait-badge] [data-count]")?.textContent,
    ).toBe("1");
  }, 30_000);
  test("the epic list is flat: sub-epics are plain rows and drafts survive updates and a remount", () => {
    const room = fixture();
    room.epics.push({ id: "child", title: "Child", parent: "e", tasks: [] });
    room.epics.push(
      { id: "old-parent", title: "Old parent", tasks: [], archived: true },
      {
        id: "old-child",
        parent: "old-parent",
        title: "Old child",
        tasks: [],
        archived: true,
      },
    );
    const session = createNavigationSession(room.id);
    const first = sidebar(room, { navigation: session, thread: "child" });
    const ids = [
      ...first.target.querySelectorAll<HTMLElement>("li[data-epic]"),
    ].map((row) => row.dataset.epic);
    expect(ids).toContain("e");
    expect(ids).toContain("child");
    expect(
      first.target.querySelector(
        "li[data-epic] [aria-expanded]:not([data-epic-actions])",
      ),
    ).toBeNull();
    expect(first.target.querySelector("li[data-depth]")).toBeNull();
    expect(
      first.target.querySelector<HTMLElement>("[data-epic=child]")?.hidden,
    ).toBe(false);
    first.view.update({
      ...first.props,
      room: {
        ...room,
        messages: [
          { id: 1, author: room.me, thread: "child", ts: 1, text: "live" },
        ],
      },
    });
    expect(
      first.target.querySelector<HTMLElement>("[data-epic=child]"),
    ).not.toBeNull();
    first.destroy();
    const second = sidebar(room, { navigation: session, thread: "child" });
    expect(
      second.target.querySelector(
        "li[data-epic] [aria-expanded]:not([data-epic-actions])",
      ),
    ).toBeNull();
  }, 30_000);
  test("the threads list has no Nova thread and no title form: a thread starts from a message (Gimenes #4286)", () => {
    const rendered = sidebar(fixture());
    expect(rendered.target.querySelector("[data-new-epic]")).toBeNull();
    expect(rendered.target.querySelector("#newEpic")).toBeNull();
    expect(rendered.target.textContent).not.toContain("Nova thread");
    expect(rendered.events).toEqual([]);
    rendered.destroy();
  });
  const altDown = (element: Element) =>
    element.dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "ArrowDown",
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
  test("order shortcut submits a full permutation without mutating the room or using stale targets", async () => {
    const room = fixture();
    // Only pinned epics take a hand-made order (the rest follow recency).
    room.epics[0] = { ...room.epics[0], pinned: true };
    room.epics.push({ id: "other", title: "Other", tasks: [], pinned: true });
    const rendered = sidebar(room);
    const down = rendered.target.querySelector<HTMLButtonElement>(
      '[data-epic-thread="e"]',
    )!;
    altDown(down);
    await tick();
    flushSync();
    expect(rendered.events).toEqual([{ t: "epic.order", ids: ["other", "e"] }]);
    expect(room.epics.map((epic) => epic.id)).toEqual(["e", "other"]);
    rendered.view.update({
      ...rendered.props,
      room: { ...room, epics: [room.epics[0]] },
    });
    altDown(down);
    flushSync();
    expect(rendered.events).toHaveLength(1);
  }, 30_000);
  test("confirmed epic ordering restores disabled-control focus without stealing an intervening field", async () => {
    const room = fixture();
    // Only pinned epics take a hand-made order (the rest follow recency).
    room.epics[0] = { ...room.epics[0], pinned: true };
    room.epics.push({ id: "other", title: "Other", tasks: [], pinned: true });
    const rendered = sidebar(room);
    const down = rendered.target.querySelector<HTMLButtonElement>(
      '[data-epic-thread="e"]',
    )!;
    down.focus();
    altDown(down);
    await tick();
    flushSync();
    rendered.view.update({
      ...rendered.props,
      room: { ...room, epics: [room.epics[1], room.epics[0]] },
    });
    await tick();
    await rendered.settle(0, { ok: true });
    await tick();
    flushSync();
    await expectFocusedAfterUpdates(
      rendered.target.querySelector('[data-epic-thread="e"]'),
    );
    expect(
      rendered.target.querySelector("[role=status]")?.textContent,
    ).toContain("Ordem das threads atualizada.");
    rendered.view.update(rendered.props);
    down.focus();
    altDown(down);
    await tick();
    flushSync();
    const draft = otherField(rendered.target);
    draft.focus();
    rendered.view.update({
      ...rendered.props,
      room: { ...room, epics: [room.epics[1], room.epics[0]] },
    });
    await tick();
    await rendered.settle(1, { ok: true });
    await tick();
    flushSync();
    await expectFocusedAfterUpdates(draft);
  }, 30_000);
  test("epic ordering focus callbacks cannot target a replaced room view", async () => {
    const room = fixture();
    // Only pinned epics take a hand-made order (the rest follow recency).
    room.epics[0] = { ...room.epics[0], pinned: true };
    room.epics.push({ id: "other", title: "Other", tasks: [], pinned: true });
    const rendered = sidebar(room);
    const down = rendered.target.querySelector<HTMLButtonElement>(
      '[data-epic-thread="e"]',
    )!;
    down.focus();
    altDown(down);
    flushSync();
    rendered.view.update({
      ...rendered.props,
      room: { ...room, epics: [room.epics[1], room.epics[0]] },
    });
    rendered.destroy();
    const next = sidebar({ ...room, id: "next" });
    const draft = otherField(next.target);
    draft.focus();
    await tick();
    flushSync();
    await expectFocusedAfterUpdates(draft);
  }, 30_000);
  test("repeated room updates preserve keyed navigation rows", () => {
    let room = fixture();
    const target = window.document.createElement("div");
    window.document.body.append(target);
    const sidebarBridge: SidebarProps["vb"] = {
      ...vb,
      epicBusy: () => null,
      waitsIn: () => [],
    };
    const props: SidebarProps = {
      room,
      thread: "e",
      navigation: createNavigationSession(room.id),
      pins: syncPinsSession(null, room),
      request: () => Promise.resolve({ ok: true }),
      onopenpinfile: () => {},
      onopenpinapp: () => {},
      send: () => true,
      onopen: () => {},
      onarchchange: () => {},
      friends: ["friend@test"],
      vb: sidebarBridge,
    };
    const view = mountView("sidebar", target, props);
    active.push(view);
    const row = target.querySelector("[data-epic-thread=e]");
    for (let i = 0; i < 6; i++) {
      room = {
        ...room,
        epics: room.epics.map((e) => ({ ...e, title: `Epic update ${i}` })),
        messages: [
          ...room.messages,
          {
            id: i + 1,
            author: "you@test",
            thread: "e",
            ts: i,
            text: "new activity",
          },
        ],
      };
      view.update({ ...props, room, vb: { ...sidebarBridge } });
      expect(target.querySelector("[data-epic-thread=e]")).toBe(row);
    }
    expect(
      target.querySelector("[data-epic-thread=e] [data-epic-title]")
        ?.textContent,
    ).toBe("Epic update 5");
  }, 30_000);

  test("destroyed pin forms cannot act on the retained session after a sidebar remount", async () => {
    const room = fixture();
    const first = sidebar(room);
    first.target
      .querySelector<HTMLButtonElement>(
        '[data-pins] button[aria-label="Fixar um link"]',
      )!
      .click();
    await tick();
    flushSync();
    const oldInput = first.target.querySelector<HTMLInputElement>(
      "[data-pins] input[name=url]",
    )!;
    oldInput.value = "example.com";
    oldInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    const oldForm =
      first.target.querySelector<HTMLFormElement>("[data-pins] form")!;
    const session = first.props.pins;
    first.destroy();
    expect(session.active).toBe(true);
    const next = sidebar(room, { pins: session });
    oldInput.value = "stale.example";
    oldInput.dispatchEvent(new window.Event("input", { bubbles: true }));
    oldForm.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    flushSync();
    expect(first.events).toEqual([]);
    expect(next.events).toEqual([]);
    expect(
      next.target.querySelector<HTMLInputElement>("[data-pins] input[name=url]")
        ?.value,
    ).toBe("example.com");
    next.target
      .querySelector<HTMLFormElement>("[data-pins] form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    expect(next.events).toEqual([
      { t: "pin.add", kind: "link", ref: "https://example.com/", title: "" },
    ]);
    disposePinsSession(session);
  }, 30_000);

  test("pins queue once, preserve an edited draft and follow canonical updates", async () => {
    const room = fixture();
    const rendered = sidebar(room);
    rendered.target
      .querySelector<HTMLButtonElement>(
        '[data-pins] button[aria-label="Fixar um link"]',
      )!
      .click();
    await tick();
    flushSync();
    const url = rendered.target.querySelector<HTMLInputElement>(
      "[data-pins] input[name=url]",
    )!;
    const title = rendered.target.querySelector<HTMLInputElement>(
      "[data-pins] input[name=title]",
    )!;
    url.value = "example.com";
    url.dispatchEvent(new window.Event("input", { bubbles: true }));
    title.value = "Example";
    title.dispatchEvent(new window.Event("input", { bubbles: true }));
    const form =
      rendered.target.querySelector<HTMLFormElement>("[data-pins] form")!;
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    flushSync();
    expect(rendered.events).toEqual([
      {
        t: "pin.add",
        kind: "link",
        ref: "https://example.com/",
        title: "Example",
      },
    ]);
    expect(rendered.target.querySelectorAll("[data-pin-id]")).toHaveLength(0);
    title.value = "Edited while waiting";
    title.dispatchEvent(new window.Event("input", { bubbles: true }));
    const next = {
      ...room,
      pins: [
        {
          id: "p",
          kind: "link",
          ref: "https://example.com/",
          title: "Example",
        },
      ],
    };
    syncPinsSession(rendered.props.pins, next);
    rendered.view.update({ ...rendered.props, room: next });
    expect(
      rendered.target.querySelector<HTMLInputElement>(
        "[data-pins] input[name=title]",
      )?.value,
    ).toBe("Edited while waiting");
    expect(rendered.target.querySelectorAll("[data-pin-id]")).toHaveLength(1);
    let menu = await pinMenu(rendered, "p");
    // The canonical row is not the correlated ACK.
    expect(menu.item("Desafixar").hasAttribute("data-disabled")).toBe(true);
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settleMenu();
    await rendered.settle(0, { ok: true });
    expect(title.value).toBe("Edited while waiting");
    menu = await pinMenu(rendered, "p");
    expect(menu.item("Desafixar").hasAttribute("data-disabled")).toBe(false);
    menu.item("Desafixar").click();
    await settleMenu();
    // A second unpin while the first is pending is refused.
    menu = await pinMenu(rendered, "p");
    expect(menu.item("Desafixar").hasAttribute("data-disabled")).toBe(true);
    menu.item("Desafixar").click();
    flushSync();
    expect(rendered.events.filter((event) => event.t === "pin.del")).toEqual([
      { t: "pin.del", id: "p" },
    ]);
    expect(rendered.target.querySelectorAll("[data-pin-id]")).toHaveLength(1);
    syncPinsSession(rendered.props.pins, { ...next, pins: [] });
    rendered.view.update({ ...rendered.props, room: { ...next, pins: [] } });
    expect(rendered.target.querySelectorAll("[data-pin-id]")).toHaveLength(0);
    expect(
      rendered.target.querySelector<HTMLButtonElement>(
        "[data-pins] button[type=submit]",
      )?.disabled,
    ).toBe(true);
    await rendered.settle(1, { ok: true });
    expect(
      rendered.target.querySelector<HTMLButtonElement>(
        "[data-pins] button[type=submit]",
      )?.disabled,
    ).toBe(false);
    disposePinsSession(rendered.props.pins);
  }, 30_000);

  async function fillPin(
    rendered: ReturnType<typeof sidebar>,
    url = "example.com",
    title = "Example",
  ) {
    rendered.target
      .querySelector<HTMLButtonElement>(
        '[data-pins] button[aria-label="Fixar um link"]',
      )!
      .click();
    await tick();
    flushSync();
    const input = rendered.target.querySelector<HTMLInputElement>(
      "[data-pins] input[name=url]",
    )!;
    const name = rendered.target.querySelector<HTMLInputElement>(
      "[data-pins] input[name=title]",
    )!;
    input.value = url;
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    name.value = title;
    name.dispatchEvent(new window.Event("input", { bubbles: true }));
    const form =
      rendered.target.querySelector<HTMLFormElement>("[data-pins] form")!;
    return {
      input,
      name,
      submit() {
        form.dispatchEvent(
          new window.Event("submit", { bubbles: true, cancelable: true }),
        );
        flushSync();
      },
    };
  }
  test("pin ACK success unlocks without optimistically inventing a canonical row", async () => {
    const room = fixture(),
      rendered = sidebar(room),
      form = await fillPin(rendered);
    form.submit();
    expect(rendered.events).toHaveLength(1);
    await rendered.settle(0, { ok: true });
    expect(rendered.target.querySelector("[data-pins] form")).toBeNull();
    expect(rendered.target.querySelectorAll("[data-pin-id]")).toHaveLength(0);
    const next = {
      ...room,
      pins: [
        {
          id: "p",
          kind: "link",
          ref: "https://example.com/",
          title: "Example",
        },
      ],
    };
    syncPinsSession(rendered.props.pins, next);
    rendered.view.update({ ...rendered.props, room: next });
    expect(rendered.target.querySelectorAll("[data-pin-id]")).toHaveLength(1);
  }, 30_000);
  test("pin rejection, timeout and offline outcomes preserve the editable draft and permit only manual retries", async () => {
    const rendered = sidebar(fixture()),
      form = await fillPin(rendered);
    form.submit();
    await rendered.settle(0, { ok: false, error: "Pin rejected by server" });
    expect(
      rendered.target.querySelector("[role=alert]")?.textContent,
    ).toContain("Pin rejected by server");
    expect(form.input.value).toBe("example.com");
    expect(form.name.value).toBe("Example");
    form.submit();
    await rendered.settle(1, { ok: false, error: "timeout" });
    expect(
      rendered.target.querySelector("[role=alert]")?.textContent,
    ).toContain("Ainda não recebi confirmação");
    form.submit();
    await rendered.settle(2, { ok: false, error: "offline" });
    expect(
      rendered.target.querySelector("[role=alert]")?.textContent,
    ).toContain("Sem conexão");
    form.submit();
    rendered.outcomes[3].reject(Error("broken transport"));
    await tick();
    flushSync();
    expect(
      rendered.target.querySelector("[role=alert]")?.textContent,
    ).toContain("Não deu pra enviar agora");
    expect(form.input.value).toBe("example.com");
    expect(rendered.events).toHaveLength(4);
    expect(rendered.target.querySelectorAll("[data-pin-id]")).toHaveLength(0);
  }, 30_000);
  test("disposed pin form ACK cannot mutate a new room's pending form", async () => {
    const old = sidebar(fixture()),
      oldForm = await fillPin(old);
    oldForm.submit();
    disposePinsSession(old.props.pins);
    old.destroy();
    const next = sidebar({ ...fixture(), id: "new-room" }),
      current = await fillPin(next, "next.example.com", "Next");
    current.submit();
    await old.settle(0, { ok: true });
    expect(current.input.value).toBe("next.example.com");
    expect(current.name.value).toBe("Next");
    expect(
      next.target.querySelector<HTMLButtonElement>(
        "[data-pins] button[type=submit]",
      )?.disabled,
    ).toBe(true);
    await next.settle(0, { ok: true });
    expect(next.target.querySelector("[data-pins] form")).toBeNull();
  }, 30_000);
  test("duplicate explicit pin submit reports a no-op without calling the Promise request", async () => {
    const room = {
      ...fixture(),
      pins: [
        {
          id: "p",
          kind: "link",
          ref: "https://example.com/",
          title: "Example",
        },
      ],
    };
    const rendered = sidebar(room),
      form = await fillPin(rendered);
    rendered.view.update({
      ...rendered.props,
      room: { ...room, pins: [...room.pins] },
    });
    expect(form.input.value).toBe("example.com");
    form.submit();
    await tick();
    flushSync();
    expect(rendered.events).toEqual([]);
    expect(
      rendered.target.querySelector("[data-pins] [role=status]")?.textContent,
    ).toContain("Este link já está nos fixados");
    expect(rendered.target.querySelector("[data-pins] form")).toBeNull();
  }, 30_000);

  test("file/app pins open typed targets and disposed room actions stay inert", async () => {
    const file = {
      id: "f",
      name: "report.pdf",
      type: "application/pdf",
      size: 20,
      author: "me@test",
      ts: 1,
    };
    const room = {
      ...fixture(),
      files: [file],
      filesAll: true,
      pins: [
        { id: "file", kind: "file", ref: "f" },
        { id: "app", kind: "app", ref: "123456abcdef/chart", title: "Chart" },
        { id: "missing", kind: "file", ref: "gone", title: "Gone" },
      ],
    };
    const files: (typeof file)[] = [];
    const apps: { connectionId: string; tool: string }[] = [];
    const rendered = sidebar(room, {
      onopenpinfile: (file) => files.push(file),
      onopenpinapp: (app) => apps.push(app),
    });
    rendered.target
      .querySelector<HTMLButtonElement>("[data-pin-id=file] button")!
      .click();
    rendered.target
      .querySelector<HTMLButtonElement>("[data-pin-id=app] button")!
      .click();
    expect(files).toEqual([file]);
    expect(apps).toEqual([{ connectionId: "123456abcdef", tool: "chart" }]);
    expect(
      rendered.target.querySelector("[data-pin-id=missing]")?.textContent,
    ).toContain("Arquivo indisponível");
    expect(rendered.target.querySelector("[data-pin-id=missing] a")).toBeNull();
    // A menu opened while the session was live outlives it: its unpin must stay inert.
    const stale = await pinMenu(rendered, "missing");
    disposePinsSession(rendered.props.pins);
    await settleMenu();
    const staleUnpin = window.document.querySelector<HTMLElement>(
      "[data-pin-menu=missing] [data-pin-unpin]",
    );
    expect(staleUnpin).toBe(stale.item("Desafixar"));
    staleUnpin!.click();
    flushSync();
    window.document.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settleMenu();
    expect(window.document.querySelector("[data-pin-menu=missing]")).toBeNull();
    rendered.target
      .querySelector<HTMLButtonElement>("[data-pin-id=file] button")!
      .click();
    rendered.target
      .querySelector<HTMLButtonElement>("[data-pin-id=app] button")!
      .click();
    // And a closed session opens no new menu.
    rendered.target
      .querySelector("[data-pin-id=missing] [data-context-menu-trigger]")!
      .dispatchEvent(
        new window.MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
        }),
      );
    await settleMenu();
    expect(window.document.querySelector("[data-pin-menu=missing]")).toBeNull();
    expect(files).toHaveLength(1);
    expect(apps).toHaveLength(1);
    expect(rendered.events).toEqual([]);
  }, 30_000);

  test("pinned rows show their kind and what a click does, with no hover unpin button", () => {
    const file = {
      id: "f",
      name: "roadmap.pdf",
      type: "application/pdf",
      size: 2_100_000,
      author: "me@test",
      ts: 1,
    };
    const room = {
      ...fixture(),
      files: [file],
      filesAll: true,
      pins: [
        { id: "site", kind: "link", ref: "https://vibebook.dev/" },
        {
          id: "repo",
          kind: "link",
          ref: "https://github.com/decocms/chat",
          title: "Repo",
        },
        {
          id: "app",
          kind: "app",
          ref: "123456abcdef/router",
          title: "Roteador A/B",
        },
        { id: "doc", kind: "file", ref: "f" },
      ],
    };
    const open = writable<{ connection: string; tool: string } | null>(null);
    const apps: { connectionId: string; tool: string }[] = [];
    const rendered = sidebar(room, {
      activePinApp: open,
      onopenpinapp: (app) => apps.push(app),
    });
    const row = (id: string) =>
      rendered.target.querySelector<HTMLLIElement>(`[data-pin-id=${id}]`)!;

    const site = row("site");
    expect(site.dataset.pinKind).toBe("link");
    expect(site.dataset.pinOpens).toBe("tab");
    expect(
      site.querySelector("[data-pin-icon]")?.getAttribute("data-pin-icon"),
    ).toBe("globe");
    const link = site.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://vibebook.dev/");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.textContent).toContain("vibebook.dev");
    expect(link.textContent).toContain("abre em nova aba");
    // Only local SVG; no favicon or other third-party request.
    expect(site.querySelector("img")).toBeNull();

    const repo = row("repo");
    expect(
      repo.querySelector("[data-pin-icon]")?.getAttribute("data-pin-icon"),
    ).toBe("github");
    expect(repo.textContent).toContain("github.com/decocms/chat");
    expect(repo.dataset.pinOpens).toBe("tab");

    const app = row("app");
    expect(app.dataset.pinKind).toBe("app");
    expect(app.dataset.pinOpens).toBe("inline");
    expect(app.querySelector("a")).toBeNull();
    // The app's tile is the marble its name draws, like a room's: no initials.
    expect(app.querySelector("[data-pin-icon=tile] svg")).not.toBeNull();
    expect(app.querySelector("[data-pin-icon=tile]")?.textContent?.trim()).toBe(
      "",
    );
    const appButton = app.querySelector<HTMLButtonElement>("button")!;
    expect(appButton.textContent).toContain("Roteador A/B");
    expect(appButton.textContent).toContain("App");
    expect(appButton.hasAttribute("aria-current")).toBe(false);
    expect(app.dataset.selected).toBeUndefined();
    appButton.click();
    expect(apps).toEqual([{ connectionId: "123456abcdef", tool: "router" }]);

    const doc = row("doc");
    expect(doc.dataset.pinKind).toBe("file");
    expect(doc.dataset.pinOpens).toBe("inline");
    expect(doc.querySelector("[data-pin-icon=file]")).not.toBeNull();
    expect(doc.textContent).toContain("PDF · 2.1 MB");

    // No row reserves room for a hover button any more: names use the full width.
    expect(
      rendered.target.querySelector(
        "[data-pins] li button[aria-label^=Desafixar]",
      ),
    ).toBeNull();
    for (const id of ["site", "repo", "app", "doc"]) {
      const label = row(id).querySelector<HTMLElement>("[data-pin-text]")!;
      expect(label.className.split(/\s+/)).not.toContain("pr-7");
      expect(row(id).querySelectorAll("button, a")).toHaveLength(1);
    }

    open.set({ connection: "123456abcdef", tool: "router" });
    flushSync();
    expect(app.dataset.selected).toBe("true");
    expect(app.className.split(/\s+/)).toContain("bg-sidebar-accent");
    expect(appButton.getAttribute("aria-current")).toBe("true");
    open.set({ connection: "room", tool: "router" });
    flushSync();
    expect(app.dataset.selected).toBeUndefined();
    open.set(null);
    flushSync();
    expect(app.className.split(/\s+/)).not.toContain("bg-sidebar-accent");
  }, 30_000);

  test("pin rows open a context menu per kind; Desafixar unpins, Copiar link copies, keyboard opens it", async () => {
    const file = {
      id: "f",
      name: "roadmap.pdf",
      type: "application/pdf",
      size: 2_100,
      author: "me@test",
      ts: 1,
    };
    const room = {
      ...fixture(),
      files: [file],
      filesAll: true,
      pins: [
        { id: "site", kind: "link", ref: "https://vibebook.dev/docs" },
        { id: "app", kind: "app", ref: "123456abcdef/router", title: "Router" },
        { id: "doc", kind: "file", ref: "f" },
        { id: "gone", kind: "file", ref: "missing", title: "Gone" },
      ],
    };
    const files: (typeof file)[] = [];
    const apps: { connectionId: string; tool: string }[] = [];
    const rendered = sidebar(room, {
      onopenpinfile: (selected) => files.push(selected),
      onopenpinapp: (app) => apps.push(app),
    });
    const copied: string[] = [];
    window.navigator.clipboard.writeText = async (text) => {
      copied.push(text);
    };
    const opened: unknown[][] = [];
    const originalOpen = window.open;
    window.open = ((...args: unknown[]) => {
      opened.push(args);
      return null;
    }) as typeof window.open;
    try {
      let menu = await pinMenu(rendered, "site");
      expect(menu.labels).toEqual([
        "Abrir em nova aba",
        "Copiar link",
        "---",
        "Desafixar",
      ]);
      expect(menu.item("Desafixar").className.split(/\s+/)).toContain(
        "text-destructive",
      );
      menu.item("Copiar link").click();
      await settleMenu();
      expect(copied).toEqual(["https://vibebook.dev/docs"]);
      expect(window.document.querySelector("[data-pin-menu=site]")).toBeNull();
      const copyNote = () =>
        rendered.target.querySelector<HTMLElement>("[data-pin-copy]");
      expect(copyNote()?.getAttribute("role")).toBe("status");
      expect(copyNote()?.textContent?.trim()).toBe("Link copiado");
      // A blocked clipboard says so instead of failing silently.
      const writeText = window.navigator.clipboard.writeText;
      const execCommand = window.document.execCommand;
      window.navigator.clipboard.writeText = async () => {
        throw new Error("blocked");
      };
      window.document.execCommand = () => false;
      try {
        menu = await pinMenu(rendered, "site");
        menu.item("Copiar link").click();
        await settleMenu();
        expect(copyNote()?.getAttribute("role")).toBe("alert");
        expect(copyNote()?.textContent?.trim()).toBe(
          "Não consegui copiar o link.",
        );
      } finally {
        window.navigator.clipboard.writeText = writeText;
        window.document.execCommand = execCommand;
      }
      // Every row points at its menu shortcut; the broken row is a menu button.
      const hint = rendered.target.querySelector<HTMLElement>(
        "[data-pins] .sr-only[id]",
      )!;
      expect(hint.textContent).toBe("Shift+F10 abre mais ações");
      for (const id of ["site", "app", "doc", "gone"])
        expect(
          rendered.target
            .querySelector(`[data-pin-id=${id}] [data-context-menu-trigger]`)!
            .getAttribute("aria-describedby"),
        ).toBe(hint.id);
      const goneRow = rendered.target.querySelector(
        "[data-pin-id=gone] [data-context-menu-trigger]",
      )!;
      expect(goneRow.getAttribute("role")).toBe("button");
      expect(goneRow.getAttribute("aria-haspopup")).toBe("menu");
      expect(
        rendered.target
          .querySelector("[data-pin-id=site] a")!
          .hasAttribute("title"),
      ).toBe(false);

      menu = await pinMenu(rendered, "site");
      menu.item("Abrir em nova aba").click();
      await settleMenu();
      expect(opened).toEqual([
        ["https://vibebook.dev/docs", "_blank", "noopener,noreferrer"],
      ]);

      // No standalone URL exists for an app or a download URL for a file in the room data: those items are omitted.
      menu = await pinMenu(rendered, "app");
      expect(menu.labels).toEqual(["Abrir", "---", "Desafixar"]);
      menu.item("Abrir").click();
      await settleMenu();
      expect(apps).toEqual([{ connectionId: "123456abcdef", tool: "router" }]);

      menu = await pinMenu(rendered, "doc");
      expect(menu.labels).toEqual(["Abrir", "---", "Desafixar"]);
      menu.item("Abrir").click();
      await settleMenu();
      expect(files).toEqual([file]);

      menu = await pinMenu(rendered, "gone", "enter");
      expect(menu.labels).toEqual(["Desafixar"]);
      // The broken row is focusable, so the keyboard can reach its menu.
      expect(menu.trigger.tabIndex).toBe(0);
      window.document.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await settleMenu();
      expect(window.document.querySelector("[data-pin-menu=gone]")).toBeNull();

      // A ~500ms touch long press opens the menu; the tap that ends it does not also open the pin.
      const docRow = rendered.target.querySelector<HTMLElement>(
        "[data-pin-id=doc] [data-context-menu-trigger]",
      )!;
      docRow.dispatchEvent(
        new window.PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: 30,
          clientY: 30,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      await settleMenu();
      expect(
        window.document.querySelector("[data-pin-menu=doc]"),
      ).not.toBeNull();
      docRow.dispatchEvent(
        new window.PointerEvent("pointerup", {
          bubbles: true,
          pointerType: "touch",
        }),
      );
      docRow.dispatchEvent(
        new window.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          detail: 1,
        }),
      );
      expect(files).toEqual([file]);
      window.document.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await settleMenu();
      // Moving the finger (a scroll) cancels the long press.
      docRow.dispatchEvent(
        new window.PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
          clientX: 30,
          clientY: 30,
        }),
      );
      docRow.dispatchEvent(
        new window.PointerEvent("pointermove", {
          bubbles: true,
          pointerType: "touch",
          clientX: 30,
          clientY: 60,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 600));
      await settleMenu();
      expect(
        window.document.querySelector("[data-pin-menu=doc][data-state=open]"),
      ).toBeNull();

      // Shift+F10 on the focused row opens the same menu with its first item focused.
      menu = await pinMenu(rendered, "doc", "keyboard");
      expect(menu.labels).toEqual(["Abrir", "---", "Desafixar"]);
      expect(window.document.activeElement).toBe(menu.item("Abrir"));
      menu.item("Desafixar").click();
      await settleMenu();
      expect(rendered.events.filter((event) => event.t === "pin.del")).toEqual([
        { t: "pin.del", id: "doc" },
      ]);
      await rendered.settle(0, { ok: true });
      // The row goes once the room drops the pin; focus moves to the row that took its place, not to <body>.
      (window.document.activeElement as HTMLElement | null)?.blur();
      rendered.view.update({
        ...rendered.props,
        room: {
          ...room,
          pins: room.pins.filter((pin) => pin.id !== "doc"),
        },
      });
      await settleMenu();
      expect(rendered.target.querySelector("[data-pin-id=doc]")).toBeNull();
      expect(window.document.activeElement).toBe(
        rendered.target.querySelector(
          "[data-pin-id=gone] [data-context-menu-trigger]",
        ),
      );

      // The ContextMenu key works too.
      const site = rendered.target.querySelector<HTMLElement>(
        "[data-pin-id=site] a",
      )!;
      site.focus();
      site.dispatchEvent(
        new window.KeyboardEvent("keydown", {
          key: "ContextMenu",
          bubbles: true,
          cancelable: true,
        }),
      );
      await settleMenu();
      expect(
        window.document.querySelector("[data-pin-menu=site]"),
      ).not.toBeNull();
      window.document.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      await settleMenu();
      // A plain click still follows the link (not prevented) and opens no menu.
      const plain = new window.MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        detail: 1,
      });
      let followed = false;
      site.addEventListener(
        "click",
        (event) => {
          // The row's own handlers ran first; happy-dom must not navigate.
          followed = !event.defaultPrevented;
          event.preventDefault();
        },
        { once: true },
      );
      site.dispatchEvent(plain);
      expect(followed).toBe(true);
      expect(window.document.querySelector("[data-pin-menu=site]")).toBeNull();
      // A plain click on an app row opens it.
      rendered.target
        .querySelector<HTMLButtonElement>("[data-pin-id=app] button")!
        .click();
      expect(apps).toHaveLength(2);
      expect(window.document.querySelector("[data-pin-menu=app]")).toBeNull();
    } finally {
      window.open = originalOpen;
    }
    disposePinsSession(rendered.props.pins);
  }, 30_000);

  test("partial pinned-file metadata loads once and opens the current file after canonical resolution", () => {
    const newest = {
      id: "new",
      name: "new.txt",
      type: "text/plain",
      size: 5,
      author: "me@test",
      ts: 2,
    };
    const old = {
      ...newest,
      id: "old",
      name: "older-report.pdf",
      type: "application/pdf",
      ts: 1,
    };
    const room = {
      ...fixture(),
      files: [newest],
      filesAll: false,
      pins: [{ id: "p", kind: "file", ref: "old", title: "Older report" }],
    };
    const opened: (typeof old)[] = [];
    const rendered = sidebar(room, {
      onopenpinfile: (file) => opened.push(file),
    });
    expect(
      rendered.target.querySelector("[data-pin-id=p]")?.textContent,
    ).not.toContain("Arquivo indisponível");
    expect(rendered.target.querySelector("[data-pins]")).not.toBeNull();
    requestPinnedFiles(rendered.props.pins, room, rendered.props.send);
    flushSync();
    rendered.target
      .querySelector<HTMLButtonElement>("[data-pin-id=p] button")!
      .click();
    flushSync();
    requestPinnedFiles(rendered.props.pins, { ...room }, rendered.props.send);
    expect(rendered.events).toEqual([{ t: "files.get" }]);
    expect(opened).toEqual([]);
    const full = { ...room, files: [newest, old], filesAll: true };
    syncPinsSession(rendered.props.pins, full);
    rendered.view.update({ ...rendered.props, room: full });
    flushSync();
    expect(opened).toEqual([old]);
    rendered.view.update({ ...rendered.props, room: { ...full } });
    flushSync();
    expect(opened).toHaveLength(1);
    // Fresh socket snapshots return to a partial index. An explicit click must recover it.
    syncPinsSession(rendered.props.pins, room);
    rendered.view.update({ ...rendered.props, room });
    flushSync();
    rendered.target
      .querySelector<HTMLButtonElement>("[data-pin-id=p] button")!
      .click();
    flushSync();
    expect(rendered.events).toEqual([{ t: "files.get" }, { t: "files.get" }]);
    expect(opened).toHaveLength(1);
    const latest = { ...old, name: "latest-report.pdf" };
    const reloaded = { ...room, files: [newest, latest], filesAll: true };
    syncPinsSession(rendered.props.pins, reloaded);
    rendered.view.update({ ...rendered.props, room: reloaded });
    flushSync();
    expect(opened).toEqual([old, latest]);
    disposePinsSession(rendered.props.pins);
  }, 30_000);
  test("metadata received after room disposal does not open a formerly requested pin", () => {
    const file = {
      id: "old",
      name: "old.pdf",
      type: "application/pdf",
      size: 20,
      author: "me@test",
      ts: 1,
    };
    const room = {
      ...fixture(),
      files: [],
      filesAll: false,
      pins: [{ id: "p", kind: "file", ref: "old" }],
    };
    const opened: (typeof file)[] = [];
    const rendered = sidebar(room, {
      onopenpinfile: (file) => opened.push(file),
    });
    rendered.target
      .querySelector<HTMLButtonElement>("[data-pin-id=p] button")!
      .click();
    flushSync();
    expect(rendered.events).toEqual([{ t: "files.get" }]);
    disposePinsSession(rendered.props.pins);
    rendered.view.update({
      ...rendered.props,
      room: { ...room, files: [file], filesAll: true },
    });
    flushSync();
    expect(opened).toEqual([]);
  }, 30_000);
});

describe("People interactions", () => {
  type PeopleProps = ComponentProps<typeof People>;
  const personRoom = (): Room => ({
    ...fixture(),
    me: "owner@test.com",
    book: { title: "People room", owner: "owner@test.com" },
    members: ["owner@test.com", "member@test.com", "pending@test.com"],
    online: ["member@test.com"],
    pending: ["pending@test.com"],
    requests: [
      { email: "ask@test.com", name: "<script>untrusted()</script>", ts: 1 },
    ],
  });
  function pendingPeopleRequest() {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    return { promise, resolve, reject };
  }
  function people(room: Room, extra: Partial<PeopleProps> = {}) {
    const target = document.createElement("div");
    document.body.append(target);
    const props: PeopleProps = {
      room,
      vb,
      friends: ["friend@test.com"],
      ...extra,
    };
    const values = writable<Record<string, unknown>>(props);
    // As in mountView, the prop bag is checked before this dynamic forwarding boundary.
    const component = People as unknown as Component<Record<string, unknown>>;
    const instance = flushSync(() =>
      mount(PeopleView, { target, props: { component, values } }),
    );
    let active = true;
    const destroy = () => {
      if (!active) return;
      active = false;
      flushSync(() => {
        void unmount(instance);
      });
      target.remove();
    };
    peopleCleanups.push(destroy);
    return {
      target,
      update(next: Room) {
        flushSync(() => values.set({ ...props, room: next }));
      },
      destroy,
    };
  }
  async function settlePeopleDialogClose() {
    // Bits keeps closed content through an exit animation frame; tick only drains Svelte work.
    for (
      let frame = 0;
      frame < 10 && document.querySelector('[role="alertdialog"]');
      frame++
    ) {
      await new Promise<void>((resolve) =>
        window.requestAnimationFrame(() => resolve()),
      );
      flushSync();
      await tick();
    }
    expect(document.querySelector('[role="alertdialog"]') === null).toBe(true);
  }
  function inviteForm() {
    return document.querySelector<HTMLFormElement>("#invite")!;
  }
  function inviteSearch() {
    return document.querySelector<HTMLInputElement>("#invite input")!;
  }
  function submitInvite() {
    inviteForm().dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    flushSync();
  }
  function typeInvite(text: string) {
    const input = inviteSearch();
    input.value = text;
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    flushSync();
    return input;
  }
  /** Open the invite row, type an email and press Enter (submits the row's form). */
  function submitPeopleInvite(target: HTMLElement, email: string) {
    openInvite(target);
    const input = typeInvite(email);
    submitInvite();
    return input;
  }
  test("a joined person's name opens your DM with them; an invite waiting has no link", async () => {
    const opened: string[] = [];
    const rendered = people(personRoom(), {
      onopen: async (email: string) => {
        opened.push(email);
        return "dm";
      },
    });
    const link = rendered.target.querySelector<HTMLButtonElement>(
      '[data-open-dm="member@test.com"]',
    );
    expect(link).not.toBeNull();
    expect(
      rendered.target.querySelector('[data-open-dm="pending@test.com"]'),
    ).toBeNull();
    link!.click();
    link!.click(); // a double click opens it once
    await Promise.resolve();
    expect(opened).toEqual(["member@test.com"]);
  });
  test("owner and member see the authorized removal controls and plain-text access requests", () => {
    const room = personRoom();
    const rendered = people(room);
    expect(
      rendered.target.querySelector('[data-remove="owner@test.com"]') === null,
    ).toBe(true);
    expect(
      rendered.target.querySelector('[data-remove="member@test.com"]') !== null,
    ).toBe(true);
    expect(
      rendered.target.querySelector('[data-remove="pending@test.com"]') !==
        null,
    ).toBe(true);
    expect(rendered.target.querySelector("script") === null).toBe(true);
    expect(rendered.target.textContent).toContain(
      "<script>untrusted()</script>",
    );
    rendered.update({ ...room, me: "member@test.com" });
    expect(
      rendered.target.querySelector('[data-remove="owner@test.com"]') === null,
    ).toBe(true);
    expect(
      rendered.target.querySelector('[data-remove="member@test.com"]') === null,
    ).toBe(true);
    expect(
      rendered.target.querySelector('[data-remove="pending@test.com"]') !==
        null,
    ).toBe(true);
    expect(
      rendered.target.querySelector(
        '[data-ask="ask@test.com"][data-ok="1"]',
      ) !== null,
    ).toBe(true);
  });
  for (const action of ["remove", "deny"] as const) {
    test(`People ${action} confirms, restores cancel focus, and ignores late failure after canonical disappearance`, async () => {
      const room = personRoom();
      const reply = pendingPeopleRequest();
      const calls: { action: string; email: string }[] = [];
      const rendered = people(room, {
        request: (kind: PeopleAction, email: string) => {
          calls.push({ action: kind, email });
          return reply.promise;
        },
      });
      const email = action === "remove" ? "member@test.com" : "ask@test.com";
      const selector =
        action === "remove"
          ? `[data-remove="${email}"]`
          : `[data-ask="${email}"][data-ok=""]`;
      const trigger =
        rendered.target.querySelector<HTMLButtonElement>(selector)!;
      trigger.focus();
      trigger.click();
      flushSync();
      await tick();
      const cancel = document.querySelector<HTMLButtonElement>(
        "[data-alert-dialog-cancel]",
      )!;
      expect(document.activeElement === cancel).toBe(true);
      expect(calls).toEqual([]);
      cancel.click();
      flushSync();
      await tick();
      await settlePeopleDialogClose();
      expect(document.activeElement === trigger).toBe(true);
      expect(calls).toEqual([]);
      trigger.click();
      flushSync();
      await tick();
      document
        .querySelector<HTMLButtonElement>("[data-alert-dialog-action]")!
        .click();
      flushSync();
      await tick();
      expect(calls).toEqual([{ action, email }]);
      expect(trigger.disabled).toBe(true);
      expect(rendered.target.querySelector(selector) !== null).toBe(true);
      rendered.update(
        action === "remove"
          ? {
              ...room,
              members: room.members.filter((member) => member !== email),
            }
          : { ...room, requests: [] },
      );
      await tick();
      await settlePeopleDialogClose();
      expect(rendered.target.querySelector(selector) === null).toBe(true);
      expect(
        document.activeElement ===
          rendered.target.querySelector("[data-people-panel]"),
      ).toBe(true);
      reply.reject(new Error("obsolete request rejected"));
      await tick();
      flushSync();
      expect(rendered.target.textContent).not.toContain(
        "obsolete request rejected",
      );
      expect(rendered.target.querySelector('[role="alert"]') === null).toBe(
        true,
      );
    }, 30_000);
  }
  async function settle() {
    flushSync();
    await tick();
    flushSync();
  }
  test("a typed email in the invite row is sent on Enter, the row closes and the person follows the server", async () => {
    const room = personRoom();
    const reply = pendingPeopleRequest();
    const calls: string[] = [];
    const copied: string[] = [];
    window.navigator.clipboard.writeText = async (text) => {
      copied.push(text);
    };
    const rendered = people(room, {
      request: (action: PeopleAction, email: string) => {
        calls.push(`${action}:${email}`);
        return reply.promise;
      },
    });
    submitPeopleInvite(rendered.target, "NEW@TEST.COM");
    await settle();
    expect(calls).toEqual(["invite:new@test.com"]);
    // Inviting never writes to the clipboard by itself.
    expect(copied).toEqual([]);
    expect(rendered.target.textContent).toContain(
      "new@test.com · Aguardando confirmação…",
    );
    expect(inviteForm().classList.contains("hidden")).toBe(false);
    reply.resolve();
    await settle();
    expect(inviteForm().classList.contains("hidden")).toBe(true);
    expect(inviteSearch().value).toBe("");
    // No "sent" line: the invited person's row is the confirmation.
    expect(rendered.target.textContent).not.toContain("enviado");
    rendered.update({
      ...room,
      members: [...room.members, "new@test.com"],
      pending: [...room.pending!, "new@test.com"],
    });
    const row = rendered.target.querySelector('[data-person="new@test.com"]');
    expect(row !== null).toBe(true);
    expect(row!.querySelector('[data-copyinv="new@test.com"]') !== null).toBe(
      true,
    );
    expect(rendered.target.textContent).not.toContain(
      "Aguardando confirmação…",
    );
  });
  test("a rejected invite keeps the row open with the typed email and the error", async () => {
    let fail = true;
    const calls: string[] = [];
    const rendered = people(personRoom(), {
      request: async (action: PeopleAction, email: string) => {
        calls.push(`${action}:${email}`);
        if (fail) throw new Error("invitation rejected");
      },
    });
    submitPeopleInvite(rendered.target, "new@test.com");
    await settle();
    expect(calls).toEqual(["invite:new@test.com"]);
    expect(inviteForm().classList.contains("hidden")).toBe(false);
    expect(inviteSearch().value).toBe("new@test.com");
    expect(rendered.target.textContent).toContain(
      "new@test.com · invitation rejected",
    );
    fail = false;
    submitInvite();
    await settle();
    expect(calls).toEqual(["invite:new@test.com", "invite:new@test.com"]);
    expect(inviteForm().classList.contains("hidden")).toBe(true);
  });
  test("Escape or ✕ closes the invite row, clears it and gives focus back to +", async () => {
    const rendered = people(personRoom());
    openInvite(rendered.target);
    await settle();
    expect(document.activeElement).toBe(inviteSearch());
    typeInvite("half@");
    inviteSearch().dispatchEvent(
      new window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    await settle();
    expect(inviteForm().classList.contains("hidden")).toBe(true);
    expect(inviteSearch().value).toBe("");
    expect(document.activeElement).toBe(
      rendered.target.querySelector("[data-invite-toggle]"),
    );
    openInvite(rendered.target);
    await settle();
    inviteForm()
      .querySelector<HTMLButtonElement>('button[aria-label="Cancelar"]')!
      .click();
    await settle();
    expect(inviteForm().classList.contains("hidden")).toBe(true);
  });
  test("the invite row suggests friends who are not in the room yet", () => {
    const room = personRoom();
    const rendered = people(room, {
      friends: ["friend@test.com", "member@test.com", "pending@test.com"],
    });
    openInvite(rendered.target);
    const list = document.getElementById(inviteSearch().getAttribute("list")!);
    expect(
      [...list!.querySelectorAll("option")].map((option) => option.value),
    ).toEqual(["friend@test.com"]);
  });
  test("an email that is invalid or already in the room is refused without a request", async () => {
    const calls: string[] = [];
    const rendered = people(personRoom(), {
      request: async (action: PeopleAction, email: string) => {
        calls.push(`${action}:${email}`);
      },
    });
    submitPeopleInvite(rendered.target, "member@test.com");
    await settle();
    expect(rendered.target.textContent).toContain(
      "member@test.com · Esta pessoa já está na sala.",
    );
    typeInvite("not-an-email");
    submitInvite();
    await settle();
    expect(rendered.target.textContent).toContain(
      "not-an-email · Email inválido.",
    );
    expect(calls).toEqual([]);
  });
  test("keyed room replacement disposes old invitations", async () => {
    const room = personRoom();
    const reply = pendingPeopleRequest();
    const calls: string[] = [];
    const rendered = people(room, {
      request: (action: PeopleAction, email: string) => {
        calls.push(`${action}:${email}`);
        return reply.promise;
      },
    });
    submitPeopleInvite(rendered.target, "old@test.com");
    expect(calls).toEqual(["invite:old@test.com"]);
    rendered.update({
      ...room,
      id: "next",
      book: { ...room.book, title: "Next room" },
    });
    reply.resolve();
    await settle();
    expect(calls).toEqual(["invite:old@test.com"]);
    expect(document.body.textContent).not.toContain("old@test.com");
    expect(document.body.textContent).not.toContain("enviado ✓");
    rendered.destroy();
  });
  test("copy on a pending person writes that person's invite message", async () => {
    const copied: string[] = [];
    window.navigator.clipboard.writeText = async (text) => {
      copied.push(text);
    };
    const rendered = people(personRoom());
    rendered.target
      .querySelector<HTMLButtonElement>('[data-copyinv="pending@test.com"]')!
      .click();
    await settle();
    expect(copied).toHaveLength(1);
    expect(copied[0]).toContain("pending@test.com");
    expect(copied[0]).toContain("/b/r");
    expect(
      rendered.target.querySelector('[data-invite-clipboard="copied"]') !==
        null,
    ).toBe(true);
  });
  test("people are listed flat, online first, each with a presence dot", () => {
    const rendered = people(personRoom());
    const rows = [
      ...rendered.target.querySelectorAll<HTMLElement>("[data-person]"),
    ];
    expect(rows.map((row) => row.dataset.person)).toEqual([
      "owner@test.com",
      "member@test.com",
      "pending@test.com",
    ]);
    expect(
      rows.map(
        (row) =>
          row.querySelector("[data-presence]")?.getAttribute("data-presence") ??
          null,
      ),
    ).toEqual(["online", "online", null]);
    expect(rows[2]!.textContent).toContain("aguardando");
    expect(
      rendered.target.querySelector("[data-people-panel]")?.textContent,
    ).toContain("Convidados");
  });
  test("an invite turned down reads recusou, with no resend and no remove", () => {
    const rendered = people({
      ...personRoom(),
      pending: [],
      declined: ["pending@test.com"],
    });
    const row = rendered.target.querySelector<HTMLElement>(
      '[data-person="pending@test.com"]',
    )!;
    expect(row.textContent).toContain("recusou");
    expect(row.querySelector("[data-resend]")).toBeNull();
    expect(row.querySelector("[data-remove]")).toBeNull();
  });
});

describe("composer ownership and interactions", () => {
  const chatBridge: import("../web/app/chatTypes").ChatBridge = {
    t: vb.t,
    name: vb.name,
    avatarVersion: vb.avatarVersion,
    ago: vb.ago,
    hhmm: () => "09:00",
    waiting: () => false,
    locale: "pt-BR",
  };
  const attachment = (id = "aa11"): import("../shared/room").Attachment => ({
    id,
    name: "note.txt",
    type: "text/plain",
    size: 1,
    author: "me@test",
    ts: 1,
  });
  function renderComposer(
    room: Room,
    extra: Partial<import("../web/features/composer/types").ComposerProps> = {},
  ) {
    const drafts = createComposerDrafts();
    peopleCleanups.push(() => drafts.dispose());
    const target = document.createElement("main"),
      slot = document.createElement("div");
    target.append(slot);
    document.body.append(target);
    const props: import("../web/features/composer/types").ComposerProps = {
      room,
      thread: "main",
      vb: chatBridge,
      drafts,
      request: async () => ({ ok: false, error: "offline" }),
      upload: async () => attachment(),
      navigate: () => {},
      ...extra,
    };
    const view = mountView("composer", slot, props);
    active.push(view);
    return {
      target,
      drafts,
      entry: drafts.entry({
        account: room.me,
        roomId: room.id,
        thread: props.thread,
      }),
      update(next: Room, thread = props.thread) {
        view.update({ ...props, room: next, thread });
      },
      destroy() {
        const at = active.indexOf(view);
        if (at >= 0) active.splice(at, 1);
        view.destroy();
      },
    };
  }
  function edit(target: Element, value: string) {
    const input = target.querySelector<HTMLTextAreaElement>("textarea")!;
    input.value = value;
    input.setSelectionRange(value.length, value.length);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    flushSync();
    return input;
  }
  async function dialogClosed() {
    for (
      let frame = 0;
      frame < 10 && document.querySelector('[role="dialog"]');
      frame++
    )
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    flushSync();
    expect(document.querySelector('[role="dialog"]') === null).toBe(true);
  }
  test("composer Enter empties the box as it sends; Shift/IME never submit", async () => {
    const room = fixture(),
      sent: RoomCommand[] = [];
    let resolve!: (outcome: CommandOutcome) => void;
    const { target, update } = renderComposer(room, {
      request: (command) => {
        sent.push(command);
        return new Promise((done) => (resolve = done));
      },
    });
    const input = edit(target, "keep until canonical");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(sent).toHaveLength(0);
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(sent[0]).toMatchObject({
      t: "msg",
      thread: "main",
      text: "keep until canonical",
    });
    // The box empties as the message leaves (Valls #4167), before the room confirms it.
    flushSync();
    expect(input.value).toBe("");
    resolve({ ok: true });
    await tick();
    flushSync();
    update({
      ...room,
      messages: [
        {
          id: 1,
          thread: "main",
          author: room.me,
          kind: null,
          text: "keep until canonical",
          ts: 1,
        },
      ],
    });
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "",
    );
  }, 30_000);
  test("composer mention keyboard selection and emoji replace the saved selection without submitting", async () => {
    const room = { ...fixture(), names: { "you@test": "José Silva" } };
    const { target } = renderComposer(room);
    const input = edit(target, "@jo");
    expect(target.querySelector('[role="listbox"]')?.textContent).toContain(
      "@jose",
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      }),
    );
    await tick();
    flushSync();
    expect(input.value).toBe("@jose ");
    edit(target, "before selected after");
    input.setSelectionRange(7, 15);
    input.dispatchEvent(new Event("select", { bubbles: true }));
    target
      .querySelector<HTMLButtonElement>('button[aria-label="Emoji"]')!
      .click();
    flushSync();
    await tick();
    const fire = document.querySelector<HTMLButtonElement>(
      '[role="dialog"] button[aria-label=":fire:"]',
    )!;
    expect(fire !== null).toBe(true);
    fire.click();
    await tick();
    flushSync();
    await dialogClosed();
    expect(input.value).toBe("before 🔥 after");
  }, 30_000);
  test("more menu keyboard focus and thread drafts stay scoped across remounts", async () => {
    const room = fixture();
    const { target, update } = renderComposer(room);
    edit(target, "main draft");
    const more = target.querySelector<HTMLButtonElement>(
      "[data-composer-more]",
    )!;
    more.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();
    await tick();
    const items = target.querySelectorAll<HTMLButtonElement>(
      '[role="menu"] button',
    );
    // Attach, mention and poll (no "O que precisa de mim aqui?", Gimenes #4155).
    expect(items.length).toBe(3);
    expect(document.activeElement === items[0]).toBe(true);
    items[0].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement === items[1]).toBe(true);
    items[1].dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    flushSync();
    expect(target.querySelector('[role="menu"]') === null).toBe(true);
    update(room, "e");
    edit(target, "epic draft");
    update(room, "main");
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "main draft",
    );
    update(room, "e");
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "epic draft",
    );
  }, 30_000);
  test("attachment upload removal aborts and revokes preview; late completion cannot repopulate tray", async () => {
    const originalCreate = URL.createObjectURL,
      originalRevoke = URL.revokeObjectURL,
      revoked: string[] = [];
    URL.createObjectURL = () => "blob:composer-fixture";
    URL.revokeObjectURL = (url) => revoked.push(url);
    peopleCleanups.push(() => {
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    });
    let resolve!: (meta: import("../shared/schemas").UploadFileResult) => void,
      signal: AbortSignal | undefined;
    const { target } = renderComposer(fixture(), {
      upload: (_input, owner) => {
        signal = owner;
        return new Promise((done) => (resolve = done));
      },
    });
    const transfer = new window.DataTransfer();
    transfer.items.add(
      new window.File([new Uint8Array([1])], "photo.png", {
        type: "image/png",
      }),
    );
    const input = target.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, "files", {
      configurable: true,
      value: transfer.files,
    });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    flushSync();
    expect(
      target.querySelector('img[src="blob:composer-fixture"]') !== null,
    ).toBe(true);
    target
      .querySelector<HTMLButtonElement>('button[aria-label="Remover anexo"]')!
      .click();
    flushSync();
    expect(signal?.aborted).toBe(true);
    expect(revoked).toContain("blob:composer-fixture");
    resolve({ ...attachment(), name: "photo.png", type: "image/png" });
    await tick();
    flushSync();
    expect(target.querySelector("[data-composer-attachment]") === null).toBe(
      true,
    );
  }, 30_000);
  test("foreign modal paste never starts a hidden upload but composer paste still works", async () => {
    let uploads = 0;
    const { target } = renderComposer(fixture(), {
      upload: async () => {
        uploads++;
        return attachment();
      },
    });
    target.querySelector<HTMLButtonElement>("[data-composer-more]")!.click();
    flushSync();
    await tick();
    Array.from(
      target.querySelectorAll<HTMLButtonElement>('[role="menu"] button'),
    )
      .find((button) => button.textContent?.includes("Criar votação"))!
      .click();
    flushSync();
    await tick();
    const transfer = new window.DataTransfer();
    transfer.items.add(
      new window.File([new Uint8Array([1])], "note.txt", {
        type: "text/plain",
      }),
    );
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: transfer });
    document
      .querySelector<HTMLButtonElement>('[role="dialog"] [data-dialog-close]')!
      .dispatchEvent(event);
    expect(uploads).toBe(0);
    document
      .querySelector<HTMLButtonElement>('[role="dialog"] [data-dialog-close]')!
      .click();
    await tick();
    flushSync();
    await dialogClosed();
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: transfer });
    target.querySelector<HTMLTextAreaElement>("textarea")!.dispatchEvent(paste);
    expect(uploads).toBe(1);
  }, 30_000);
  test("poll creation keeps form until ACK plus same-thread authoritative poll message", async () => {
    const room = fixture(),
      sent: RoomCommand[] = [];
    let resolve!: (outcome: CommandOutcome) => void;
    const { target, update } = renderComposer(room, {
      request: (command) => {
        sent.push(command);
        return new Promise((done) => (resolve = done));
      },
    });
    target.querySelector<HTMLButtonElement>("[data-composer-more]")!.click();
    flushSync();
    await tick();
    Array.from(
      target.querySelectorAll<HTMLButtonElement>('[role="menu"] button'),
    )
      .find((button) => button.textContent?.includes("Criar votação"))!
      .click();
    flushSync();
    await tick();
    const inputs = document.querySelectorAll<HTMLInputElement>(
      '[role="dialog"] input:not([type="checkbox"])',
    );
    for (const [index, value] of [
      [0, "Question"],
      [1, "First"],
      [2, "Second"],
    ] as const) {
      inputs[index].value = value;
      inputs[index].dispatchEvent(new Event("input", { bubbles: true }));
    }
    flushSync();
    Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button'),
    )
      .find((button) => button.textContent?.trim() === "Criar votação")!
      .click();
    expect(sent[0]).toMatchObject({
      t: "poll.create",
      thread: "main",
      question: "Question",
      options: ["First", "Second"],
    });
    resolve({ ok: true });
    await tick();
    flushSync();
    expect(
      document.querySelector<HTMLInputElement>('[role="dialog"] input')?.value,
    ).toBe("Question");
    update({
      ...room,
      messages: [
        { id: 1, thread: "main", author: room.me, text: "", ts: 1, poll: "p" },
      ],
      polls: {
        p: {
          id: "p",
          author: room.me,
          question: "Question",
          options: ["First", "Second"],
          multi: false,
          closed: false,
          votes: [[], []],
        },
      },
    });
    await tick();
    flushSync();
    await dialogClosed();
    expect(target.textContent).toContain("Votação criada");
  }, 30_000);
  test("uncertain identical candidate retains draft and blocks duplicate until explicit local review", async () => {
    const room = fixture(),
      sent: RoomCommand[] = [];
    let resolve!: (outcome: CommandOutcome) => void;
    const { target, update } = renderComposer(room, {
      request: (command) => {
        sent.push(command);
        return new Promise((done) => (resolve = done));
      },
    });
    edit(target, "same text");
    target.querySelector<HTMLButtonElement>("[data-composer-send]")!.click();
    resolve({ ok: false, error: "disconnected" });
    await tick();
    flushSync();
    update({
      ...room,
      messages: [
        { id: 1, thread: "main", author: room.me, text: "same text", ts: 1 },
      ],
    });
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "same text",
    );
    expect(
      target.querySelector<HTMLButtonElement>("[data-composer-send]")?.disabled,
    ).toBe(true);
    expect(sent).toHaveLength(1);
    Array.from(target.querySelectorAll<HTMLButtonElement>("button"))
      .find((button) => button.textContent?.includes("Conferi a sala; manter"))!
      .click();
    flushSync();
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "same text",
    );
    expect(sent).toHaveLength(1);
  }, 30_000);

  test("ordinary media dictation refines only the current draft and Enter alone sends", async () => {
    let chunk: (data: Blob) => void = () => {},
      ended = () => {},
      reads = 0;
    let resolve: (text: string) => void = () => {};
    const commands: RoomCommand[] = [];
    const { target } = renderComposer(fixture(), {
      speechFactory: null,
      mediaFactory: async () => ({
        type: "audio/webm",
        start(c, e) {
          chunk = c;
          ended = e;
        },
        stop() {
          ended();
        },
        dispose() {},
      }),
      voice: {
        current: () => true,
        beforeLeave: () => () => {},
        transcribe: () => {
          reads++;
          return new Promise<string>((done) => {
            resolve = done;
          });
        },
      },
      request: async (command) => {
        commands.push(command);
        return { ok: false, error: "disconnected" };
      },
    });
    const mic = () =>
      target.querySelector<HTMLButtonElement>(
        'button[aria-label="Ditar mensagem"]',
      )!;
    edit(target, "base");
    mic().click();
    await tick();
    await tick();
    flushSync();
    expect(mic().getAttribute("aria-pressed")).toBe("true");
    chunk(new Blob([new Uint8Array(3000)]));
    mic().click();
    await tick();
    await tick();
    expect(reads).toBe(1);
    flushSync();
    expect(mic().getAttribute("aria-busy")).toBe("true");
    expect(mic().title).toBe("Toque pra ditar (ou segure espaço na caixa)");
    expect(commands).toHaveLength(0);
    resolve("corrected");
    await tick();
    await tick();
    flushSync();
    const input = target.querySelector<HTMLTextAreaElement>("textarea")!;
    expect(input.value).toBe("base corrected");
    expect(mic().getAttribute("aria-busy")).not.toBe("true");
    expect(commands).toHaveLength(0);
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await tick();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ t: "msg", text: "base corrected" });
  }, 30_000);

  test("Empty capture-only Enter during Whisper disables the composer and sends refined text once through its normal owner", async () => {
    let chunk: (data: Blob) => void = () => {},
      ended = () => {},
      resolve: (text: string) => void = () => {};
    const commands: RoomCommand[] = [];
    const { target } = renderComposer(fixture(), {
      speechFactory: null,
      mediaFactory: async () => ({
        type: "audio/webm",
        start(c, e) {
          chunk = c;
          ended = e;
        },
        stop() {
          ended();
        },
        dispose() {},
      }),
      voice: {
        current: () => true,
        beforeLeave: () => () => {},
        transcribe: () =>
          new Promise<string>((done) => {
            resolve = done;
          }),
      },
      request: async (command) => {
        commands.push(command);
        return { ok: false, error: "disconnected" };
      },
    });
    const input = edit(target, "");
    target
      .querySelector<HTMLButtonElement>('button[aria-label="Ditar mensagem"]')!
      .click();
    await tick();
    await tick();
    flushSync();
    chunk(new Blob([new Uint8Array(3000)]));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    await tick();
    await tick();
    flushSync();
    expect(input.disabled).toBe(true);
    expect(target.querySelector("[data-composer-transcribing]")).not.toBeNull();
    target
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(commands).toHaveLength(0);
    resolve("refined");
    await tick();
    await tick();
    await tick();
    flushSync();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ t: "msg", text: "refined" });
  }, 30_000);

  test("mic capability projects interim text and cancels stale recognition across thread changes", async () => {
    const engines: import("../web/features/composer/speech").SpeechRecognizer[] =
      [];
    let starts = 0,
      aborts = 0;
    const factory: import("../web/features/composer/speech").SpeechFactory =
      () => {
        const rec: import("../web/features/composer/speech").SpeechRecognizer =
          {
            lang: "",
            continuous: false,
            interimResults: false,
            onresult: null,
            onerror: null,
            onend: null,
            start() {
              starts++;
            },
            stop() {
              this.onend?.({});
            },
            abort() {
              aborts++;
            },
          };
        engines.push(rec);
        return rec;
      };
    const room = fixture(),
      { target, update } = renderComposer(room, { speechFactory: factory });
    const input = edit(target, "base");
    input.focus();
    target
      .querySelector<HTMLButtonElement>('button[aria-label="Ditar mensagem"]')!
      .dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerId: 1,
          bubbles: true,
          cancelable: true,
        }),
      );
    expect(starts).toBe(0);
    target
      .querySelector<HTMLButtonElement>('button[aria-label="Ditar mensagem"]')!
      .click();
    expect(starts).toBe(1);
    expect(engines[0].lang).toBe("pt-BR");
    engines[0].onresult?.({ results: [[{ transcript: "spoken" }]] });
    flushSync();
    expect(input.value).toBe("base spoken");
    const late = engines[0].onresult;
    update(room, "e");
    edit(target, "new thread");
    late?.({ results: [[{ transcript: "late old speech" }]] });
    flushSync();
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "new thread",
    );
    expect(aborts).toBeGreaterThan(0);
    target
      .querySelector<HTMLButtonElement>('button[aria-label="Ditar mensagem"]')!
      .click();
    expect(starts).toBe(2);
    engines[1].onerror?.({ error: "not-allowed" });
    flushSync();
    expect(target.textContent).toContain(
      "O navegador não deixou usar o microfone.",
    );
  }, 30_000);

  test("dictation-ended focus respects a dialog opened before either pending focus tick", async () => {
    for (const afterFirstTick of [false, true]) {
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
      const { target } = renderComposer(fixture(), {
        speechFactory: () => rec,
      });
      const input = edit(target, "draft");
      await tick();
      flushSync();
      input.focus();
      target
        .querySelector<HTMLButtonElement>(
          'button[aria-label="Ditar mensagem"]',
        )!
        .click();
      expect(typeof rec.onend).toBe("function");
      rec.onend?.({});
      if (afterFirstTick) await tick();
      const dialog = document.createElement("dialog"),
        field = document.createElement("input");
      dialog.open = true;
      dialog.append(field);
      document.body.append(dialog);
      try {
        field.focus();
        expect(document.activeElement === field).toBe(true);
        await tick();
        flushSync();
        await tick();
        expect(document.activeElement === field).toBe(true);
      } finally {
        dialog.remove();
      }
    }
  });
  test("Send cancels dictation before dispatch and late recognition never restores the sent draft", async () => {
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
    const sent: RoomCommand[] = [],
      room = fixture(),
      { target, update } = renderComposer(room, {
        speechFactory: () => rec,
        request: async (command) => {
          sent.push(command);
          return { ok: true };
        },
      });
    const input = edit(target, "base");
    input.focus();
    target
      .querySelector<HTMLButtonElement>('button[aria-label="Ditar mensagem"]')!
      .click();
    rec.onresult?.({ results: [[{ transcript: "spoken" }]] });
    flushSync();
    const late = rec.onresult;
    input
      .closest("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    for (let i = 0; i < 8; i++) await tick();
    expect(sent).toHaveLength(1);
    const command = sent[0];
    if (command.t !== "msg") throw Error("message expected");
    update({
      ...room,
      messages: [
        ...room.messages,
        {
          id: 99999,
          thread: "main",
          author: room.me,
          text: command.text || "",
          ts: 1,
        },
      ],
    });
    flushSync();
    expect(input.value).toBe("");
    late?.({ results: [[{ transcript: "late after Send" }]] });
    flushSync();
    expect(input.value).toBe("");
  }, 30000);
  test("Hold-Space starts only after threshold; contenteditable and unavailable capability remain ordinary", async () => {
    let starts = 0;
    const rec: import("../web/features/composer/speech").SpeechRecognizer = {
      lang: "",
      continuous: false,
      interimResults: false,
      onresult: null,
      onerror: null,
      onend: null,
      start() {
        starts++;
      },
      stop() {
        this.onend?.({});
      },
      abort() {},
    };
    const { target } = renderComposer(fixture(), { speechFactory: () => rec });
    const input = edit(target, "hold");
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: " ", bubbles: true }),
    );
    flushSync();
    expect(input.value).toBe("hold ");
    expect(starts).toBe(0);
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, 370));
    expect(starts).toBe(1);
    input.dispatchEvent(
      new KeyboardEvent("keyup", { key: " ", bubbles: true }),
    );
    const foreign = document.createElement("div");
    foreign.contentEditable = "true";
    document.body.append(foreign);
    foreign.focus();
    const event = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    foreign.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(starts).toBe(1);
    const unsupported = renderComposer(
      { ...fixture(), id: "unsupported" },
      { speechFactory: null },
    );
    expect(
      unsupported.target.querySelector(
        'button[aria-label="Ditar mensagem"]',
      ) === null,
    ).toBe(true);
  }, 30_000);
  test("deleted-thread recovery reviews original content, reports clipboard failure and discards only the local draft", async () => {
    const room = fixture(),
      sent: RoomCommand[] = [];
    const { target, drafts, update } = renderComposer(room, {
      request: async (command) => {
        sent.push(command);
        return { ok: true };
      },
    });
    const orphan = drafts.entry({
      account: room.me,
      roomId: room.id,
      thread: "deleted-original",
    });
    orphan.edit("Original private draft");
    flushSync();
    const review = [...target.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Revisar rascunho"),
    );
    expect(!!review).toBe(true);
    review!.click();
    flushSync();
    await tick();
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(
      dialog.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toContain("Original private draft");
    expect(
      dialog.querySelector<HTMLTextAreaElement>("textarea")?.readOnly,
    ).toBe(true);
    const original = navigator.clipboard.writeText;
    try {
      navigator.clipboard.writeText = async () => {
        throw new Error("denied");
      };
      [...dialog.querySelectorAll("button")]
        .find((button) => button.textContent?.trim() === "Copiar")!
        .click();
      await tick();
      expect(dialog.textContent).toContain("Não foi possível copiar");
    } finally {
      navigator.clipboard.writeText = original;
    }
    [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Descartar rascunho"))!
      .click();
    flushSync();
    await dialogClosed();
    expect(drafts.orphans(room)).toHaveLength(0);
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "",
    );
    expect(sent).toHaveLength(0);
    orphan.edit("detached discarded draft");
    update({ ...room, me: "other@test" });
    expect(target.textContent).not.toContain("Original private draft");
  }, 30_000);
  test("account reset clears drafts and detached form cannot send after disposal", async () => {
    const sent: RoomCommand[] = [];
    const { target, drafts, destroy, update } = renderComposer(fixture(), {
      request: async (command) => {
        sent.push(command);
        return { ok: true };
      },
    });
    edit(target, "private old account");
    const stale = target.querySelector("form")!;
    drafts.reset();
    update({ ...fixture(), me: "you@test" });
    expect(target.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe(
      "",
    );
    destroy();
    stale.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
    expect(sent).toHaveLength(0);
  }, 30_000);
});

describe("room sidebar header and suggestion ownership", () => {
  function deferredMutationOutcome() {
    let resolve!: (value: CommandOutcome) => void;
    const promise = new Promise<CommandOutcome>((done) => {
      resolve = done;
    });
    return { promise, resolve };
  }
  const bridge: SidebarProps["vb"] = {
    t: vb.t,
    name: vb.name,
    avatarVersion: vb.avatarVersion,
    ago: vb.ago,
    epicBusy: () => null,
    waitsIn: () => [],
  };
  async function closed(role: string) {
    for (
      let frame = 0;
      frame < 10 && document.querySelector(`[role="${role}"]`);
      frame++
    )
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
    flushSync();
    expect(document.querySelector(`[role="${role}"]`) === null).toBe(true);
  }
  type BarTitleProps = import("svelte").ComponentProps<
    typeof import("../web/features/room-shell/RoomBarTitle.svelte").default
  >;
  function barTitle(
    room: Room,
    extra: Partial<BarTitleProps> = {},
    request: (command: RoomCommand) => Promise<CommandOutcome> = async () => ({
      ok: true,
    }),
  ) {
    const owner = createRoomMutations(room.me, room.id);
    peopleCleanups.push(() => owner.dispose());
    owner.sync(room, request);
    const target = document.createElement("div");
    document.body.append(target);
    const props: BarTitleProps = {
      room,
      thread: "main",
      owner,
      vb: bridge,
      ...extra,
    };
    const view = mountView("roomBarTitle", target, props);
    active.push(view);
    return { target, view, props, owner };
  }
  test("bar status menu: sets the status and pins the epic, with no owner picker; a detached pill cannot write", async () => {
    const room = fixture(),
      commands: RoomCommand[] = [],
      request = async (command: RoomCommand): Promise<CommandOutcome> => {
        commands.push(command);
        return { ok: true };
      };
    const { target, view, props, owner } = barTitle(
      room,
      { thread: "e" },
      request,
    );
    const pill = target.querySelector<HTMLElement>("[data-epic-status]")!;
    expect(pill.getAttribute("data-epic-status")).toBe("todo");
    expect(pill.textContent?.trim()).toBe("A fazer");
    menuItem(pill, "Fazendo").click();
    await tick();
    expect(commands).toEqual([{ t: "epic.status", id: "e", status: "doing" }]);
    const next: Room = {
      ...room,
      epics: room.epics.map((epic) => ({ ...epic, status: "doing" as const })),
    };
    owner.sync(next, request);
    view.update({ ...props, room: next });
    await tick();
    flushSync();
    expect(
      target.querySelector("[data-epic-status]")?.textContent?.trim(),
    ).toBe("Fazendo");
    // The epic list has no ⋯: the status menu pins the epic (Gimenes #3924), with no owner picker (#3975).
    menuItem(
      target.querySelector("[data-epic-status]")!,
      "Fixar no topo",
    ).click();
    await tick();
    expect(commands.at(-1)).toEqual({ t: "epic.pin", id: "e", pinned: true });
    const pinned: Room = {
      ...next,
      epics: next.epics.map((epic) => ({ ...epic, pinned: true })),
    };
    owner.sync(pinned, request);
    view.update({ ...props, room: pinned });
    await tick();
    flushSync();
    menuItem(target.querySelector("[data-epic-status]")!, "Desafixar");
    expect(window.document.querySelector("[data-epic-owner-choice]")).toBe(
      null,
    );
    const stale = target.querySelector<HTMLElement>("[data-epic-status]")!;
    active.splice(active.indexOf(view), 1);
    view.destroy();
    stale.click();
    await tick();
    expect(commands).toHaveLength(2);
  }, 30_000);
  test("desktop bar title names the view, never the room again; a DM names the person; only an epic has actions", () => {
    const room = fixture();
    for (const [r, extra, title, actions] of [
      [room, {}, "Sala principal", false],
      [room, { thread: "e" }, "Epic", true],
      [room, { thread: "gone" }, "Sala principal", false],
      [
        { ...room, book: { ...room.book, dm: true } },
        {},
        room.book.title,
        false,
      ],
    ] as const) {
      const { target } = barTitle(r, extra);
      expect(
        target.querySelector("[data-thread-title]")?.textContent?.trim(),
      ).toBe(title);
      expect(!!target.querySelector("[data-epic-bar-actions]")).toBe(actions);
    }
    // The header's search stands in for "Sala principal" (Gimenes #3902); an epic keeps its title.
    expect(
      barTitle(room, { quietLabel: false }).target.querySelector(
        "[data-thread-title]",
      ),
    ).toBe(null);
    expect(
      barTitle(room, { thread: "e", quietLabel: false })
        .target.querySelector("[data-thread-title]")
        ?.textContent?.trim(),
    ).toBe("Epic");
    // In an epic: the status pill right after the title (Gimenes #3975). No ✎ and no 🗑.
    const { target } = barTitle(room, { thread: "e" });
    expect(
      [...target.querySelector("[data-epic-bar-actions]")!.children].map(
        (node) =>
          node.hasAttribute("data-epic-status")
            ? "status"
            : node.getAttribute("data-orientation"),
      ),
    ).toEqual(["status"]);
    expect(
      target.querySelector("[data-thread-title]")?.nextElementSibling,
    ).toBe(target.querySelector("[data-epic-bar-actions]"));
  });
  test("desktop thread bar: the status menu lists the 4 states (Gimenes #3989), Feito sends epic.status and the pill follows the server; detached pills cannot write", async () => {
    const room = fixture(),
      commands: RoomCommand[] = [],
      request = async (command: RoomCommand): Promise<CommandOutcome> => {
        commands.push(command);
        return { ok: true };
      };
    const { target, view, props, owner } = barTitle(
      room,
      { thread: "e" },
      request,
    );
    expect(target.querySelector("[data-thread-actions]")).toBeNull();
    const pill = target.querySelector<HTMLElement>("[data-epic-status]")!;
    expect(pill.textContent?.trim()).toBe("A fazer");
    const done = menuItem(pill, "Feito");
    expect(
      [
        ...document.querySelectorAll<HTMLElement>("[data-epic-status-choice]"),
      ].map((item) => item.textContent?.trim()),
    ).toEqual(["A fazer", "Fazendo", "Requer ação", "Feito"]);
    // The epic list has no actions menu: this menu pins the epic (Gimenes #3933); it picks no owner (#3975).
    expect(
      [...document.querySelectorAll("[role=menuitem]")].some(
        (item) => item.textContent?.trim() === "Fixar no topo",
      ),
    ).toBe(true);
    expect(document.querySelector("[data-epic-owner-choice]")).toBeNull();
    done.click();
    await tick();
    expect(commands.at(-1)).toEqual({
      t: "epic.status",
      id: "e",
      status: "done",
    });
    const archived: Room = {
      ...room,
      epics: room.epics.map((epic) => ({
        ...epic,
        archived: true,
        status: "done" as const,
      })),
    };
    owner.sync(archived, request);
    view.update({ ...props, room: archived });
    await tick();
    flushSync();
    expect(
      target.querySelector("[data-epic-status]")?.textContent?.trim(),
    ).toBe("Feito");
    // Without a chosen status an archived thread with open tasks shows done too: there is no separate archive state.
    const dropped: Room = {
      ...archived,
      epics: archived.epics.map((epic) => ({
        ...epic,
        status: null,
        tasks: [{ id: "t", title: "T", done: false, status: "todo" as const }],
      })),
    };
    owner.sync(dropped, request);
    view.update({ ...props, room: dropped });
    flushSync();
    expect(
      target
        .querySelector("[data-epic-status]")
        ?.getAttribute("data-epic-status"),
    ).toBe("done");
    commands.length = 0;
    const stale = target.querySelector<HTMLElement>("[data-epic-status]")!;
    active.splice(active.indexOf(view), 1);
    view.destroy();
    stale.click();
    await tick();
    expect(commands).toHaveLength(0);
  }, 30_000);
  test("suggestion accept sends displayed snapshot only, handles server refusal and stale room controls", async () => {
    const room: Room = {
        ...fixture(),
        suggestions: [
          { title: "<script>safe</script>", why: "Why", tasks: ["One"] },
        ],
      },
      owner = createRoomMutations(room.me, room.id),
      commands: RoomCommand[] = [],
      response = deferredMutationOutcome();
    peopleCleanups.push(() => owner.dispose());
    const request = (command: RoomCommand) => {
      commands.push(command);
      return response.promise;
    };
    owner.sync(room, request);
    const target = document.createElement("div");
    document.body.append(target);
    const props: import("../web/features/room-sidebar/types").SuggestionPreviewProps =
      {
        room,
        index: 0,
        owner,
        vb: {
          t: vb.t,
          name: vb.name,
          avatarVersion: vb.avatarVersion,
          ago: vb.ago,
          hhmm: () => "09:00",
          waiting: () => false,
        },
      };
    const view = mountView("suggestionPreview", target, props);
    active.push(view);
    expect(target.querySelector("script")).toBeNull();
    expect(target.textContent).toContain("<script>safe</script>");
    const accept = [...target.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Pedir pro meu agent"),
    )!;
    accept.click();
    accept.click();
    await tick();
    expect(commands).toEqual([
      { t: "suggestion", i: 0, accept: true, expected: room.suggestions[0] },
    ]);
    response.resolve({ ok: false, error: "suggestion changed" });
    await tick();
    await tick();
    flushSync();
    expect(target.querySelector("[role=alert]") !== null).toBe(true);
    const at = active.indexOf(view);
    active.splice(at, 1);
    view.destroy();
    accept.click();
    await tick();
    expect(commands).toHaveLength(1);
  }, 30_000);
  test("connected outgoing suggestion controls cannot accept an unseen replacement before DOM flush", async () => {
    const room: Room = {
      ...fixture(),
      suggestions: [{ title: "Visible A", why: "A", tasks: [] }],
    };
    const owner = createRoomMutations(room.me, room.id),
      commands: RoomCommand[] = [];
    const request = async (command: RoomCommand): Promise<CommandOutcome> => {
      commands.push(command);
      return { ok: false, error: "controlled refusal" };
    };
    owner.sync(room, request);
    peopleCleanups.push(() => owner.dispose());
    const values = writable<
      import("../web/features/room-sidebar/types").SuggestionPreviewProps
    >({
      room,
      index: 0,
      owner,
      vb: {
        t: vb.t,
        name: vb.name,
        avatarVersion: vb.avatarVersion,
        ago: vb.ago,
        hhmm: () => "09:00",
        waiting: () => false,
      },
    });
    const target = document.createElement("div");
    document.body.append(target);
    const component = flushSync(() =>
      mount(SuggestionPreviewHarness, { target, props: { values } }),
    );
    active.push({
      destroy: () =>
        flushSync(() => {
          void unmount(component);
        }),
    });
    const accept = () =>
      [...target.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
        button.textContent?.includes("Pedir pro meu agent"),
      )!;
    const old = accept();
    expect(old !== undefined).toBe(true);
    const next: Room = {
      ...room,
      suggestions: [{ title: "Unseen B", why: "B", tasks: [] }],
    };
    owner.sync(next, request);
    values.update((props) => ({ ...props, room: next }));
    expect(old.isConnected).toBe(true);
    old.click();
    expect(commands).toEqual([]);
    flushSync();
    await tick();
    accept().click();
    await tick();
    expect(commands).toEqual([
      { t: "suggestion", i: 0, accept: true, expected: next.suggestions[0] },
    ]);
  });
});

describe("collapsed sidebar and typed presence", () => {
  test("the collapsed rail has no + for a new thread (Gimenes #4286); agent presence stays typed", async () => {
    const room = fixture(),
      target = document.createElement("div");
    document.body.append(target);
    let expanded = 0;
    const commands: RoomCommand[] = [];
    const props: SidebarProps = {
      room,
      thread: "main",
      collapsed: true,
      navigation: createNavigationSession(room.id),
      pins: syncPinsSession(null, room),
      request: async (command) => {
        commands.push(command);
        return { ok: false, error: "offline" };
      },
      send: () => false,
      onopen: () => {},
      onarchchange: () => {},
      onopenpinfile: () => {},
      onopenpinapp: () => {},
      ontogglerail: () => {
        expanded++;
      },
      vb: {
        t: vb.t,
        name: vb.name,
        avatarVersion: vb.avatarVersion,
        ago: vb.ago,
        epicBusy: () => null,
        waitsIn: () => [],
      },
      presence: {
        agents: [
          {
            email: room.me,
            who: "Codex",
            repo: null,
            listening: true,
            all_rooms: true,
            seen_at: 1,
            context: { tokens: 90, window: 100, at: 1, limits: null },
          },
        ],
        sandboxes: [
          {
            id: "sandbox-one",
            email: room.me,
            name: null,
            state: "running",
            run_s: 1,
            rate: 1,
            disk_rate: 0,
            created_at: Date.now(),
            checked_at: Date.now(),
          },
        ],
      },
    };
    const view = mountView("sidebar", target, props);
    active.push(view);
    expect(target.querySelector('[aria-label="Nova thread"]')).toBeNull();
    expect(expanded).toBe(0);
    expect(commands).toEqual([]);
    view.update({ ...props, collapsed: false });
    await tick();
    flushSync();
    expect(target.querySelector("#newEpic")).toBeNull();
    expect(
      target.querySelector("[data-agent-presence]")?.textContent,
    ).toContain("90%");
    // Sandboxes are not people: the sidebar no longer lists them.
    expect(
      [...target.querySelectorAll("button")].some((button) =>
        button.textContent?.includes("sandbox"),
      ),
    ).toBe(false);
  }, 30_000);
});

describe("account", () => {
  const cleanup: (() => void)[] = [];
  afterEach(() => {
    for (const dispose of cleanup.splice(0)) dispose();
  });
  async function account(withFriend = false) {
    const { createAccountSession } =
      await import("../web/features/account/session");
    const { createDeviceLock } = await import("../web/features/account/device");
    const { createPersonalSession } =
      await import("../web/features/home/personal");
    const { homeApi, me, manualClock, deferred, settle } =
      await import("./home-fixtures");
    const time = manualClock(),
      pending = deferred<{ ok: true; name: string }>();
    let canonical = me(
      withFriend
        ? {
            friends: [
              {
                email: "same@test",
                name: "Same friend",
                avatar: null,
                joined: 1,
                shared: 1,
                dm: "dm00000000000000000000",
              },
            ],
          }
        : {},
    );
    const personal = createPersonalSession(
      homeApi({ me: async () => canonical }),
      { clock: time.clock },
    );
    await personal.refresh();
    const names: string[] = [],
      removals: string[] = [];
    const owner = createAccountSession(
      personal,
      {
        logins: async () => ({
          logins: [],
        }),
        name: async (name) => {
          names.push(name);
          return pending.promise;
        },
        avatar: async () => ({ ok: true, avatar: 1 }),
        connect: async () => ({ ok: true as const }),
        dismiss: async (email) => {
          removals.push(email);
          return { ok: true as const };
        },
        answerInvite: async () => ({ ok: true as const }),
      },
      time.clock,
    );
    const device = createDeviceLock({
      storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      credentials: null,
      random: (size) => new Uint8Array(size),
      clock: time.clock,
    });
    const target = document.createElement("div"),
      trigger = document.createElement("button");
    document.body.append(target, trigger);
    trigger.focus();
    const component = flushSync(() =>
      mount(AccountPanel, {
        target,
        props: {
          owner,
          device,
          lang: "en",
          theme: "auto",
          onTheme: () => {},
          onLanguage: () => {},
          onArchive: () => {},
          onLogout: () => {},
          notifications: createRawSnippet(() => ({
            render: () => "<span></span>",
          })),
          agentSettings: createRawSnippet(() => ({
            render: () => "<span></span>",
          })),
          cloud: createRawSnippet(() => ({
            render: () => "<span></span>",
          })),
        },
      }),
    );
    const view = {
      destroy: () =>
        flushSync(() => {
          void unmount(component);
        }),
    };
    active.push(view);
    cleanup.push(() => {
      owner.dispose();
      personal.dispose();
      device.dispose();
      trigger.remove();
    });
    owner.open();
    flushSync();
    await tick();
    await tick();
    return {
      owner,
      device,
      personal,
      pending,
      names,
      removals,
      time,
      trigger,
      me,
      settle,
      canonical: (value: ReturnType<typeof me>) => {
        canonical = value;
      },
    };
  }
  test("profile draft survives bounded uncertainty and explicit review; close fences detached submit", async () => {
    const h = await account();
    const input = document.querySelector<HTMLInputElement>("#account-name")!;
    input.value = "My new name";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    const form = input.closest("form")!;
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await h.settle();
    h.time.advance(20_000);
    flushSync();
    await tick();
    expect(input.value).toBe("My new name");
    expect(document.querySelector("[data-account]")?.textContent).toContain(
      "unconfirmed",
    );
    expect(h.names).toEqual(["My new name"]);
    h.owner.close();
    flushSync();
    await tick();
    form.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await h.settle();
    expect(h.names).toHaveLength(1);
    h.owner.open();
    flushSync();
    await tick();
    expect(
      document.querySelector<HTMLInputElement>("#account-name")?.value,
    ).toBe("My new name");
  });
  test("account replacement synchronously removes private dialog and invalidates old results", async () => {
    const h = await account();
    const input = document.querySelector<HTMLInputElement>("#account-name")!;
    input.value = "Private A";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    input
      .closest("form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    h.personal.acceptIdentity("b@test", false);
    flushSync();
    await tick();
    expect(document.querySelector("[data-account]")).toBeNull();
    h.pending.resolve({ ok: true, name: "Private A" });
    await h.settle();
    flushSync();
    expect(document.body.textContent).not.toContain("Private A");
  });
  test("unsupported device lock is explicit, never invokes a prompt and has an accessible label", async () => {
    await account();
    const checkbox = document.querySelector<HTMLButtonElement>(
      '[data-account] [aria-labelledby="settings-lock"]',
    );
    expect(checkbox?.disabled).toBe(true);
    expect(checkbox?.closest("label")?.textContent).toContain(
      "Require Face ID",
    );
    expect(document.querySelector("[data-account]")?.textContent).toContain(
      "Unavailable in this browser",
    );
  });
  test("connected old account form is inert when account B reopens before a DOM flush", async () => {
    const h = await account();
    const input = document.querySelector<HTMLInputElement>("#account-name")!;
    input.value = "Private A draft";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    const oldForm = input.closest("form")!;
    h.personal.state.update((value) => ({
      ...value,
      me: h.me({ email: "b@test", name: "Account B" }),
      identityRevision: value.identityRevision + 1,
    }));
    h.owner.open();
    // Old DOM remains connected until Svelte flushes. Its captured open/account token must already be invalid.
    expect(oldForm.isConnected).toBe(true);
    oldForm.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(h.names).toEqual([]);
    flushSync();
    await tick();
    expect(
      document.querySelector<HTMLInputElement>("#account-name")?.value,
    ).toBe("Account B");
    expect(document.body.textContent).not.toContain("Private A draft");
  });

  test("connected old account form is inert after same-account close and reopen before DOM flush", async () => {
    const h = await account();
    const input = document.querySelector<HTMLInputElement>("#account-name")!;
    input.value = "Retained local draft";
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
    const oldForm = input.closest("form")!;
    h.owner.close();
    h.owner.open();
    expect(oldForm.isConnected).toBe(true);
    oldForm.dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(h.names).toEqual([]);
    flushSync();
    await tick();
    const currentInput =
      document.querySelector<HTMLInputElement>("#account-name")!;
    expect(currentInput.value).toBe("Retained local draft");
    currentInput
      .closest("form")!
      .dispatchEvent(
        new window.Event("submit", { bubbles: true, cancelable: true }),
      );
    expect(h.names).toEqual(["Retained local draft"]);
  });
});

describe("agent settings and sandbox ownership", () => {
  test("grant confirmation cancels on canonical removal and ignores a late revoke error", async () => {
    const { createAgentsApi } = await import("../web/features/agents/api");
    const { createAgentAccountSession } =
      await import("../web/features/agents/account");
    let grants = [
      {
        id: "grant-a",
        client: "<script>client</script>",
        connected_at: 1,
        used_at: null,
      },
    ];
    let reject!: (reason: Error) => void;
    const api = createAgentsApi(async (input) => {
      const url = String(input);
      if (url.endsWith("/revoke"))
        return new Promise<Response>((_resolve, no) => {
          reject = no;
        });
      return new Response(JSON.stringify({ agents: grants, last_used: null }), {
        headers: { "content-type": "application/json" },
      });
    });
    const owner = createAgentAccountSession("me@test", { api });
    await owner.refresh();
    const target = document.createElement("div");
    document.body.append(target);
    const view = mountView("agentSettings", target, {
      owner,
      origin: "https://vibebook.dev",
      vb,
      lang: "en",
    });
    active.push(view);
    peopleCleanups.push(() => owner.dispose());
    flushSync();
    await tick();
    expect(target.querySelector("script") === null).toBe(true);
    expect(target.textContent).toContain("<script>client</script>");
    const remove = [
      ...target.querySelectorAll<HTMLButtonElement>("button"),
    ].find((button) => button.textContent?.includes("Remove selected"))!;
    remove.click();
    flushSync();
    await tick();
    const confirm = document.querySelector<HTMLButtonElement>(
      '[role="alertdialog"] button:last-child',
    )!;
    expect(!!confirm).toBe(true);
    confirm.click();
    await Promise.resolve();
    await Promise.resolve();
    flushSync();
    grants = [];
    await owner.refresh(true);
    flushSync();
    await tick();
    await expectAlertDialogClosed();
    reject(Error("late server failure"));
    await Promise.resolve();
    await Promise.resolve();
    flushSync();
    expect(target.querySelector('[role="alert"]') === null).toBe(true);
  }, 30_000);
  test("sandbox delete confirmation cannot target a same-ID replacement and password clears before reply", async () => {
    const { createAgentsApi } = await import("../web/features/agents/api");
    const { createSandboxCredentials } =
      await import("../web/features/sandboxes/credentials");
    const { createSandboxSession } =
      await import("../web/features/sandboxes/session");
    const { createTerminalSession } =
      await import("../web/features/sandboxes/terminalSession");
    const { default: SandboxPanel } =
      await import("../web/features/sandboxes/SandboxPanel.svelte");
    let cards = [
        {
          id: "a",
          vm_id: "old-vm",
          name: "<img src=x>",
          state: "running",
          ready: true,
          created_at: 1,
          rate: 0.13,
          cost: 0,
        },
      ],
      deletes = 0;
    let connected = true,
      resolveKey!: (value: Response) => void;
    const api = createAgentsApi(async (input, init) => {
      const method = init?.method || "GET",
        url = String(input);
      if (method === "DELETE") {
        deletes++;
        return new Response('{"ok":true}');
      }
      if (url.endsWith("/freestyle") && method === "POST")
        return new Promise<Response>((resolve) => {
          resolveKey = resolve;
        });
      return new Response(
        JSON.stringify({ connected, claude: true, sandboxes: cards }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const credentials = createSandboxCredentials("me@test", api),
      owner = createSandboxSession("me@test", "r", api, credentials),
      terminal = createTerminalSession("me@test", "r", api, {
        origin: "http://localhost",
        current: () => true,
        canOpen: () => false,
      });
    await owner.refresh();
    const target = document.createElement("div");
    document.body.append(target);
    const instance = flushSync(() =>
      mount(SandboxPanel, {
        target,
        props: { owner, credentials, terminal, lang: "en" },
      }),
    );
    peopleCleanups.push(() => {
      flushSync(() => {
        void unmount(instance);
      });
      owner.dispose();
      credentials.dispose();
      terminal.dispose();
    });
    expect(target.querySelector("img") === null).toBe(true);
    const removeButtons = [
      ...target.querySelectorAll<HTMLButtonElement>("article button"),
    ];
    const removeButton = removeButtons.find(
      (button) => button.textContent?.trim() === "Remove",
    );
    expect(
      removeButton,
      JSON.stringify(removeButtons.map((button) => button.textContent)),
    ).toBeDefined();
    expect(removeButton?.disabled).toBe(false);
    removeButton!.click();
    flushSync();
    await tick();
    expect(document.querySelector('[role="alertdialog"]') !== null).toBe(true);
    cards = [{ ...cards[0]!, vm_id: "replacement-vm" }];
    await owner.refresh(true);
    flushSync();
    await tick();
    await expectAlertDialogClosed();
    expect(deletes).toBe(0);
    connected = false;
    await owner.refresh(true);
    flushSync();
    let password = target.querySelector<HTMLInputElement>(
      'input[aria-label="Freestyle key"]',
    )!;
    password.value = "unsent-secret";
    password.dispatchEvent(new Event("input", { bubbles: true }));
    owner.authorize(false);
    flushSync();
    owner.authorize(true);
    await owner.refresh(true);
    flushSync();
    password = target.querySelector<HTMLInputElement>(
      'input[aria-label="Freestyle key"]',
    )!;
    expect(password.value).toBe("");
    password.value = "secret-credential";
    password.dispatchEvent(new Event("input", { bubbles: true }));
    password.form!.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    flushSync();
    await Promise.resolve();
    await Promise.resolve();
    expect(password.value).toBe("");
    expect(target.textContent?.includes("secret-credential")).toBe(false);
    resolveKey(
      new Response('{"ok":true}', {
        headers: { "content-type": "application/json" },
      }),
    );
    await Promise.resolve();
  }, 30_000);
});

test("denied agent metadata can recover through explicit read-only retry", async () => {
  const { createAgentsApi } = await import("../web/features/agents/api"),
    { createAgentAccountSession } =
      await import("../web/features/agents/account"),
    { UNAUTHENTICATED } = await import("../shared/schemas");
  let denied = true;
  const api = createAgentsApi(
    async (input) =>
      new Response(
        JSON.stringify(
          denied
            ? UNAUTHENTICATED
            : new URL(String(input), "https://x.test").pathname === "/api/me"
              ? {
                  email: "me@test",
                  name: null,
                  avatar: null,
                  dm: "dm000000000000000000aa",
                  requests: [],
                  sent: [],
                  invites: [],
                  people: [],
                  books: [],
                  friends: [],
                  waits: [],
                  v: "fixture",
                }
              : {
                  agents: [
                    {
                      id: "recovered",
                      client: "Recovered agent",
                      connected_at: Date.now(),
                    },
                  ],
                  last_used: null,
                },
        ),
        {
          status: denied ? 401 : 200,
          headers: { "content-type": "application/json" },
        },
      ),
  );
  const owner = createAgentAccountSession("me@test", { api });
  await owner.refresh();
  expect(owner.current()).toBe(false);
  const target = document.createElement("div");
  document.body.append(target);
  const view = mountView("agentSettings", target, {
    owner,
    origin: "https://vibebook.dev",
    vb,
    lang: "en",
  });
  active.push(view);
  peopleCleanups.push(() => owner.dispose());
  flushSync();
  await tick();
  await owner.refresh();
  flushSync();
  await tick();
  denied = false;
  const retryButtons = [
    ...target.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const retryButton = retryButtons.find(
    (button) => button.textContent?.trim() === "Retry",
  );
  expect(
    retryButton,
    JSON.stringify(retryButtons.map((button) => button.textContent)),
  ).toBeDefined();
  expect(retryButton?.disabled).toBe(false);
  retryButton!.click();
  for (let frame = 0; frame < 10 && !owner.current(); frame++) {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    flushSync();
    await tick();
  }
  expect(owner.current()).toBe(true);
  expect(target.textContent).toContain("Recovered agent");
}, 30_000);
// Source-only MCP catalog ownership; real iframe/remote OAuth gates run separately.
describe("Apps catalog", () => {
  async function appsFixture() {
    const { createAppsSession } = await import("../web/features/apps/session");
    const { toolOutput } = await import("../web/features/apps/tools");
    const connection = {
      id: "abcdef123456",
      title: "<img src=x onerror=alert(1)>",
      host: "example.test",
      scope: "me" as const,
      owner: "me@test",
      mine: true,
      created_at: 1,
      auth: "identity" as const,
      signed_in: true,
      apps: [
        {
          tool: "screen",
          title: "Screen",
          description: "<script>untrusted</script>",
          screen: true,
        },
      ],
      tools: [],
      context: {},
    };
    let writes = 0,
      uiReads = 0,
      bridgeLoads = 0;
    const api: import("../web/features/apps/api").AppsApi = {
      identity: async () => ({ direct: false, why: "signed_in" }),
      list: async () => ({ connections: [connection] }),
      create: async () => {
        writes++;
        return {
          ok: true as const,
          connection: { ...connection, needs_sign_in: false },
        };
      },
      remove: async () => ({ ok: true as const }),
      refresh: async () => ({ ok: true as const, connection }),
      signout: async () => ({ ok: true as const }),
      ui: async () => {
        uiReads++;
        return { html: "<p>UI</p>", tool: { name: "screen" } };
      },
      call: async () => ({ result: toolOutput("result") }),
      context: async () => ({ ok: true as const }),
    };
    const canonical = fixture(),
      owner = createAppsSession(api, {
        current: () => true,
        navigate: () => {},
      });
    owner.sync(canonical);
    owner.load();
    await Promise.resolve();
    await tick();
    flushSync();
    const target = document.createElement("div");
    document.body.append(target);
    const props = {
      owner,
      api,
      room: canonical,
      thread: "main",
      lang: "pt",
      current: () => true,
      checkAccess: () => {},
      request: async () => ({ ok: true as const }),
      t: (text: string) => text,
      name: (email: string) => email,
      ago: () => "now",
      openLink: () => {},
      metric: async () => ({}),
    };
    const view = mountView("apps", target, {
      props: {
        ...props,
        loadBridge: async () => {
          bridgeLoads++;
          throw new Error("Controlled bridge boundary");
        },
      },
    });
    active.push(view);
    peopleCleanups.push(() => owner.dispose());
    await tick();
    flushSync();
    return {
      owner,
      target,
      canonical,
      writes: () => writes,
      uiReads: () => uiReads,
      bridgeLoads: () => bridgeLoads,
    };
  }
  test("agent-triggered remote panel waits for reader Allow, fences stale connected grants and direct Open needs no second grant", async () => {
    const h = await appsFixture();
    const settle = async () => {
      for (let i = 0; i < 12; i++) {
        await Promise.resolve();
        await tick();
        flushSync();
      }
    };
    const button = (text: string) =>
      [...h.target.querySelectorAll<HTMLButtonElement>("button")].find(
        (b) => b.textContent?.trim() === text,
      )!;
    const target = { connection: "abcdef123456", tool: "screen" };
    h.owner.open(target, { requireOpeningConsent: true });
    await settle();
    expect(button("Permitir")).toBeDefined();
    expect(h.bridgeLoads()).toBe(0);
    expect(h.uiReads()).toBe(0);
    const old = button("Permitir");
    h.owner.open(target, { requireOpeningConsent: true });
    expect(old.isConnected).toBe(true);
    old.click();
    await settle();
    expect(h.bridgeLoads()).toBe(0);
    button("Cancelar").click();
    await settle();
    expect(h.bridgeLoads()).toBe(0);
    h.owner.reload();
    await settle();
    button("Permitir").click();
    await settle();
    expect(h.bridgeLoads()).toBe(1);
    h.owner.open(target);
    await settle();
    expect(h.bridgeLoads()).toBe(2);
    expect(button("Permitir")).toBeUndefined();
  });
  test("catalog text is escaped and form URL/scope drafts survive canonical catalog refresh", async () => {
    const h = await appsFixture();
    expect(h.target.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(h.target.querySelector("img,script") === null).toBe(true);
    h.owner.form(true);
    await tick();
    flushSync();
    const input = h.target.querySelector<HTMLInputElement>(
      'input[placeholder="https://…/mcp"]',
    )!;
    input.value = "https://server.example.test/mcp";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    h.target
      .querySelector<HTMLButtonElement>('[role="radio"][data-value="room"]')!
      .click();
    flushSync();
    h.owner.load();
    await Promise.resolve();
    await tick();
    flushSync();
    expect(input.value).toBe("https://server.example.test/mcp");
    expect(get(h.owner.state).scope).toBe("room");
  }, 30_000);
  test("connected old app toolbar cannot reload or leave a replacement target before DOM flush", async () => {
    const h = await appsFixture();
    h.owner.open({ connection: "room", tool: "missing-a" });
    flushSync();
    await tick();
    const button = (label: string) =>
      [...h.target.querySelectorAll<HTMLButtonElement>("button")].find(
        (value) => value.textContent?.trim() === label,
      );
    const oldReload = button("Recarregar")!,
      oldBack = button("← Apps")!;
    expect(!!oldReload && !!oldBack).toBe(true);
    h.owner.open({ connection: "room", tool: "missing-b" });
    const before = get(h.owner.state);
    expect(oldReload.isConnected && oldBack.isConnected).toBe(true);
    oldReload.click();
    oldBack.click();
    expect(get(h.owner.state).target === before.target).toBe(true);
    expect(get(h.owner.state).frameRevision).toBe(before.frameRevision);
    flushSync();
    await tick();
    button("Recarregar")!.click();
    expect(get(h.owner.state).frameRevision).toBe(before.frameRevision + 1);
    flushSync();
    await tick();
    button("← Apps")!.click();
    expect(get(h.owner.state).target).toBeNull();
  }, 30_000);
  test("known membership loss immediately fences still-connected forms and removes private catalog on DOM update", async () => {
    const h = await appsFixture();
    h.owner.form(true);
    await tick();
    flushSync();
    const form = h.target.querySelector("form")!,
      input = form.querySelector("input")!;
    h.owner.sync({ ...h.canonical, members: [] });
    input.value = "https://stale.example.test/mcp";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    expect(h.writes()).toBe(0);
    expect(get(h.owner.state).url).toBe("");
    await tick();
    flushSync();
    expect(h.target.querySelector("[data-apps]") === null).toBe(true);
    expect(h.target.querySelector("[data-apps-denied]") !== null).toBe(true);
    expect(h.target.textContent).not.toContain("example.test");
  }, 30_000);
});

// Controlled bridge dependency only: real iframe/MessagePort privacy is covered by the browser suite.
/** A doc app's height select (Gui #3153): open it from the keyboard and pick the option with that label. */
async function pickSize(root: Element, label: string) {
  const trigger = root.querySelector<HTMLElement>("[data-select-trigger]")!;
  trigger.focus();
  trigger.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
  );
  await new Promise((done) => setTimeout(done, 50));
  const item = [
    ...document.querySelectorAll<HTMLElement>("[data-select-item]"),
  ].find((option) => option.textContent?.trim() === label)!;
  item.dispatchEvent(
    new PointerEvent("pointerup", { bubbles: true, pointerType: "mouse" }),
  );
  item.click();
  await new Promise((done) => setTimeout(done, 0));
}
test("document inline Apps keep independent consent and stable frames, and revoke removed-marker callbacks before flush", async () => {
  const { createAppsSession } = await import("../web/features/apps/session");
  const protocol = await import("../web/features/apps/bridge");
  const { toolOutput } = await import("../web/features/apps/tools");
  type Options = import("../web/features/apps/bridge").RoomAppBridgeOptions;
  const bridges: Options[] = [],
    calls: string[] = [],
    uiReads: string[] = [],
    bridgeLoads: string[] = [],
    writes: RoomCommand[] = [],
    puts: { connection: string; tool: string }[] = [];
  const connection: import("../shared/schemas").Connection = {
    id: "abcdef123456",
    title: "Controlled connection",
    host: "example.test",
    scope: "room",
    owner: "me@test",
    mine: true,
    created_at: 1,
    auth: "identity",
    signed_in: true,
    apps: [
      {
        tool: "screen",
        title: "Screen",
        description: "Controlled screen",
        screen: true,
      },
      {
        tool: "other",
        title: "Other",
        description: "Controlled other",
        screen: true,
      },
    ],
    tools: [
      {
        name: "screen",
        description: "Controlled mutating tool",
        read_only: false,
        app: true,
      },
      {
        name: "other",
        description: "Controlled mutating tool",
        read_only: false,
        app: true,
      },
    ],
    context: {},
  };
  const api: import("../web/features/apps/api").AppsApi = {
    identity: async () => ({ direct: false, why: "signed_in" }),
    list: async () => ({ connections: [connection] }),
    create: async () => ({
      ok: true,
      connection: { ...connection, needs_sign_in: false },
    }),
    remove: async () => ({ ok: true }),
    refresh: async () => ({ ok: true, connection }),
    signout: async () => ({ ok: true }),
    ui: async (_cid, tool) => {
      uiReads.push(tool);
      return {
        html: "<p>Controlled UI</p>",
        tool: { name: tool, annotations: { readOnlyHint: false } },
      };
    },
    call: async (_cid, tool) => {
      calls.push(tool);
      return { result: toolOutput("controlled result") };
    },
    context: async () => ({ ok: true }),
  };
  let canonical = {
    ...fixture(),
    doc: "[[app:abcdef123456/screen|m]]\n\n[[app:abcdef123456/other|m]]\n",
  };
  const timers = new Map<number, { callback: () => void; delay: number }>();
  let nextTimer = 0;
  const owner = createDocumentSession({
    drafts: createDocumentDrafts(),
    request: async (command) => {
      writes.push(command);
      return { ok: true };
    },
    schedule: (callback, delay) => {
      timers.set(++nextTimer, { callback, delay });
      return nextTimer;
    },
    cancel: (timer) => {
      if (typeof timer === "number") timers.delete(timer);
    },
    name: () => "Member",
    color: () => "#123456",
  });
  owner.sync(canonical, "main");
  const appsOwner = createAppsSession(api, {
    current: () => owner.authorized(),
    navigate() {},
  });
  appsOwner.sync(canonical);
  const appProps: import("../web/features/apps/types").AppsProps = {
    owner: appsOwner,
    api,
    room: canonical,
    request: async () => ({ ok: true }),
    current: () => owner.authorized(),
    checkAccess() {},
    name: (email) => email,
    ago: () => "now",
    t: (text) => text,
    lang: "pt",
    thread: "main",
    openLink() {},
    metric: async () => ({}),
    putInDocument: (target) => puts.push(target),
    loadBridge: async () => {
      bridgeLoads.push("load");
      return {
        appToolInfo: protocol.appToolInfo,
        remoteToolResult: protocol.remoteToolResult,
        createRoomAppBridge: (options) => {
          bridges.push(options);
          let active = true;
          return {
            ready: Promise.resolve(),
            active: () => active && options.current(),
            attest: async () => active && options.current(),
            loadHtml() {},
            loadFile() {},
            update() {},
            dispose() {
              active = false;
            },
          };
        },
      };
    },
  };
  const props: DocumentProps = {
    room: canonical,
    thread: "main",
    lang: "pt",
    pane: "doc",
    send: () => true,
    taskProps: {
      room: canonical,
      thread: "main",
      vb,
      send: () => true,
      request: async () => ({ ok: true }),
    },
    actions: { navigate() {}, openFile() {} },
    onPane() {},
    onAuthorize() {},
    apps: appProps,
  };
  const target = document.createElement("div");
  document.body.append(target);
  const view = mountView("document", target, { owner, props });
  active.push(view);
  peopleCleanups.push(() => {
    owner.dispose();
    appsOwner.dispose();
  });
  const settled = async () => {
    for (let i = 0; i < 30; i++) {
      await Promise.resolve();
      await tick();
      flushSync();
    }
  };
  const button = (root: ParentNode, label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>("button")].find(
      (value) => value.textContent?.trim() === label,
    )!;
  await settled();
  const cards = [...target.querySelectorAll("[data-document-app]")];
  expect(cards).toHaveLength(2);
  expect(calls).toEqual([]);
  expect(uiReads).toEqual([]);
  expect(bridgeLoads).toEqual([]);
  expect(bridges).toEqual([]);
  button(cards[1]!, "Cancelar").click();
  await settled();
  expect(cards[1]!.textContent).toContain("App não aberto.");
  expect(calls).toEqual([]);
  button(cards[0]!, "Permitir").click();
  await settled();
  expect(calls).toEqual(["screen"]);
  expect(uiReads).toEqual(["screen"]);
  expect(bridges).toHaveLength(1);
  button(cards[1]!, "Reabrir").click();
  await settled();
  expect(calls).toEqual(["screen"]);
  expect(bridges).toHaveLength(1);
  button(cards[1]!, "Permitir").click();
  await settled();
  const frames = [...target.querySelectorAll("iframe")];
  expect(frames).toHaveLength(2);
  expect(bridges).toHaveLength(2);
  expect(calls.slice().sort()).toEqual(["other", "screen"]);
  const first = bridges.find((bridge) => bridge.frame === frames[0])!,
    second = bridges.find((bridge) => bridge.frame === frames[1])!;
  const askA = first.ask("write A", "independent A"),
    askB = second.ask("write B", "independent B");
  await settled();
  button(cards[0]!, "Permitir").click();
  button(cards[1]!, "Cancelar").click();
  await settled();
  await expect(askA).resolves.toBe(true);
  await expect(askB).resolves.toBe(false);
  canonical = { ...canonical, doc: "New prose\n\n" + canonical.doc };
  owner.sync(canonical, "main");
  view.update({
    owner,
    props: {
      ...props,
      room: canonical,
      apps: { ...appProps, room: canonical },
    },
  });
  await settled();
  expect([...target.querySelectorAll("iframe")]).toEqual(frames);
  expect(calls).toHaveLength(2);
  // The height is one select (Gui #3153): open it, pick one.
  await pickSize(target.querySelector("[data-document-app]")!, "Grande");
  expect(get(owner.state).text).toContain("screen|g");
  expect([...target.querySelectorAll("iframe")]).toEqual(frames);
  expect(calls).toHaveLength(2);
  for (const [id, timer] of [...timers])
    if (timer.delay === 400) {
      timers.delete(id);
      timer.callback();
    }
  await settled();
  expect(writes.filter((command) => command.t === "doc")).toHaveLength(1);
  canonical = { ...canonical, doc: get(owner.state).text };
  owner.sync(canonical, "main");
  await settled();
  // Reparenting is an explicit marker move. Subsequent nested prose/size edits must keep these grants.
  canonical = {
    ...canonical,
    doc: "> Quote\n>\n> [[app:abcdef123456/screen|g]]\n\n- Intro\n\n  [[app:abcdef123456/other|m]]\n\n- Next\n",
  };
  owner.sync(canonical, "main");
  view.update({
    owner,
    props: {
      ...props,
      room: canonical,
      apps: { ...appProps, room: canonical },
    },
  });
  await settled();
  const callsBeforeNestedGrant = calls.length;
  const nestedCards = [...target.querySelectorAll("[data-document-app]")];
  expect(bridges.filter((bridge) => bridge.current())).toHaveLength(0);
  expect(calls).toHaveLength(callsBeforeNestedGrant);
  for (const card of nestedCards) button(card, "Permitir").click();
  await settled();
  expect(calls).toHaveLength(callsBeforeNestedGrant + 2);
  const nestedFrames = [...target.querySelectorAll("iframe")],
    nestedCalls = calls.length;
  expect(nestedFrames).toHaveLength(2);
  expect(target.querySelector("blockquote [data-document-app]")).not.toBeNull();
  expect(target.querySelector("li [data-document-app]")).not.toBeNull();
  canonical = {
    ...canonical,
    doc: canonical.doc.replace("> Quote", "> New lead\n>\n> Quote"),
  };
  owner.sync(canonical, "main");
  view.update({
    owner,
    props: {
      ...props,
      room: canonical,
      apps: { ...appProps, room: canonical },
    },
  });
  await settled();
  expect([...target.querySelectorAll("iframe")]).toEqual(nestedFrames);
  expect(calls).toHaveLength(nestedCalls);
  await pickSize(
    target.querySelector("blockquote [data-document-app]")!,
    "Pequeno",
  );
  await settled();
  expect(get(owner.state).text).toContain("> [[app:abcdef123456/screen|p]]");
  expect([...target.querySelectorAll("iframe")]).toEqual(nestedFrames);
  expect(calls).toHaveLength(nestedCalls);
  for (const [id, timer] of [...timers])
    if (timer.delay === 400) {
      timers.delete(id);
      timer.callback();
    }
  await settled();
  canonical = { ...canonical, doc: get(owner.state).text };
  owner.sync(canonical, "main");
  await settled();
  const oldFrame = nestedFrames[0]!,
    old = bridges.find((bridge) => bridge.frame === oldFrame)!;
  canonical = { ...canonical, doc: "[[app:abcdef123456/other|m]]\n" };
  owner.sync(canonical, "main");
  expect(oldFrame.isConnected).toBe(true);
  expect(old.current()).toBe(false);
  const before = calls.length;
  await expect(old.ask("removed write", "must be refused")).resolves.toBe(
    false,
  );
  await expect(old.call("screen", {})).rejects.toThrow();
  expect(calls).toHaveLength(before);
  view.update({
    owner,
    props: {
      ...props,
      room: canonical,
      apps: { ...appProps, room: canonical },
    },
  });
  await settled();
  expect(oldFrame.isConnected).toBe(false);
  const staleAllow = button(
      target.querySelector("[data-document-app]")!,
      "Permitir",
    ),
    callsBeforeRemoval = calls.length;
  canonical = { ...canonical, doc: "" };
  owner.sync(canonical, "main");
  expect(staleAllow.isConnected).toBe(true);
  staleAllow.click();
  expect(calls).toHaveLength(callsBeforeRemoval);
  view.update({
    owner,
    props: {
      ...props,
      room: canonical,
      apps: { ...appProps, room: canonical },
    },
  });
  await settled();
  expect(target.querySelector("[data-document-app]")).toBeNull();
  // The Apps toolbar's existing immutable-target callback is exercised with the same real catalog owner.
  appsOwner.load();
  await settled();
  appsOwner.open({ connection: connection.id, tool: "screen" });
  const appsTarget = document.createElement("div");
  document.body.append(appsTarget);
  const appsView = mountView("apps", appsTarget, {
    props: { ...appProps, room: canonical },
  });
  active.push(appsView);
  await settled();
  button(appsTarget, "Pôr no doc").click();
  expect(puts).toEqual([{ connection: connection.id, tool: "screen" }]);
}, 30_000);

describe("People & agents presence", () => {
  type Agent = NonNullable<
    ComponentProps<
      typeof import("../web/features/room-sidebar/AgentPresenceRows.svelte").default
    >["presence"]
  >["agents"][number];
  const agent = (extra: Partial<Agent> = {}): Agent => ({
    email: "me@test",
    who: "claude-opus-5-5",
    repo: "vibebook.dev",
    listening: true,
    all_rooms: false,
    seen_at: 1,
    context: null,
    ...extra,
  });
  async function rows(
    agents: Agent[],
    extra: { surface?: "sidebar" | "background" } = {},
  ) {
    const { default: AgentPresenceRows } =
      await import("../web/features/room-sidebar/AgentPresenceRows.svelte");
    const target = document.createElement("div");
    document.body.append(target);
    const instance = flushSync(() =>
      mount(AgentPresenceRows, {
        target,
        props: {
          presence: { agents, sandboxes: [] },
          email: "me@test",
          t: vb.t,
          name: () => "Ana",
          ago: () => "5 min",
          locale: "en-US",
          ...extra,
        },
      }),
    );
    active.push({
      destroy: () =>
        flushSync(() => {
          void unmount(instance);
        }),
    });
    return target;
  }
  /** The open hover card / tooltip (bits portals it onto the body). */
  const floating = () =>
    document.body.querySelector<HTMLElement>(
      "[data-hover-card], [data-tooltip-content]",
    );
  async function hover(trigger: HTMLElement) {
    trigger.focus();
    await tick();
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 150));
    flushSync();
  }
  /** A finger tap: bits ignores touch focus, so only the tap toggle can open it. */
  async function tap(trigger: HTMLElement) {
    trigger.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerType: "touch" }),
    );
    trigger.click();
    await settle();
  }
  /** Lets a closing card finish its exit before checking it is gone. */
  async function settle() {
    await tick();
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 150));
    flushSync();
  }

  test("provider detection picks the agent and tints the tile", async () => {
    const { agentProvider, agentMark, AGENT_TILES } =
      await import("../web/lib/components/agent");
    const table: [string | null, string, string][] = [
      ["Codex", "codex", "◎"],
      ["gpt-5.1-codex", "codex", "◎"],
      ["OpenAI agent", "codex", "◎"],
      ["o3", "codex", "◎"],
      ["gemini-3-pro", "gemini", "✦"],
      ["Antigravity", "gemini", "✦"],
      ["Cursor", "cursor", "▲"],
      ["GitHub Copilot", "copilot", "◉"],
      ["claude-opus-5-5", "claude", "✻"],
      ["vibebook CLI", "claude", "✻"],
      ["solo3d", "claude", "✻"],
      [null, "claude", "✻"],
    ];
    for (const [via, provider, mark] of table) {
      expect(agentProvider(via), String(via)).toBe(provider as never);
      expect(agentMark(via), String(via)).toBe(mark);
    }
    const target = await rows([
      agent({ who: "Codex" }),
      agent({ who: "gemini-3-pro", repo: "other" }),
      agent({ who: "claude-sonnet-5-0", repo: "third" }),
    ]);
    const tiles = [...target.querySelectorAll("[data-agent-presence]")].map(
      (row) => [
        row.getAttribute("data-agent-provider"),
        row.querySelector("[data-avatar]")?.textContent?.trim(),
        row
          .querySelector("[data-agent-tile]")
          ?.className.includes(
            AGENT_TILES[
              row.getAttribute(
                "data-agent-provider",
              ) as keyof typeof AGENT_TILES
            ].split(" ")[0]!,
          ),
      ],
    );
    expect(tiles).toEqual([
      ["codex", "◎", true],
      ["gemini", "✦", true],
      ["claude", "✻", true],
    ]);
  });

  test("agent dot shows listening; the row has no native title or Contexto disclosure", async () => {
    const target = await rows([
      agent(),
      agent({ who: "Codex", listening: false, seen_at: 5 }),
    ]);
    const list = [...target.querySelectorAll("[data-agent-presence]")];
    expect(
      list.map((row) =>
        row.querySelector("[data-status-dot]")?.getAttribute("data-status-dot"),
      ),
    ).toEqual(["listening", "idle"]);
    expect(
      list[0]!.querySelector("[data-status-dot]")!.className.split(/\s+/),
    ).toContain("bg-brand");
    expect(
      list[1]!.querySelector("[data-status-dot]")!.className.split(/\s+/),
    ).toContain("bg-muted-foreground");
    expect(target.querySelector("[title]") === null).toBe(true);
    expect(target.querySelector("details") === null).toBe(true);
    expect(list[1]!.textContent).toContain("5 min");
  });

  test("context bar: width is the percent, green, yellow from 60%, red from 80%", async () => {
    const { contextTone, compactTokens } =
      await import("../web/features/room-sidebar/model");
    expect([0, 59, 60, 79, 80, 100].map(contextTone)).toEqual([
      "ok",
      "ok",
      "mid",
      "mid",
      "hot",
      "hot",
    ]);
    expect([999, 180_400, 1_000_000, 1_250_000].map(compactTokens)).toEqual([
      "1k",
      "180k",
      "1M",
      "1.3M",
    ]);
    const cases: [number, number, string][] = [
      [30_000, 100_000, "text-brand"],
      [60_000, 100_000, "text-warning"],
      [80_000, 100_000, "text-destructive"],
      [250_000, 200_000, "text-destructive"],
    ];
    for (const [tokens, window, color] of cases) {
      const target = await rows([
        agent({ context: { tokens, window, at: 1, limits: null } }),
      ]);
      const bar = target.querySelector<HTMLElement>(
        "[data-agent-presence] [data-context-bar]",
      )!;
      const percent = Math.min(100, Math.round((tokens / window) * 100));
      // The Studio bar: a native progress inside, painted in the bar's current color.
      expect(bar.querySelector("progress")?.getAttribute("value")).toBe(
        String(percent),
      );
      expect(bar.querySelector("progress")?.getAttribute("max")).toBe("100");
      expect(bar.className.split(/\s+/)).toContain(`[&_progress]:${color}`);
      expect(
        target.querySelector("[data-agent-presence]")?.textContent,
      ).toContain(`${percent}%`);
      target.remove();
    }
    const none = await rows([agent()]);
    expect(none.querySelector("[data-context-bar]") === null).toBe(true);
  });

  test("hover card: title, repo and state, then context and the limits not yet reset", async () => {
    const now = Date.now() / 1000;
    const target = await rows([
      agent({
        context: {
          tokens: 180_000,
          window: 200_000,
          at: 1,
          limits: {
            five_hour: { p: 42, r: Math.round(now + 3600) },
            seven_day: { p: 12, r: Math.round(now - 60) },
          },
        },
      }),
    ]);
    const row = target.querySelector<HTMLElement>("[data-agent-presence]")!;
    await hover(row);
    const card = floating();
    expect(card !== null).toBe(true);
    expect(card!.querySelector("[data-hover-title]")?.textContent?.trim()).toBe(
      "Claude Opus 5.5 · Ana",
    );
    expect(card!.textContent).toContain(
      "vibebook.dev · ouvindo esta sala agora",
    );
    expect(
      [...card!.querySelectorAll("[data-hover-section]")].map((section) =>
        section.getAttribute("data-hover-section"),
      ),
    ).toEqual(["context", "five_hour"]);
    const context = card!.querySelector('[data-hover-section="context"]')!;
    expect(context.textContent).toContain("Contexto");
    expect(context.textContent).toContain("90% · 180k/200k");
    expect(context.querySelector("progress")?.getAttribute("value")).toBe("90");
    expect(
      context.querySelector("[data-slot=progress]")?.className.split(/\s+/),
    ).toContain("[&_progress]:text-destructive");
    const session = card!.querySelector('[data-hover-section="five_hour"]')!;
    expect(session.textContent).toContain("Sessão de 5h");
    expect(session.textContent).toMatch(/42% · reseta \d{2}:\d{2}/);
  });

  test("hover card: a tap toggles it on touch, Escape closes it, all-rooms label", async () => {
    const target = await rows([agent({ all_rooms: true })]);
    const row = target.querySelector<HTMLElement>("[data-agent-presence]")!;
    await tap(row);
    expect(floating()?.textContent).toContain("ouvindo todas as salas agora");
    await tap(row);
    expect(document.body.querySelector("[data-hover-card]") === null).toBe(
      true,
    );
    // A fresh row: bits ignores focus right after a touch pointer.
    const keyboard = (await rows([agent()])).querySelector<HTMLElement>(
      "[data-agent-presence]",
    )!;
    await hover(keyboard);
    expect(floating() !== null).toBe(true);
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await settle();
    expect(document.body.querySelector("[data-hover-card]") === null).toBe(
      true,
    );
  });

  test("rows on the page background use its ring and hover tint", async () => {
    const sidebar = (await rows([agent()])).querySelector(
      "[data-agent-presence]",
    )!;
    expect(sidebar.className.split(/\s+/)).toContain("hover:bg-sidebar-accent");
    expect(
      sidebar.querySelector("[data-status-dot]")!.className.split(/\s+/),
    ).toContain("ring-sidebar");
    const pane = (
      await rows([agent()], { surface: "background" })
    ).querySelector("[data-agent-presence]")!;
    expect(pane.className.split(/\s+/)).toContain("hover:bg-accent");
    expect(pane.className.split(/\s+/)).not.toContain("bg-sidebar-accent");
    expect(
      pane.querySelector("[data-status-dot]")!.className.split(/\s+/),
    ).toContain("ring-background");
  });

  test("hover card without context shows only who, repo and state", async () => {
    const target = await rows([
      agent({ listening: false, seen_at: 5, repo: null, who: "Codex" }),
    ]);
    await hover(target.querySelector<HTMLElement>("[data-agent-presence]")!);
    const card = floating()!;
    expect(card.querySelector("[data-hover-title]")?.textContent?.trim()).toBe(
      "Codex · Ana",
    );
    expect(card.textContent).toContain("visto há 5 min");
    expect(card.querySelectorAll("[data-hover-section]")).toHaveLength(0);
  });

  test("weekly limit shows its weekday; limits without context are not shown", async () => {
    const { contextSections } =
      await import("../web/features/room-sidebar/model");
    const now = Date.UTC(2026, 10, 16, 12) / 1000;
    const sections = contextSections(
      {
        tokens: 10_000,
        window: 200_000,
        at: 1,
        limits: { seven_day: { p: 70, r: now + 86_400 } },
      },
      vb.t,
      "en-US",
      now * 1000,
    );
    expect(sections.map((section) => section.key)).toEqual([
      "context",
      "seven_day",
    ]);
    expect(sections[1]!.detail).toMatch(
      /^70% · reseta [A-Z][a-z]{2} \d{2}:\d{2}/,
    );
    expect(contextSections(null, vb.t, "en-US")).toEqual([]);
  });

  test("person rows: a status dot on the avatar with an Online/Offline tooltip, no pill", async () => {
    const room: Room = {
      ...fixture(),
      me: "me@test",
      members: ["me@test", "on@test", "off@test", "wait@test"],
      online: ["on@test"],
      pending: ["wait@test"],
    };
    const target = document.createElement("div");
    document.body.append(target);
    const values = writable<Record<string, unknown>>({ room, vb });
    const component = People as unknown as Component<Record<string, unknown>>;
    const instance = flushSync(() =>
      mount(PeopleView, { target, props: { component, values } }),
    );
    active.push({
      destroy: () =>
        flushSync(() => {
          void unmount(instance);
        }),
    });
    const dot = (email: string) =>
      target
        .querySelector(`[data-person="${email}"] [data-status-dot]`)
        ?.getAttribute("data-status-dot") ?? null;
    expect(["me@test", "on@test", "off@test", "wait@test"].map(dot)).toEqual([
      "online",
      "online",
      "offline",
      null,
    ]);
    expect(
      target.querySelector('[data-person="on@test"] [data-status-dot]')!
        .className,
    ).toContain("ring-sidebar");
    // No online/offline text pill any more.
    expect(
      [...target.querySelectorAll("[data-person]")].some((row) =>
        /\b(online|offline)\b/.test(row.textContent ?? ""),
      ),
    ).toBe(false);
    const face = target.querySelector<HTMLElement>(
      '[data-person="off@test"] [data-presence]',
    )!;
    expect(face.hasAttribute("title")).toBe(false);
    expect(face.getAttribute("aria-label")).toBe("off@test · Offline");
    await hover(face);
    expect(floating()?.textContent?.trim()).toBe("Offline");
    face.blur();
    const on = target.querySelector<HTMLElement>(
      '[data-person="on@test"] [data-presence]',
    )!;
    await hover(on);
    expect(
      [...document.body.querySelectorAll("[data-tooltip-content]")].some(
        (tip) => tip.textContent?.trim() === "Online",
      ),
    ).toBe(true);
  });

  test("person avatar tooltip also opens with a tap on touch screens", async () => {
    const room: Room = {
      ...fixture(),
      me: "me@test",
      members: ["me@test", "off@test"],
      online: [],
    };
    const target = document.createElement("div");
    document.body.append(target);
    const values = writable<Record<string, unknown>>({ room, vb });
    const component = People as unknown as Component<Record<string, unknown>>;
    const instance = flushSync(() =>
      mount(PeopleView, { target, props: { component, values } }),
    );
    active.push({
      destroy: () =>
        flushSync(() => {
          void unmount(instance);
        }),
    });
    const face = target.querySelector<HTMLElement>(
      '[data-person="off@test"] [data-presence]',
    )!;
    await tap(face);
    expect(floating()?.textContent?.trim()).toBe("Offline");
    await tap(face);
    expect(document.body.querySelector("[data-tooltip-content]") === null).toBe(
      true,
    );
  });
});
