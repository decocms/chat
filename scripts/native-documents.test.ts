import {
  documentAppMarkers,
  documentEmbedsApp,
  documentAppKey,
  createDocumentAppAuthority,
  resizeDocumentApp,
  appendDocumentApp,
} from "../svelte/features/documents/appMarkers";
// Focused adapter/model fixtures. No Worker, real Yjs transport, renderer CDN or browser acceptance.
import { afterAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { get } from "svelte/store";
import type { Room } from "../shared/room";
import type { AuthApi } from "../svelte/features/auth/api";
import type { CommandOutcome } from "../shared/commands";
import type { RequestRoomCommand } from "../svelte/roomConnection";
import type { RoomCommand } from "../shared/commands";
import {
  documentTarget,
  safeAwareness,
} from "../svelte/features/documents/model";
import {
  createDocumentDrafts,
  createDocumentSession,
} from "../svelte/features/documents/session";
import type {
  Editor,
  EditorModule,
  EditorOptions,
} from "../svelte/features/documents/types";
import { richText, parseRichSource } from "./rich-text-fixture";
import { createRichSession } from "./rich-text-fixture";
import type { RichContext, RichNode } from "../svelte/features/rich-text/types";
import {
  documentBlocks,
  documentAppNodes,
  documentCardSource,
  mermaidSource,
} from "../svelte/features/documents/preview";
import {
  diagramNodes as projectDiagramNodes,
  renderDiagram,
  createPeleLoader,
} from "../svelte/features/documents/mermaid";
import { createHtmlTree } from "../svelte/features/rich-text/htmlTree";
const diagramNodes = (svg: string, ctx: RichContext) =>
  projectDiagramNodes(svg, ctx, createHtmlTree);
const environment = new Window();
const descriptor = Object.getOwnPropertyDescriptor(globalThis, "document");
Reflect.set(globalThis, "document", environment.document);
afterAll(() => {
  if (descriptor) Object.defineProperty(globalThis, "document", descriptor);
  else Reflect.deleteProperty(globalThis, "document");
  void environment.happyDOM.close();
});
const room = (
  id = "aaaaaa",
  me = "owner@example.test",
): Room & { doc: string } => ({
  id,
  me,
  book: { title: "Room", owner: me },
  members: [me],
  online: [],
  typing: {},
  messages: [],
  suggestions: [],
  doc: "# Room\n\nOriginal",
  docs: { epic: "# Epic\n\nText" },
  epics: [{ id: "epic", title: "Epic", tasks: [], archived: false }],
});
const context = (policy?: RichContext["policy"]): RichContext => ({
  room: room(),
  pageUrl: "https://vibebook.test/b/aaaaaa?ui=svelte",
  idPrefix: "private-doc",
  policy,
});
function descendants(nodes: readonly RichNode[]): RichNode[] {
  return nodes.flatMap((node) => [
    node,
    ...("children" in node ? descendants(node.children) : []),
  ]);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = async () => {
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
};
function clock() {
  let next = 0;
  const callbacks = new Map<number, () => void>(),
    cancelled = new Set<number>();
  return {
    schedule(callback: () => void) {
      callbacks.set(++next, callback);
      return next;
    },
    cancel(id: number | ReturnType<typeof setTimeout>) {
      if (typeof id === "number") cancelled.add(id);
    },
    run(includeCancelled = false) {
      for (const [id, callback] of [...callbacks]) {
        callbacks.delete(id);
        if (includeCancelled || !cancelled.has(id)) callback();
      }
    },
  };
}
function setup(
  load?: () => Promise<EditorModule>,
  requestOverride?: RequestRoomCommand,
  accessOverride?: AuthApi["access"],
) {
  let pauses = 0,
    resumes = 0;
  const callbacks: EditorOptions[] = [],
    destroyed: number[] = [],
    writes: RoomCommand[] = [],
    fakeClock = clock(),
    drafts = createDocumentDrafts();
  let text = "",
    selection = { anchor: 0, head: 0 },
    scroll = 0;
  const module: EditorModule = {
    mountEditor(_element, options) {
      const index = callbacks.length;
      callbacks.push(options);
      const editor: Editor = {
        destroy() {
          destroyed.push(index);
          options.onStatus("disconnected");
        },
        pause() {
          pauses++;
        },
        resume() {
          resumes++;
          options.onStatus("connected");
          options.onSync(true);
          options.onText(text, false);
        },
        focus() {},
        replace(value) {
          text = value;
          options.onText(value, true);
        },
        text: () => text,
        selection: () => selection,
        setSelection(value) {
          selection = value;
        },
        scroll: () => scroll,
        setScroll(value) {
          scroll = value;
        },
      };
      return editor;
    },
  };
  const owner = createDocumentSession({
    drafts,
    access:
      accessOverride ??
      (async () => ({
        state: "ask",
        title: null,
        email: "owner@example.test",
      })),
    request(command) {
      writes.push(command);
      const ok: CommandOutcome = { ok: true };
      return requestOverride ? requestOverride(command) : Promise.resolve(ok);
    },
    load: load ?? (() => Promise.resolve(module)),
    schedule: fakeClock.schedule,
    cancel: fakeClock.cancel,
    name: () => "Owner",
    color: () => "#123456",
  });
  const element = document.createElement("div");
  document.body.append(element);
  owner.sync(room(), "main");
  owner.attach(element);
  return {
    owner,
    pauses: () => pauses,
    resumes: () => resumes,
    module,
    callbacks,
    destroyed,
    writes,
    clock: fakeClock,
    drafts,
    emit(textValue: string, local = true) {
      text = textValue;
      callbacks.at(-1)?.onText(textValue, local);
    },
  };
}
test("document targets are exact account/room/epic scopes and suggestions stay on room document", () => {
  const value = room();
  expect(documentTarget(value, "epic", false).epicId).toBe("epic");
  expect(documentTarget(value, "epic", true).epicId).toBeNull();
  expect(documentTarget(value, "pre:0", false).epicId).toBeNull();
  expect(documentTarget(value, "deleted", false).epicId).toBeNull();
  expect(documentTarget(value, "main", false)).toEqual({
    account: value.me,
    roomId: value.id,
    epicId: null,
  });
});
test("remote awareness labels/colors/cursors are normalized before vendor style interpolation", () => {
  const state = safeAwareness({
    user: {
      name: "A\u0000" + "x".repeat(100),
      color: "red; position:fixed; inset:0",
      colorLight: "url(https://evil.test)",
    },
    cursor: {
      anchor: { tname: "md", assoc: 0 },
      head: { tname: "md", assoc: -1 },
    },
  });
  expect(state.user).toEqual({
    name: "A" + "x".repeat(79),
    color: "#30bced",
    colorLight: "#30bced33",
  });
  expect(state).toHaveProperty("cursor");
  expect(
    safeAwareness({
      user: { name: "Peer", color: "#ab12ef", colorLight: "red" },
    }).user,
  ).toEqual({ name: "Peer", color: "#ab12ef", colorLight: "#ab12ef33" });
  expect(
    safeAwareness({
      cursor: {
        anchor: { tname: "md", item: { client: -1, clock: 2 } },
        head: { tname: "md" },
      },
    }),
  ).not.toHaveProperty("cursor");
});
test("only document policy permits safe HTTP or relative images; chat and file previews stay image-free", () => {
  const source =
    '![Shot](/api/books/aaaaaa/files/abc123) <img src="https://images.example.test/p.png" alt="remote" style="position:fixed" onload="alert(1)" data-cardgo="#eother">';
  const document = descendants(
      richText(source, "markdown", context("document")),
    ),
    images = document.filter(
      (node) => node.kind === "element" && node.tag === "img",
    );
  expect(images).toHaveLength(2);
  for (const image of images) {
    if (image.kind !== "element") throw Error("Expected image");
    expect(image.attrs.referrerpolicy).toBe("no-referrer");
    expect(image.attrs).not.toHaveProperty("style");
    expect(image.attrs).not.toHaveProperty("onload");
    expect(image.attrs).not.toHaveProperty("data-cardgo");
  }
  expect(
    descendants(richText(source, "markdown", context())).some(
      (node) => node.kind === "element" && node.tag === "img",
    ),
  ).toBe(false);
  expect(
    descendants(richText(source, "markdown", context("file-preview"))).some(
      (node) => node.kind === "element" && node.tag === "img",
    ),
  ).toBe(false);
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,x",
    "https://user:pass@images.example.test/x",
    "vbscript:evil()",
  ]) {
    expect(
      descendants(
        richText(`<img src="${url}">`, "markdown", context("document")),
      ).some((node) => node.kind === "element" && node.tag === "img"),
    ).toBe(false);
  }
});
test("named source budgets preserve full literal content and policy changes invalidate the component cache", () => {
  const text = "```text\n" + "a".repeat(70000) + "\n```";
  expect(parseRichSource(text, "markdown").literal).toBe(true);
  expect(parseRichSource(text, "markdown", "document").literal).not.toBe(true);
  expect(
    parseRichSource(
      "```text\n" + "a".repeat(200000) + "\n```",
      "markdown",
      "file-preview",
    ).literal,
  ).not.toBe(true);
  const oversized = "a".repeat(100001);
  expect(richText(oversized, "markdown", context("document"))).toEqual([
    { kind: "text", text: oversized },
  ]);
  const session = createRichSession(),
    source = "![safe](/file.png)";
  expect(
    descendants(session.render(source, "markdown", context())).some(
      (n) => n.kind === "element" && n.tag === "img",
    ),
  ).toBe(false);
  expect(
    descendants(session.render(source, "markdown", context("document"))).some(
      (n) => n.kind === "element" && n.tag === "img",
    ),
  ).toBe(true);
  session.dispose();
  const documentCode = descendants(
    richText("```text\n:smile:\n```", "markdown", context("document")),
  );
  expect(
    documentCode.some(
      (node) => node.kind === "text" && node.text.includes(":smile:"),
    ),
  ).toBe(true);
});
test("semantic live task placement replaces the existing heading/list or marker and keeps other content", () => {
  const nodes = richText(
    "# Intro\n\nHello\n\n## Tarefas\n\n- old task\n\nAfter",
    "markdown",
    context("document"),
  );
  const blocks = documentBlocks(nodes, true);
  expect(blocks.filter((block) => "tasks" in block)).toHaveLength(1);
  expect(
    blocks.some(
      (block) =>
        "node" in block &&
        block.node.kind === "element" &&
        block.node.tag === "ul",
    ),
  ).toBe(false);
  const marked = documentBlocks(
    richText(
      "# Intro\n\n[[tarefas]]\n\nAfter",
      "markdown",
      context("document"),
    ),
    true,
  );
  expect(marked[1]).toEqual({ tasks: true });
  expect(documentBlocks(nodes, false)).toHaveLength(nodes.length);
  const simple = documentBlocks(
    richText("# Title\n\nFirst\n\nSecond", "markdown", context("document")),
    true,
  );
  expect(simple[2]).toEqual({ tasks: true });
});
test("Mermaid output uses bounded native SVG projection with active/CSS/URL resources removed", async () => {
  const nodes = diagramNodes(
    '<svg viewBox="0 0 100 100"><style>body{display:none}</style><script>alert(1)</script><path id="x" d="M0 0L1 1" fill="red" onclick="evil()"/><animateTransform attributeName="transform"/><image href="https://evil.test/x"/><text>safe</text></svg>',
    context("document"),
  );
  const all = descendants(nodes);
  expect(
    all.some(
      (node) =>
        node.kind === "element" &&
        ["style", "script", "image", "animatetransform"].includes(node.tag),
    ),
  ).toBe(false);
  const path = all.find(
    (node) => node.kind === "element" && node.tag === "path",
  );
  expect(path?.kind === "element" && path.attrs).not.toHaveProperty("fill");
  expect(path?.kind === "element" && path.attrs).not.toHaveProperty("onclick");
  await expect(
    renderDiagram("x".repeat(16001), context(), 300, async () => {
      throw Error("Must not load");
    }),
  ).rejects.toThrow("Diagram source limit");
  const source = richText(
    "```mermaid\ngraph TD\nA-->B\n```",
    "markdown",
    context("document"),
  );
  expect(mermaidSource(source[0])).toContain("A-->B");
});
test("deferred editor A→B→A mounts only the latest target and never after disposal", async () => {
  const pending = deferred<EditorModule>(),
    h = setup(() => pending.promise);
  h.owner.mode("edit");
  h.owner.sync(room("bbbbbb"), "main");
  h.owner.sync(room(), "main");
  pending.resolve(h.module);
  await settle();
  expect(h.callbacks).toHaveLength(1);
  expect(h.callbacks[0].target.roomId).toBe("aaaaaa");
  h.owner.dispose();
  expect(h.destroyed).toEqual([0]);
  h.callbacks[0].onText("late", true);
  expect(get(h.owner.state).text).toBe("");
  const next = deferred<EditorModule>(),
    closed = setup(() => next.promise);
  closed.owner.mode("edit");
  closed.owner.dispose();
  next.resolve(closed.module);
  await settle();
  expect(closed.callbacks).toHaveLength(0);
});
test("temporary disconnect retains one CRDT editor; no competing fallback or whole-document send", async () => {
  const h = setup();
  h.owner.mode("edit");
  await settle();
  h.callbacks[0].onStatus("connected");
  h.callbacks[0].onSync(true);
  h.emit("local");
  h.callbacks[0].onStatus("disconnected");
  expect(get(h.owner.state).status).toBe("disconnected");
  expect(h.destroyed).toHaveLength(0);
  h.owner.sync({ ...room(), online: ["someone@example.test"] }, "main");
  expect(h.callbacks).toHaveLength(1);
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(0);
  h.callbacks[0].onStatus("connected");
  h.callbacks[0].onSync(true);
  expect(h.callbacks).toHaveLength(1);
  h.owner.dispose();
});
test("fallback debounce captures its original target and cannot write into another epic/account", async () => {
  const h = setup(() => Promise.reject(Error("Module unavailable")));
  h.owner.mode("edit");
  await settle();
  expect(get(h.owner.state).status).toBe("fallback");
  h.owner.input("room draft");
  h.owner.sync(room(), "epic");
  h.clock.run(true);
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(0);
  await settle();
  h.owner.input("epic draft");
  h.owner.sync(room("aaaaaa", "other@example.test"), "epic");
  h.clock.run(true);
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(0);
  expect(
    h.drafts.get({
      account: "owner@example.test",
      roomId: "aaaaaa",
      epicId: null,
    }),
  ).toBeUndefined();
  h.owner.dispose();
});
test("fallback sent state stays unconfirmed and retains draft until real canonical text matches", async () => {
  const h = setup(() => Promise.reject(Error("Module unavailable")));
  h.owner.mode("edit");
  await settle();
  h.owner.input("draft");
  h.clock.run();
  expect(h.writes).toContainEqual({ t: "doc", text: "draft", epic: undefined });
  expect(get(h.owner.state).fallbackPending).toBe(true);
  await settle();
  expect(h.writes.filter((command) => command.t === "doc.get")).toEqual([
    { t: "doc.get", epic: undefined },
  ]);
  h.owner.sync({ ...room(), doc: "draft" }, "main");
  expect(get(h.owner.state).fallbackPending).toBe(false);
  h.owner.dispose();
});
test("removed membership closes editor and refuses detached fallback/edit actions", async () => {
  const h = setup();
  h.owner.mode("edit");
  await settle();
  h.owner.sync({ ...room(), members: [] }, "main");
  expect(h.destroyed).toHaveLength(1);
  h.owner.mode("edit");
  h.owner.input("forbidden");
  h.clock.run(true);
  expect(get(h.owner.state).mode).toBe("preview");
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(0);
  h.owner.dispose();
});

