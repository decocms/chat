// Actual pinned parser differential and owned loader fixtures; no browser/layout/performance claim.
import { expect, test, spyOn } from "bun:test";
import { Lexer } from "marked";
import { createRichSession } from "../svelte/features/rich-text/session";
import { get } from "svelte/store";
import { createHtmlTree } from "../svelte/features/rich-text/htmlTree";
import {
  markdownTree,
  prepareMarkdown,
  type MarkdownTree,
  type TreeNode,
} from "../svelte/features/rich-text/markdownTree";
import {
  parsePreparedRichSource,
  parseRichSource,
  prepareRichSource,
  projectRichSource,
} from "../svelte/features/rich-text/project";
import {
  createRichPreparation,
  type RichInput,
} from "../svelte/features/rich-text/preparation";
import type { RichContext } from "../svelte/features/rich-text/types";
const context: RichContext = {
  room: {
    id: "aaaaaa",
    me: "a",
    members: ["a"],
    book: { title: "Room", owner: "a" },
    online: [],
    messages: [],
    epics: [],
    suggestions: [],
    typing: {},
  },
  pageUrl: "https://vibebook.test/b/aaaaaa",
  idPrefix: "semantic",
  policy: "document",
};
function snapshot(tree: MarkdownTree) {
  function node(value: TreeNode): unknown {
    if ("tagName" in value)
      return {
        tag: value.tagName,
        namespace: value.namespaceURI,
        attrs: value.attrs,
        metadata: tree.metadata.get(value),
        children: value.childNodes.map(node),
      };
    return "value" in value ? { text: value.value } : { other: value.nodeName };
  }
  return tree.fragment.childNodes.map(node);
}
const corpus = [
  "# Heading\n\n> quoted **strong** and *em* ~~gone~~ `x < y`\n\n3. three\n4. four\n\n- [x] checked\n- [ ] open",
  "| left | center | right |\n|:--|:--:|--:|\n| **one** | `x` | two |\n| three | four | five |",
  "| A | B |\n| - | - |",
  "- first\n\n  paragraph two\n\n  > quote\n  >\n  > nested\n\n- second",
  "1. tight\n   - nested\n     - [x] done\n2. end\n\n---\n\nnext\nline",
  "[reference][r]\n\n[r]: https://example.test/?x=1&y=2 'Title'\n\n<https://example.test/a> <user@example.test>",
  "&amp; &copy; &NotEqualTilde; &#x80; &#0; &notit; &unknown; **x&amp;y**",
  "[x](jav&#x61;script:alert%281%29) [y](https://example.test/?x=1&amp;y=2) ![a &copy;](https://example.test/a.png 'A &amp; B')",
  "```html\n<script>never execute</script>\n```\n\n    <b>code</b>\n\n`<b>x</b>` \\<b>escaped\\</b>",
  "before\u0000after\u00a0space\t tab\r\nnext\rline",
  "[r]: https://example.test\r\n\r\n[[APP:room/demo]]\r\n\r\n> [[APP:room/demo]]\r\n\r\n- first\r\n\r\n  [[APP:room/demo]]\r\n",
  '## Tasks\n\n- [ ] one\n- [x] two\n\n```card\n{"title":"safe"}\n```',
];
test("HTML-free semantic tree and projection match the full pinned adapter, including metadata and entities", () => {
  for (const source of corpus) {
    const prepared = prepareRichSource(source, "markdown", "document");
    expect(prepared.tokens?.html).toBe(false);
    const tokens = prepared.tokens!,
      fast = markdownTree(tokens),
      full = markdownTree({ ...tokens, html: true }, createHtmlTree);
    expect(snapshot(fast)).toEqual(snapshot(full));
    expect(
      projectRichSource(parsePreparedRichSource(prepared), context),
    ).toEqual(
      projectRichSource(
        parsePreparedRichSource(
          { ...prepared, tokens: { ...tokens, html: true } },
          createHtmlTree,
        ),
        context,
      ),
    );
  }
});
test("any nested raw HTML selects the single full-input parser; code and escaped syntax do not", () => {
  for (const source of [
    "before <em>plain **strong** &amp; `code`</em> after",
    "<details><summary>Title</summary>\n\n**body**\n\n</details>",
    "> quote\n>\n> <b>raw</b>",
    "- list <i>raw</i>",
    "| a | b |\n| - | - |\n| <svg><text>x</text></svg> | ok |",
    "<!-- inert comment -->\n\n# after",
    "<table><b>outside<tr><td>cell</table>tail",
    "<math><mtext><b>html</b></mtext></math>",
  ]) {
    expect(prepareMarkdown(source).html).toBe(true);
    expect(() => parseRichSource(source, "markdown")).toThrow(
      "HTML parser was not prepared",
    );
    const actual = parseRichSource(
      source,
      "markdown",
      undefined,
      createHtmlTree,
    );
    expect(actual.literal).not.toBe(true);
  }
});
test("source/tree/depth limits retain complete literal source identically on semantic and full builders", () => {
  for (const source of [
    "x".repeat(100001),
    "a\n\n".repeat(1100),
    "> ".repeat(60) + "x",
    "@a ".repeat(3000),
  ]) {
    const prepared = prepareRichSource(source, "markdown", "document"),
      full = prepared.tokens
        ? { ...prepared, tokens: { ...prepared.tokens, html: true } }
        : prepared;
    expect(
      projectRichSource(parsePreparedRichSource(prepared), context),
    ).toEqual(
      projectRichSource(parsePreparedRichSource(full, createHtmlTree), context),
    );
  }
});
const input = (source = "<b>HTML</b>", scope = "a/aaaaaa/root"): RichInput => ({
  source,
  scope,
  mode: "markdown",
  policy: "document",
});
const turn = () => new Promise<void>((yes) => setTimeout(yes, 0));
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
test("ordinary Markdown is ready synchronously and never invokes the HTML loader", () => {
  let loads = 0;
  const owner: ReturnType<typeof createRichPreparation> = createRichPreparation(
    {
      current: () => true,
      load: async () => {
        loads++;
        return createHtmlTree;
      },
    },
  );
  const value = owner.read(input("# Ready\n\n`<b>code</b>`"));
  expect(get(value).phase).toBe("ready");
  expect(loads).toBe(0);
  owner.dispose();
});
test("cold HTML loading/failure/retry retains synchronous projection after explicit acquisition", async () => {
  let attempt = 0;
  const signals: AbortSignal[] = [],
    owner = createRichPreparation({
      current: () => true,
      load: async (signal) => {
        signals.push(signal);
        if (++attempt === 1) throw Error("private detail");
        return createHtmlTree;
      },
    });
  const state = owner.read(input());
  expect(get(state).phase).toBe("loading");
  await turn();
  expect(get(state)).toEqual({ phase: "error" });
  expect(signals[0]!.aborted).toBe(true);
  owner.retry();
  expect(get(state).phase).toBe("loading");
  await turn();
  const ready = get(state);
  expect(ready.phase).toBe("ready");
  if (ready.phase === "ready")
    expect(projectRichSource(ready.parsed, context)[0]).toMatchObject({
      kind: "element",
      tag: "p",
    });
  expect(attempt).toBe(2);
  owner.dispose();
});
test("source/scope replacement and disposal abort old loaders and refuse ignored late completions", async () => {
  const pending = [
      deferred<typeof createHtmlTree>(),
      deferred<typeof createHtmlTree>(),
    ],
    signals: AbortSignal[] = [];
  let latest = input(),
    index = 0;
  const owner: ReturnType<typeof createRichPreparation> = createRichPreparation(
    {
      current: (value) =>
        value.source === latest.source && value.scope === latest.scope,
      load: (signal) => {
        signals.push(signal);
        return pending[index++]!.promise;
      },
    },
  );
  const old = owner.read(latest);
  await turn();
  latest = input("<i>new room</i>", "b/bbbbbb/epic");
  const next = owner.read(latest);
  await turn();
  expect(signals[0]!.aborted).toBe(true);
  pending[0]!.resolve(createHtmlTree);
  await turn();
  expect(get(old).phase).not.toBe("ready");
  expect(get(next).phase).toBe("loading");
  owner.dispose();
  expect(signals[1]!.aborted).toBe(true);
  expect(get(next).phase).toBe("cancelled");
  pending[1]!.resolve(createHtmlTree);
  await turn();
  expect(get(next).phase).toBe("cancelled");
});
test("preflush authority replacement and real deadline prevent late acquisition without source fallback", async () => {
  const pending = deferred<typeof createHtmlTree>();
  let authorized = true;
  const owner: ReturnType<typeof createRichPreparation> = createRichPreparation(
    {
      current: () => authorized,
      deadline: 5,
      load: () => pending.promise,
    },
  );
  const state = owner.read(input());
  await turn();
  authorized = false;
  pending.resolve(createHtmlTree);
  await turn();
  expect(get(state).phase).toBe("cancelled");
  owner.dispose();
  const ignored = deferred<typeof createHtmlTree>(),
    timed = createRichPreparation({
      current: () => true,
      deadline: 5,
      load: () => ignored.promise,
    });
  const timeout = timed.read(input());
  await new Promise((yes) => setTimeout(yes, 15));
  expect(get(timeout)).toEqual({ phase: "error" });
  ignored.resolve(createHtmlTree);
  await turn();
  expect(get(timeout)).toEqual({ phase: "error" });
  timed.dispose();
});
test("retry loading subscribers can dispose or replace the gate without orphaned acquisition", async () => {
  for (const dispose of [false, true]) {
    let latest = input(),
      loads = 0;
    const owner: ReturnType<typeof createRichPreparation> =
      createRichPreparation({
        current: (value) => value.scope === latest.scope,
        load: async () => {
          if (++loads === 1) throw Error("initial failure");
          return createHtmlTree;
        },
      });
    const old = owner.read(latest);
    await turn();
    expect(get(old).phase).toBe("error");
    let armed = true;
    let replacement: ReturnType<typeof owner.read> | undefined;
    const unsubscribe = old.subscribe((state) => {
      if (!armed || state.phase !== "loading") return;
      armed = false;
      if (dispose) owner.dispose();
      else {
        latest = input("# Replacement", "b/bbbbbb/epic");
        replacement = owner.read(latest);
      }
    });
    owner.retry();
    await turn();
    if (dispose) expect(get(old).phase).toBe("cancelled");
    else expect(get(replacement!).phase).toBe("ready");
    expect(loads).toBe(1);
    unsubscribe();
    owner.dispose();
  }
});
test("abort listeners can retry without an old failure overwriting the new loading/ready state", async () => {
  let loads = 0;
  const pending = deferred<typeof createHtmlTree>();
  const owner: ReturnType<typeof createRichPreparation> = createRichPreparation(
    {
      current: () => true,
      deadline: 5,
      load: (signal) => {
        if (++loads === 1) {
          signal.addEventListener("abort", () => owner.retry(), { once: true });
          return pending.promise;
        }
        return Promise.resolve(createHtmlTree);
      },
    },
  );
  const state = owner.read(input());
  await new Promise((yes) => setTimeout(yes, 15));
  expect(loads).toBe(2);
  expect(get(state).phase).toBe("ready");
  pending.resolve(createHtmlTree);
  await turn();
  expect(get(state).phase).toBe("ready");
  owner.dispose();
});
test("diagram HTML acquisition has a real deadline and caller abort, with ignored late imports fenced", async () => {
  const { acquireHtmlTree } =
    await import("../svelte/features/rich-text/preparation");
  const pending = deferred<typeof createHtmlTree>();
  let signal: AbortSignal | undefined;
  await expect(
    acquireHtmlTree(
      (next) => {
        signal = next;
        return pending.promise;
      },
      undefined,
      5,
    ),
  ).rejects.toThrow("HTML parser unavailable");
  expect(signal?.aborted).toBe(true);
  pending.resolve(createHtmlTree);
  const abort = new AbortController(),
    ignored = deferred<typeof createHtmlTree>();
  const wait = acquireHtmlTree(() => ignored.promise, abort.signal);
  abort.abort();
  await expect(wait).rejects.toThrow("HTML parser unavailable");
  ignored.resolve(createHtmlTree);
});
test("a reentrant current callback cannot redirect Retry onto its replacement owner", async () => {
  let armed = false,
    loads = 0,
    latest = input();
  let replacement:
    ReturnType<ReturnType<typeof createRichPreparation>["read"]> | undefined;
  const owner: ReturnType<typeof createRichPreparation> = createRichPreparation(
    {
      current(value) {
        if (armed && value.scope === "a/aaaaaa/root") {
          armed = false;
          latest = input("# Replacement", "b/bbbbbb/epic");
          replacement = owner.read(latest);
        }
        return value.scope === latest.scope;
      },
      load: async () => {
        loads++;
        throw Error("failed");
      },
    },
  );
  const old = owner.read(latest);
  await turn();
  expect(get(old).phase).toBe("error");
  armed = true;
  owner.retry();
  expect(get(replacement!).phase).toBe("ready");
  expect(loads).toBe(1);
  owner.dispose();
});
test("full raw-HTML fallback retains table repair, foreign namespaces and dropped active contents", () => {
  const prepared = parseRichSource(
    "<table>outside<tr><td>cell</td></tr></table><svg><text>vector</text><script>evil()</script></svg><math><mi>x</mi></math>",
    "markdown",
    "document",
    createHtmlTree,
  );
  const nodes = projectRichSource(prepared, context);
  expect(nodes[0]).toEqual({ kind: "text", text: "outside" });
  expect(
    nodes.some((node) => node.kind === "element" && node.tag === "table"),
  ).toBe(true);
  expect(
    nodes.some(
      (node) =>
        node.kind === "element" &&
        node.namespace === "http://www.w3.org/2000/svg",
    ),
  ).toBe(true);
  expect(
    nodes.some(
      (node) =>
        node.kind === "element" &&
        node.namespace === "http://www.w3.org/1998/Math/MathML",
    ),
  ).toBe(true);
  expect(JSON.stringify(nodes)).not.toContain("evil()");
});
test("one session caches normal display syntax without retaining lexer tokens and reprojects only context", () => {
  const lex = spyOn(Lexer.prototype, "lex"),
    session = createRichSession();
  try {
    const first = session.display(
      "# Ready\n\n**body**",
      "markdown",
      "document",
    );
    expect(first.kind).toBe("ready");
    expect(session.display("# Ready\n\n**body**", "markdown", "document")).toBe(
      first,
    );
    expect(lex).toHaveBeenCalledTimes(1);
    expect("prepared" in first).toBe(false);
    if (first.kind !== "ready") throw Error("Expected semantic display");
    expect("tokens" in first.parsed).toBe(false);
    const nodes = session.project(first.parsed, context);
    expect(
      session.project(first.parsed, {
        ...context,
        room: { ...context.room, messages: [] },
      }),
    ).toBe(nodes);
    const human = session.display("@alice", "human");
    expect(lex).toHaveBeenCalledTimes(1);
    if (human.kind !== "ready") throw Error("Expected human display");
    const named = {
      ...context,
      room: { ...context.room, names: { a: "Alice" } },
    };
    const before = session.project(human.parsed, named);
    expect(before[0]).toMatchObject({ kind: "mention", who: "a" });
    const after = session.project(human.parsed, {
      ...named,
      room: { ...named.room, names: { a: "Bob" } },
    });
    expect(after).not.toBe(before);
    expect(after).toEqual([{ kind: "text", text: "@alice" }]);
    session.display("# Ready\n\n**body**", "markdown");
    expect(lex).toHaveBeenCalledTimes(2);
    session.display("# Ready\n\n**body**", "markdown", "document");
    expect(lex).toHaveBeenCalledTimes(3);
  } finally {
    session.dispose();
    lex.mockRestore();
  }
});
test("HTML adoption accepts only the exact live syntax request and drops prepared tokens without mutating it", () => {
  const session = createRichSession();
  const old = session.display("<b>A</b>", "markdown");
  if (old.kind !== "html") throw Error("Expected HTML request");
  const parsed = parsePreparedRichSource(old.prepared, createHtmlTree),
    tokens = old.prepared.tokens;
  session.display("ordinary B", "human");
  expect(session.adoptHtml(old, parsed)).toBeUndefined();
  const current = session.display("<b>A</b>", "markdown");
  if (current.kind !== "html") throw Error("Expected fresh HTML request");
  expect(current).not.toBe(old);
  expect(session.adoptHtml(old, parsed)).toBeUndefined();
  const currentTokens = current.prepared.tokens;
  Object.freeze(current.prepared);
  Object.freeze(current);
  const ready = session.adoptHtml(
    current,
    parsePreparedRichSource(current.prepared, createHtmlTree),
  );
  expect(ready?.kind).toBe("ready");
  expect(session.display("<b>A</b>", "markdown")).toBe(ready);
  expect("prepared" in ready!).toBe(false);
  expect(old.prepared.tokens).toBe(tokens);
  expect(current.prepared.tokens).toBe(currentTokens);
  session.dispose();
  expect(session.adoptHtml(current, parsed)).toBeUndefined();
});
test("supplied HTML preparation is lexed once through failure Retry and stable ready-store reuse", async () => {
  const lex = spyOn(Lexer.prototype, "lex");
  let attempts = 0;
  const owner = createRichPreparation({
    current: () => true,
    load: async () => {
      if (++attempts === 1) throw Error("retry");
      return createHtmlTree;
    },
  });
  try {
    const prepared = prepareRichSource("<em>same tokens</em>", "markdown"),
      request = input("<em>same tokens</em>");
    const state = owner.readPrepared(request, prepared);
    await turn();
    expect(get(state).phase).toBe("error");
    owner.retry();
    await turn();
    expect(get(state).phase).toBe("ready");
    expect(owner.readPrepared({ ...request }, prepared)).toBe(state);
    owner.retry();
    expect(attempts).toBe(2);
    expect(lex).toHaveBeenCalledTimes(1);
  } finally {
    owner.dispose();
    lex.mockRestore();
  }
});
