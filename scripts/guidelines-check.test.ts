import { expect, test } from "bun:test";
import {
  audit,
  auditMarkdown,
  auditSvelte,
  compare,
  count,
  type Violation,
} from "./guidelines-check";

const rules = (violations: Violation[]) => violations.map((v) => v.rule);
const svelte = (text: string, path = "svelte/features/x/X.svelte") =>
  rules(auditSvelte(path, text));

test("colors: only theme tokens", () => {
  expect(
    svelte(
      '<div class="tw:bg-background tw:text-muted-foreground tw:border-border/50"></div>',
    ),
  ).toEqual([]);
  expect(svelte('<div class="tw:bg-[#fff]"></div>')).toEqual(["color"]);
  expect(svelte('<div class="tw:hover:text-[#1a2b3c]/70"></div>')).toEqual([
    "color",
  ]);
  expect(
    svelte('<div class="tw:shadow-[0_1px_2px_0_#0000000d]"></div>'),
  ).toEqual(["color"]);
  expect(
    svelte('<div class="tw:bg-red-500 tw:dark:text-white"></div>'),
  ).toEqual(["color", "color"]);
  expect(svelte('<div class="tw:border-t-slate-200/40"></div>')).toEqual([
    "color",
  ]);
  expect(
    svelte('<div class="tw:text-sm tw:bg-transparent tw:shadow-md"></div>'),
  ).toEqual([]);
  // A hex value outside a class string is data (avatar palettes, brand icons).
  expect(
    svelte('const colors = ["#d0ec1a"];', "svelte/lib/components/boring.ts"),
  ).toEqual([]);
});

test("breakpoints: only max-[900px] and min-[901px]", () => {
  expect(
    svelte('<div class="tw:max-[900px]:hidden tw:min-[901px]:flex"></div>'),
  ).toEqual([]);
  expect(svelte('<div class="tw:sm:flex"></div>')).toEqual(["breakpoint"]);
  expect(svelte('<div class="tw:md:hover:flex"></div>')).toEqual([
    "breakpoint",
  ]);
  expect(svelte('<div class="tw:max-sm:flex"></div>')).toEqual(["breakpoint"]);
  expect(svelte('<div class="tw:max-[720px]:p-2"></div>')).toEqual([
    "breakpoint",
  ]);
  expect(svelte('<div class="tw:@min-3xl:grid"></div>')).toEqual([]);
  expect(
    svelte('const m = matchMedia("(max-width: 900px)");', "svelte/a.ts"),
  ).toEqual([]);
  expect(
    svelte('const m = matchMedia("(min-width: 901px)");', "svelte/a.ts"),
  ).toEqual([]);
  expect(
    svelte('const m = matchMedia("(max-width: 720px)");', "svelte/a.ts"),
  ).toEqual(["breakpoint"]);
  expect(svelte('matchMedia("(pointer: coarse)")', "svelte/a.ts")).toEqual([]);
});

test("no style blocks, CSS imports or direct fetch", () => {
  expect(svelte("<style>\n.a { color: red }\n</style>")).toEqual([
    "style-block",
  ]);
  expect(svelte('import "./x.css";', "svelte/lib/a.ts")).toEqual([
    "css-import",
  ]);
  expect(svelte('import "./styles/tailwind.css";', "svelte/styles.ts")).toEqual(
    [],
  );
  expect(
    svelte('const r = await fetch("/api/me");', "svelte/lib/a.ts"),
  ).toEqual(["fetch"]);
  expect(svelte("await window.fetch(url);", "svelte/a.ts")).toEqual(["fetch"]);
  expect(svelte("client.fetch(url); prefetch(x);", "svelte/a.ts")).toEqual([]);
  expect(svelte("// we never fetch( here", "svelte/a.ts")).toEqual([]);
  // The gallery and parity pages are development tools, not the app.
  expect(svelte("await fetch(url);", "svelte/gallery/G.svelte")).toEqual([]);
});

test("atomic levels come from the parity stories", () => {
  const files: Record<string, string> = {
    "svelte/parity/stories/atoms-button.svelte":
      'import Button from "../../lib/studio/Button.svelte";',
    "svelte/parity/stories/molecules-card.svelte":
      'import Card from "../../lib/studio/Card.svelte";\nimport Button from "../../lib/studio/Button.svelte";',
    "svelte/parity/stories/organisms-dialog.svelte":
      'import Dialog from "$lib/studio/Dialog.svelte";',
    "svelte/lib/studio/Button.svelte": 'import Card from "./Card.svelte";',
    "svelte/lib/studio/Card.svelte":
      'import Button from "./Button.svelte";\nimport Dialog from "./Dialog.svelte";',
    "svelte/lib/studio/Dialog.svelte": 'import Card from "./Card.svelte";',
    "svelte/lib/studio/Loose.svelte": 'import Dialog from "./Dialog.svelte";',
  };
  const found = audit(Object.keys(files), (p) => files[p] ?? "").filter(
    (v) => v.rule === "atomic",
  );
  expect(found.map((v) => `${v.file}:${v.line}`)).toEqual([
    "svelte/lib/studio/Button.svelte:1",
    "svelte/lib/studio/Card.svelte:2",
  ]);
});

test("markdown: allowed files, working links, folder map", () => {
  const files: Record<string, string> = {
    "AGENTS.md":
      "[ok](docs/stack.md) [web](https://x.dev) [anchor](#top) [bad](docs/nope.md)\n```\n[code](missing.md)\n```",
    "docs/stack.md": "[up](../README.md) [dir](../src/) `[span](gone.md)`",
    "README.md": "",
    "docs/folder-map.md": "| `src/` | x |\n| `.github/` | y |\n| `docs/` | z |",
    "src/index.ts": "",
    "lib/x.ts": "",
    ".github/ci.yml": "",
    ".cursor/rules": "",
    "svelte/NOTES.md": "",
    "claude-plugin/skills/vibebook/SKILL.md": "",
  };
  const found = auditMarkdown(Object.keys(files), (p) => files[p] ?? "");
  expect(found.map((v) => `${v.rule} ${v.file}:${v.line} ${v.text}`)).toEqual([
    "markdown-file svelte/NOTES.md:1 Markdown file outside the allowed places (docs/writing.md, rule 6)",
    "markdown-link AGENTS.md:1 broken link docs/nope.md",
    "folder-map claude-plugin:1 top-level folder claude-plugin/ is missing from docs/folder-map.md",
    "folder-map lib:1 top-level folder lib/ is missing from docs/folder-map.md",
    "folder-map svelte:1 top-level folder svelte/ is missing from docs/folder-map.md",
  ]);
});

test("the ratchet fails on an increase and on a decrease", () => {
  const v = (file: string): Violation => ({
    rule: "color",
    file,
    line: 1,
    text: "",
  });
  const baseline = count([v("a"), v("a"), v("b")]);
  expect(compare([v("a"), v("a"), v("b")], baseline)).toEqual({
    increased: [],
    decreased: [],
  });
  expect(compare([v("a"), v("a"), v("b"), v("c")], baseline).increased[0]).toBe(
    "color c: 1 (baseline 0)",
  );
  expect(compare([v("a"), v("b")], baseline).decreased).toEqual([
    "color a: 1 (baseline 2)",
  ]);
});