test("giant non-code single-line Markdown avoids the expensive lexer and retains the entire source", () => {
  const text = "[unclosed](".repeat(7000);
  const parsed = parseRichSource(text, "markdown", "document");
  expect(parsed.literal).toBe(true);
  expect(richText(text, "markdown", context("document"))).toEqual([
    { kind: "text", text },
  ]);
});
test("editor deadline releases an ignored import, retry owns a new attempt and late old resolution cannot mount", async () => {
  const first = deferred<EditorModule>(),
    second = deferred<EditorModule>();
  let loads = 0;
  const h = setup(() => (++loads === 1 ? first.promise : second.promise));
  h.owner.mode("edit");
  await settle();
  h.clock.run();
  expect(get(h.owner.state).status).toBe("fallback");
  h.owner.retry();
  await settle();
  expect(loads).toBe(2);
  first.resolve(h.module);
  await settle();
  expect(h.callbacks).toHaveLength(0);
  second.resolve(h.module);
  await settle();
  expect(h.callbacks).toHaveLength(1);
  h.owner.dispose();
});
test("Pele loader deadline is owned and late timed-out callbacks cannot settle a newer attempt", async () => {
  const timers = clock(),
    attempts: { loaded: (value: unknown) => void; failed: () => void }[] = [],
    removed: number[] = [];
  const load = createPeleLoader(
    (loaded, failed) => {
      const index = attempts.length;
      attempts.push({ loaded, failed });
      return () => removed.push(index);
    },
    timers.schedule,
    timers.cancel,
  );
  const first = load().then(
    () => "unexpected success",
    (error: unknown) =>
      error instanceof Error ? error.message : "unexpected error",
  );
  timers.run();
  expect(await first).toBe("Diagram renderer unavailable");
  const second = load();
  attempts[0].loaded({ render: () => ({ svg: "old" }) });
  attempts[1].loaded({ render: () => ({ svg: "new" }) });
  expect(
    (await second).render("", {
      idPrefix: "x",
      fontFamily: "sans-serif",
      fontSize: 14,
      maxWidth: 300,
      links: false,
      images: false,
    }),
  ).toEqual({ svg: "new" });
  expect(removed).toEqual([0, 1]);
});
test("global task heading wins over an earlier marker, including nested headings and whitespace siblings", () => {
  const nodes = richText(
      "[[tarefas]]\n\n<blockquote><h2>Tarefas</h2> \n<ul><li>old</li></ul><p>After</p></blockquote>",
      "markdown",
      context("document"),
    ),
    blocks = documentBlocks(nodes, true),
    all = descendants(
      blocks.flatMap((block) => ("node" in block ? [block.node] : [])),
    );
  expect(blocks.filter((block) => "tasks" in block)).toHaveLength(0);
  expect(
    all.filter((node) => node.kind === "element" && node.documentTaskSlot),
  ).toHaveLength(1);
  expect(all.some((node) => node.kind === "element" && node.tag === "ul")).toBe(
    false,
  );
  expect(
    all.some(
      (node) => node.kind === "text" && node.text.includes("[[tarefas]]"),
    ),
  ).toBe(true);
});
test("fallback follows later canonical edits when clean while retaining truly pending local text", async () => {
  const h = setup(() => Promise.reject(Error("Unavailable")));
  h.owner.mode("edit");
  await settle();
  h.owner.sync({ ...room(), doc: "Remote one" }, "main");
  expect(get(h.owner.state).text).toBe("Remote one");
  h.owner.input("Local");
  h.clock.run();
  h.owner.sync({ ...room(), doc: "Conflicting remote" }, "main");
  expect(get(h.owner.state).text).toBe("Local");
  h.owner.sync({ ...room(), doc: "Local" }, "main");
  h.owner.sync({ ...room(), doc: "Remote two" }, "main");
  expect(get(h.owner.state).text).toBe("Remote two");
  h.owner.dispose();
});
test("removed-epic unconfirmed text remains readonly account-scoped orphan recovery", async () => {
  const h = setup();
  h.owner.sync(room(), "epic");
  h.owner.mode("edit");
  await settle();
  h.emit("Retained deleted epic");
  h.owner.sync({ ...room(), epics: [], docs: {} }, "main");
  expect(get(h.owner.state).orphaned).toMatchObject([
    {
      account: "owner@example.test",
      roomId: "aaaaaa",
      epicId: "epic",
      text: "Retained deleted epic",
    },
  ]);
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(0);
  h.owner.discardOrphan(get(h.owner.state).orphaned[0]);
  expect(get(h.owner.state).orphaned).toEqual([]);
  h.owner.sync(room("aaaaaa", "other@example.test"), "main");
  expect(get(h.owner.state).orphaned).toEqual([]);
  h.owner.dispose();
});
test("missing document reads and fallback writes expose bounded unconfirmed states without automatic resends", async () => {
  const h = setup(() => Promise.reject(Error("Unavailable")));
  h.owner.sync({ ...room(), docs: {} }, "epic");
  expect(get(h.owner.state).readPending).toBe(true);
  h.clock.run();
  expect(get(h.owner.state).error).toBe(true);
  const reads = h.writes.filter((command) => command.t === "doc.get").length;
  h.owner.sync({ ...room(), docs: {} }, "epic");
  expect(h.writes.filter((command) => command.t === "doc.get")).toHaveLength(
    reads,
  );
  h.owner.retry();
  expect(h.writes.filter((command) => command.t === "doc.get")).toHaveLength(
    reads + 1,
  );
  h.owner.mode("edit");
  await settle();
  h.owner.input("Pending");
  h.clock.run();
  await settle();
  h.clock.run();
  expect(get(h.owner.state).fallbackUnconfirmed).toBe(true);
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(1);
  h.owner.dispose();
});

test("diagram private IDs differ for distinct component projection scopes", () => {
  const source =
    '<svg><defs><marker id="arrow"><path d="M0 0L1 1"/></marker></defs><path marker-end="url(#arrow)" d="M0 0L2 2"/></svg>';
  const first = descendants(
      diagramNodes(source, { ...context(), idPrefix: "diagram-one" }),
    ),
    second = descendants(
      diagramNodes(source, { ...context(), idPrefix: "diagram-two" }),
    );
  const ids = (nodes: RichNode[]) =>
    nodes.flatMap((node) =>
      node.kind === "element" && typeof node.attrs.id === "string"
        ? [node.attrs.id]
        : [],
    );
  expect(ids(first).length).toBeGreaterThan(0);
  expect(ids(first).some((id) => ids(second).includes(id))).toBe(false);
});

test("a late earlier fallback rejection cannot contaminate a newer write in the same target", async () => {
  const first = deferred<CommandOutcome>(),
    second = deferred<CommandOutcome>();
  let writes = 0;
  const h = setup(
    () => Promise.reject(Error("Unavailable")),
    () => (++writes === 1 ? first.promise : second.promise),
  );
  h.owner.mode("edit");
  await settle();
  h.owner.input("A");
  h.clock.run();
  h.owner.input("B");
  h.clock.run();
  first.resolve({ ok: false, error: "timeout" });
  await settle();
  expect(get(h.owner.state).text).toBe("B");
  expect(get(h.owner.state).fallbackUnconfirmed).toBe(false);
  second.resolve({ ok: true });
  await settle();
  h.owner.sync({ ...room(), doc: "B" }, "main");
  expect(get(h.owner.state).fallbackPending).toBe(false);
  h.clock.run(true);
  expect(get(h.owner.state).fallbackUnconfirmed).toBe(false);
  h.owner.dispose();
});

test("stale orphan discard cannot erase a restored epic or a newer retained edit", async () => {
  const h = setup();
  h.owner.sync(room(), "epic");
  h.owner.mode("edit");
  await settle();
  h.emit("first");
  h.owner.sync({ ...room(), epics: [], docs: {} }, "main");
  const first = get(h.owner.state).orphaned[0];
  h.owner.sync(room(), "main");
  expect(h.owner.ownsOrphan(first)).toBe(false);
  h.owner.discardOrphan(first);
  expect(
    h.drafts.get({
      account: first.account,
      roomId: first.roomId,
      epicId: first.epicId,
    })?.text,
  ).toBe("first");
  h.owner.sync({ ...room(), epics: [], docs: {} }, "main");
  h.drafts.set(
    { account: first.account, roomId: first.roomId, epicId: first.epicId },
    { text: "newer", scroll: 0 },
  );
  h.owner.discardOrphan(first);
  expect(
    h.drafts.get({
      account: first.account,
      roomId: first.roomId,
      epicId: first.epicId,
    })?.text,
  ).toBe("newer");
  h.owner.dispose();
});

test("Yjs permission-close latches denied across stale same-account snapshots, hides canonical source and retains only local recovery", async () => {
  const h = setup();
  h.owner.mode("edit");
  await settle();
  h.emit("My local text");
  h.callbacks[0].onDenied();
  expect(h.owner.authorized()).toBe(false);
  expect(get(h.owner.state)).toMatchObject({
    denied: true,
    text: "",
    recovery: "My local text",
    checkingAccess: true,
  });
  const token = h.owner.recoveryToken();
  expect(h.owner.recoveryText(token)).toBe("My local text");
  await settle();
  expect(get(h.owner.state).mode).toBe("preview");
  h.owner.sync({ ...room(), online: ["someone@example.test"] }, "main", true);
  h.owner.mode("edit");
  h.owner.retry();
  expect(h.callbacks).toHaveLength(1);
  expect(get(h.owner.state).text).toBe("");
  h.owner.sync(room(), "main", true, true, 0);
  expect(h.owner.authorized()).toBe(false);
  h.owner.sync(room(), "main", true, true, 1);
  expect(h.owner.authorized()).toBe(true);
  expect(get(h.owner.state).text).toBe(room().doc);
  h.owner.mode("edit");
  await settle();
  expect(h.callbacks).toHaveLength(2);
  h.owner.dispose();
});

test("canonical confirmation clears a retained recovery warning and its token after leaving the editor", async () => {
  const h = setup();
  h.owner.mode("edit");
  await settle();
  h.emit("Confirmed text");
  h.owner.mode("preview");
  expect(get(h.owner.state).recovery).toBe("Confirmed text");
  const token = h.owner.recoveryToken();
  h.owner.sync({ ...room(), doc: "Confirmed text" }, "main");
  expect(get(h.owner.state).recovery).toBeNull();
  expect(h.owner.recoveryText(token)).toBeNull();
  h.owner.dispose();
});

test("projecting an existing denial through a newer cached owner cannot consume its fresh authorization epoch", () => {
  const drafts = createDocumentDrafts(),
    request: RequestRoomCommand = async () => ({ ok: true }),
    make = (authorizationEpoch: number) =>
      createDocumentSession({
        drafts,
        request,
        authorizationEpoch,
        name: () => "Owner",
        color: () => "#123456",
      });
  const first = make(1);
  first.sync(room(), "main");
  first.revoke();
  first.dispose();
  const second = make(2);
  second.sync(room(), "main");
  expect(second.authorized()).toBe(false);
  expect(get(second.state).text).toBe("");
  second.sync(room(), "main", true, true, 2);
  expect(second.authorized()).toBe(true);
  expect(get(second.state).text).toBe(room().doc);
  second.dispose();
});

test("an all-editor membership kick can resume the same CRDT only after fresh matching member proof and exact scope read", async () => {
  const h = setup(undefined, undefined, async () => ({
    state: "member",
    title: "Room",
    email: "owner@example.test",
  }));
  h.owner.mode("edit");
  await settle();
  h.emit("Unsent local CRDT text");
  h.callbacks[0].onDenied();
  expect(get(h.owner.state).checkingAccess).toBe(true);
  expect(get(h.owner.state).text).toBe("");
  expect(h.pauses()).toBe(1);
  await settle();
  expect(h.owner.authorized()).toBe(true);
  expect(h.resumes()).toBe(1);
  expect(h.callbacks).toHaveLength(1);
  expect(h.destroyed).toHaveLength(0);
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(0);
  expect(h.writes).toContainEqual({ t: "doc.get", epic: undefined });
  h.owner.dispose();
});

test("foreign/denied/expired access proof never resumes a quarantined editor or releases a newer denial", async () => {
  const proof = deferred<Awaited<ReturnType<AuthApi["access"]>>>(),
    h = setup(undefined, undefined, () => proof.promise);
  h.owner.mode("edit");
  await settle();
  h.emit("Retained");
  h.callbacks[0].onDenied();
  h.clock.run();
  expect(get(h.owner.state).denied).toBe(true);
  expect(get(h.owner.state).checkingAccess).toBe(false);
  expect(h.destroyed).toHaveLength(1);
  proof.resolve({
    state: "member",
    title: "Room",
    email: "owner@example.test",
  });
  await settle();
  expect(h.owner.authorized()).toBe(false);
  expect(h.resumes()).toBe(0);
  h.owner.dispose();
  const foreign = setup(undefined, undefined, async () => ({
    state: "member",
    title: "Room",
    email: "other@example.test",
  }));
  foreign.owner.mode("edit");
  await settle();
  foreign.callbacks[0].onDenied();
  await settle();
  expect(foreign.owner.authorized()).toBe(false);
  expect(foreign.resumes()).toBe(0);
  expect(
    foreign.writes.filter((command) => command.t === "doc.get"),
  ).toHaveLength(0);
  foreign.owner.dispose();
});

test("a new live editor cannot overwrite a retained fallback or prior-view draft with remote-only text", async () => {
  let loads = 0;
  const h = setup(() =>
    ++loads === 1
      ? Promise.reject(Error("Unavailable"))
      : Promise.resolve(h.module),
  );
  h.owner.mode("edit");
  await settle();
  h.owner.input("Retained B");
  h.owner.retry();
  await settle();
  expect(get(h.owner.state).recovery).toBe("Retained B");
  expect(get(h.owner.state).fallbackPending).toBe(false);
  h.emit("Remote C", false);
  h.owner.mode("preview");
  const target = {
    account: "owner@example.test",
    roomId: "aaaaaa",
    epicId: null,
  };
  expect(h.drafts.get(target)?.text).toBe("Retained B");
  h.owner.mode("edit");
  await settle();
  h.emit("Remote D", false);
  h.owner.mode("preview");
  expect(h.drafts.get(target)?.text).toBe("Retained B");
  expect(get(h.owner.state).recovery).toBe("Retained B");
  h.owner.dispose();
});

test("document app markers rewrite only the captured occurrence and preserve unrelated source", () => {
  const source = "# Doc\n\n[[app:room/chart|P]]\n\ntext\n\n[[app:abc/tool]]\n";
  const markers = documentAppMarkers(source);
  expect(
    markers.map((marker) => [marker.connection, marker.tool, marker.size]),
  ).toEqual([
    ["room", "chart", "p"],
    ["abc", "tool", "m"],
  ]);
  expect(resizeDocumentApp(source, markers[1]!, "g")).toBe(
    "# Doc\n\n[[app:room/chart|P]]\n\ntext\n\n[[app:abc/tool|g]]\n",
  );
  expect(
    resizeDocumentApp(
      source.replace("abc/tool", "abc/changed"),
      markers[1]!,
      "g",
    ),
  ).toBeNull();
  expect(
    appendDocumentApp("Text\n\n", { connection: "room", tool: "chart" }),
  ).toBe("Text\n\n[[app:room/chart|m]]\n");
  expect(
    appendDocumentApp("Text", { connection: "room", tool: "bad]]\nwrite" }),
  ).toBeNull();
});
test("preview app edits retain bounded write uncertainty and refuse stale source or switched target", async () => {
  const h = setup();
  const target = h.owner.target()!;
  const source = get(h.owner.state).text;
  expect(h.owner.rewrite(target, source, "app marker")).toBe(true);
  expect(get(h.owner.state).mode).toBe("preview");
  expect(get(h.owner.state).fallbackPending).toBe(true);
  expect(h.owner.rewrite(target, source, "second")).toBe(false);
  h.clock.run();
  await settle();
  expect(h.writes).toContainEqual({
    t: "doc",
    text: "app marker",
    epic: undefined,
  });
  expect(h.writes).toContainEqual({ t: "doc.get", epic: undefined });
  h.owner.sync({ ...room(), doc: "app marker" }, "main");
  expect(get(h.owner.state).fallbackPending).toBe(false);
  h.owner.sync(room(), "epic");
  expect(h.owner.rewrite(target, "app marker", "wrong document")).toBe(false);
  h.owner.dispose();
  expect(h.owner.rewrite(target, "app marker", "after disposal")).toBe(false);
});

test("document App source spans exclude fenced, HTML-comment and indented code twins", () => {
  const hidden =
    "\x60\x60\x60\n[[app:room/demo|m]]\n\x60\x60\x60\n\n<!--\n[[app:room/demo|m]]\n-->\n\n    [[app:room/demo|m]]\n\n";
  const source = hidden + "[[app:room/demo|m]]\n\n[[app:room/demo|m]]\n";
  const markers = documentAppMarkers(source);
  expect(markers).toHaveLength(2);
  expect(resizeDocumentApp(source, markers[1]!, "g")).toBe(
    hidden + "[[app:room/demo|m]]\n\n[[app:room/demo|g]]\n",
  );
  expect(resizeDocumentApp(source, markers[0]!, "p")).toBe(
    hidden + "[[app:room/demo|p]]\n\n[[app:room/demo|m]]\n",
  );
});

test("App AST slots carry exact legal paragraph spans and stable grants across prose and size edits", () => {
  const hidden = "<p>[[app:room/demo|m]]</p>\n\n> [[app:room/demo|m]]\n\n";
  const source = hidden + "[[app:room/demo|m]]\n";
  const nodes = richText(source, "markdown", context("document"));
  const slots = descendants(documentAppNodes(nodes, source)).filter(
    (node) => node.kind === "element" && node.documentAppSlot !== undefined,
  );
  expect(slots).toHaveLength(2);
  const original = documentAppMarkers(source).at(-1)!;
  const moved = documentAppMarkers(
    "New paragraph\n\n" +
      source.replace("[[app:room/demo|m]]\n", "[[app:room/demo|g]]\n"),
  ).at(-1)!;
  expect(documentAppKey(moved)).toBe(documentAppKey(original));
  expect(original.start).toBe(hidden.length);
});

test("App-free preview and task projection consume a frozen sanitized tree without changing its content", () => {
  const source =
    "# Safe heading\n\nProse with **bold** and `[[app:room/literal|m]]`.\n\n" +
    "<script>private-script</script>\n\n[blocked](javascript:alert(1))\n\n" +
    "## Tarefas\n\n- old task\n\nAfter";
  const nodes = richText(source, "markdown", context("document"));
  for (const node of descendants(nodes)) {
    if (node.kind === "element") Object.freeze(node.attrs);
    if ("children" in node) Object.freeze(node.children);
    Object.freeze(node);
  }
  Object.freeze(nodes);
  const before = JSON.stringify(nodes),
    projected = documentAppNodes(nodes, source),
    blocks = documentBlocks(projected, true),
    rendered = descendants(
      blocks.flatMap((block) => ("node" in block ? [block.node] : [])),
    );
  expect(documentAppMarkers(source)).toHaveLength(0);
  expect(projected === nodes).toBe(true);
  expect(blocks.filter((block) => "tasks" in block)).toHaveLength(1);
  expect(
    rendered.some((node) => node.kind === "element" && node.tag === "strong"),
  ).toBe(true);
  expect(
    rendered.some(
      (node) =>
        node.kind === "text" && node.text.includes("[[app:room/literal|m]]"),
    ),
  ).toBe(true);
  expect(rendered.some((node) => node.kind === "link")).toBe(false);
  expect(
    rendered.some(
      (node) => node.kind === "text" && node.text.includes("private-script"),
    ),
  ).toBe(false);
  expect(JSON.stringify(nodes)).toBe(before);
});

test("nested App projection and later source replacement preserve the session's frozen syntax projection", () => {
  const session = createRichSession(),
    source =
      "# Intro\n\n> [[app:room/demo|m]]\n\n## Tarefas\n\n- old task\n\nTail",
    nodes = session.render(source, "markdown", context("document"));
  for (const node of descendants(nodes)) {
    if (node.kind === "element") Object.freeze(node.attrs);
    if ("children" in node) Object.freeze(node.children);
    Object.freeze(node);
  }
  Object.freeze(nodes);
  const before = JSON.stringify(nodes),
    projected = documentAppNodes(nodes, source),
    slots = descendants(projected).filter(
      (node) => node.kind === "element" && node.documentAppSlot !== undefined,
    ),
    blocks = documentBlocks(projected, true);
  expect(slots).toHaveLength(1);
  expect(slots[0]).toEqual(
    expect.objectContaining({ tag: "p", documentAppSlot: 0, children: [] }),
  );
  expect(blocks.filter((block) => "tasks" in block)).toHaveLength(1);
  expect(
    descendants(nodes).some(
      (node) => node.kind === "element" && node.documentAppSlot !== undefined,
    ),
  ).toBe(false);
  expect(JSON.stringify(nodes)).toBe(before);
  const nextSource = "# Updated\n\n> ordinary prose\n\nTail",
    next = documentAppNodes(
      session.render(nextSource, "markdown", context("document")),
      nextSource,
    );
  expect(
    descendants(next).some(
      (node) => node.kind === "element" && node.documentAppSlot !== undefined,
    ),
  ).toBe(false);
  expect(
    descendants(next).some(
      (node) => node.kind === "text" && node.text.includes("ordinary prose"),
    ),
  ).toBe(true);
  expect(JSON.stringify(nodes)).toBe(before);
  session.dispose();
});
test("canonical reads during preview writes cannot discard or repeat the pending local edit", async () => {
  const h = setup();
  const target = h.owner.target()!,
    source = get(h.owner.state).text;
  expect(h.owner.rewrite(target, source, "preview mutation")).toBe(true);
  h.owner.sync({ ...room(), doc: "remote older mirror" }, "main");
  expect(get(h.owner.state).text).toBe("preview mutation");
  expect(get(h.owner.state).fallbackPending).toBe(true);
  h.clock.run();
  await settle();
  h.owner.sync({ ...room(), doc: "remote older mirror" }, "main");
  expect(h.writes.filter((command) => command.t === "doc")).toHaveLength(1);
  expect(h.owner.rewrite(target, "preview mutation", "duplicate")).toBe(false);
  h.owner.dispose();
  expect(h.drafts.get(target)?.text).toBe("preview mutation");
});

test("document App raw spans preserve CRLF/lone-CR boundaries and exact original newline bytes", () => {
  for (const newline of ["\r\n", "\r", "\n"]) {
    const source =
      "Intro" +
      newline +
      newline +
      "[[app:room/demo|m]]" +
      newline +
      newline +
      "tail\r\n";
    const marker = documentAppMarkers(source)[0]!;
    expect(source.slice(marker.start, marker.end).trim()).toBe(
      "[[app:room/demo|m]]",
    );
    const projected = descendants(
      documentAppNodes(
        richText(source, "markdown", context("document")),
        source,
      ),
    );
    expect(
      projected.filter(
        (node) => node.kind === "element" && node.documentAppSlot !== undefined,
      ),
    ).toHaveLength(1);
    expect(resizeDocumentApp(source, marker, "g")).toBe(
      source.replace("demo|m", "demo|g"),
    );
  }
});

test("captured inline App callbacks reject canonical marker replacement before any DOM flush", () => {
  const h = setup(),
    source = "[[APP:room/demo|m]]";
  h.owner.sync({ ...room(), doc: source }, "main");
  const key = documentAppKey(documentAppMarkers(source)[0]!);
  const current = createDocumentAppAuthority(
    () => get(h.owner.state).text,
    () => h.owner.authorized(),
  );
  expect(current(key)).toBe(true);
  h.owner.sync({ ...room(), doc: "Intro\n\n[[app:room/demo|g]]" }, "main");
  expect(current(key)).toBe(true);
  h.owner.sync({ ...room(), doc: "[[app:room/other|m]]" }, "main");
  expect(current(key)).toBe(false);
  h.owner.sync({ ...room(), doc: "" }, "main");
  expect(current(key)).toBe(false);
  h.owner.dispose();
  expect(current(key)).toBe(false);
});

test("public fallback controls cannot acquire programmatic preview authority and publication disposal stays terminal", () => {
  const h = setup(),
    target = h.owner.target()!,
    source = get(h.owner.state).text;
  h.owner.input("old textarea event");
  expect(get(h.owner.state).text).toBe(source);
  expect(h.writes).toEqual([]);
  const stop = h.owner.state.subscribe((view) => {
    if (view.fallbackPending) h.owner.dispose();
  });
  expect(h.owner.rewrite(target, source, "controlled preview edit")).toBe(
    false,
  );
  expect(get(h.owner.state).target).toBeNull();
  expect(get(h.owner.state).text).toBe("");
  h.clock.run(true);
  expect(h.writes).toEqual([]);
  stop();
});

test("nested quote and loose-list App paragraphs preserve prefixes and newline bytes while tight lists stay literal", () => {
  const source =
    "> Quote\r\n>\r\n> [[app:room/demo|m]]\r\n>\r\n> \x60\x60\x60\r\n> [[app:room/demo|m]]\r\n> \x60\x60\x60\r\n\r\n- First\r\n\r\n  [[app:room/demo|m]]\r\n\r\n- Second\r\n";
  const markers = documentAppMarkers(source);
  expect(markers).toHaveLength(2);
  const projected = descendants(
    documentAppNodes(richText(source, "markdown", context("document")), source),
  );
  expect(
    projected.filter(
      (node) => node.kind === "element" && node.documentAppSlot !== undefined,
    ),
  ).toHaveLength(2);
  expect(resizeDocumentApp(source, markers[0]!, "p")).toBe(
    source.replace("> [[app:room/demo|m]]", "> [[app:room/demo|p]]"),
  );
  const at = source.lastIndexOf("[[app:room/demo|m]]");
  expect(resizeDocumentApp(source, markers[1]!, "g")).toBe(
    source.slice(0, at) +
      "[[app:room/demo|g]]" +
      source.slice(at + "[[app:room/demo|m]]".length),
  );
  expect(documentAppMarkers("- [[app:room/demo|m]]\n- Other")).toHaveLength(0);
  const nested = "> - First\n>\n>   [[app:room/nested|m]]\n>\n> - Next\n";
  const inner = documentAppMarkers(nested);
  expect(inner).toHaveLength(1);
  expect(resizeDocumentApp(nested, inner[0]!, "g")).toBe(
    nested.replace("nested|m", "nested|g"),
  );
});

test("skipped Markdown definitions cannot shift root or nested App rewrite spans", () => {
  const source =
    "[link]: /target\n\n> [nested]: /other\n>\n> [[app:room/demo|m]]\n\n- First\n\n  [inside]: /inside\n\n  [[app:room/demo|m]]\n\n- Last\n";
  const markers = documentAppMarkers(source);
  expect(markers).toHaveLength(2);
  const nodes = descendants(
    documentAppNodes(richText(source, "markdown", context("document")), source),
  );
  expect(
    nodes.filter(
      (node) => node.kind === "element" && node.documentAppSlot !== undefined,
    ),
  ).toHaveLength(2);
  expect(resizeDocumentApp(source, markers[0]!, "g")).toBe(
    source.replace("demo|m", "demo|g"),
  );
  const index = source.lastIndexOf("[[app:room/demo|m]]");
  expect(resizeDocumentApp(source, markers[1]!, "p")).toBe(
    source.slice(0, index) +
      "[[app:room/demo|p]]" +
      source.slice(index + "[[app:room/demo|m]]".length),
  );
});

test("only exact legal document App paragraphs keep a newly uploaded app inside the document", () => {
  const target = { connection: "room", tool: "demo" };
  expect(documentEmbedsApp("> [[APP:room/demo|g]]\n", target)).toBe(true);
  for (const source of [
    "[[app:room/demolition]]",
    "[[app:room/Demo]]",
    "[[app:ROOM/demo]]",
    "Prose [[app:room/demo]]",
    "`[[app:room/demo]]`",
    "```text\n[[app:room/demo]]\n```",
    "<!-- [[app:room/demo]] -->",
  ])
    expect(documentEmbedsApp(source, target)).toBe(false);
});

test("native fenced card extraction includes nested code but never raw-HTML or another language", () => {
  const source =
    '```card\n{"root":"one"}\n```\n\n> ```card\n> {"root":"two"}\n> ```\n\n```json\n{"root":"three"}\n```\n\n<pre><code class="language-card">{"root":"four"}</code></pre>';
  const nodes = descendants(richText(source, "markdown", context("document")));
  expect(
    nodes.flatMap((node) => {
      const card = documentCardSource(node);
      return card === null ? [] : [card.trim()];
    }),
  ).toEqual(['{"root":"one"}', '{"root":"two"}']);
});
