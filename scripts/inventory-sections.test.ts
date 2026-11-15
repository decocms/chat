import { expect, test } from "bun:test";
import { inventorySections } from "./inventory-sections";

test("maintained vanilla inline JavaScript keeps its full-file offset and skips external/JSON payloads", () => {
  const full = `<h1>not JavaScript</h1>\n<script src="/vendor.js">ignored()</script>\n<script type="application/json">{"fake":"app.get()"}</script>\n<script>\nfunction live() {}\n</script>`;
  const sections = inventorySections(full, "public/app.html");
  expect(sections).toHaveLength(1);
  expect(sections[0].text).toBe("\nfunction live() {}\n");
  expect(
    full.slice(
      sections[0].offset,
      sections[0].offset + sections[0].text.length,
    ),
  ).toBe(sections[0].text);
  expect(
    full
      .slice(0, sections[0].offset + sections[0].text.indexOf("function"))
      .split("\n").length,
  ).toBe(5);
});
test("two real HTML modules retain their actual locations despite comment/style fake scripts and quoted attributes", () => {
  const full = `<!-- <script>commentFake()</script> -->\n<style>.fake::after{content:"<script>styleFake()</script>"}</style>\n<script data-note="x > src=y const live=1;" data-src="metadata" TYPE='module'>const live=1;</script>\n<script type=module>const second=2;</script><script type=importmap>{}</script>`;
  expect(
    inventorySections(full, "public/app.html").map((section) => section.text),
  ).toEqual(["const live=1;", "const second=2;"]);
  expect(inventorySections(full, "public/app.html")[0].offset).toBe(
    full.indexOf("const live=1;</script>"),
  );
  expect(inventorySections(full, "public/app.html")[1].offset).toBe(
    full.indexOf("const second=2;</script>"),
  );
});
test("HTML duplicate attributes use the browser's first value and type entities are decoded", () => {
  const full = `<script type=application/json type=module>{"fake":1}</script>
<script type="mod&#117;le" type=application/json>const decoded=1;</script>
<script TYPE=module type=application/json>const first=2;</script>
<script src="" SRC="/ignored.js">externalFake()</script>`;
  expect(
    inventorySections(full, "public/app.html").map((section) => section.text),
  ).toEqual(["const decoded=1;", "const first=2;"]);
});
test("inert template and noscript payloads are not executable inline candidates", () => {
  const full = `<template><script>templateFake()</script></template><noscript><script>noscriptFake()</script></noscript><script>real()</script>`;
  expect(inventorySections(full, "public/app.html")).toEqual([
    { text: "real()", offset: full.indexOf("real()") },
  ]);
});
test("Svelte parser preserves instance/module TypeScript ranges and excludes markup/comment/style text", () => {
  const full = `<!-- <script>commentFake()</script> -->
<script module lang="ts">export type Item = {id: string};</script>
<script lang="ts">let value: number = 1;</script>
<p>{"<script>expressionFake()</script>"}</p>
<style>.fake::after{content:"<script>styleFake()</script>"}</style>`;
  const sections = inventorySections(full, "component.svelte");
  expect(sections.map((section) => section.text)).toEqual([
    "export type Item = {id: string};",
    "let value: number = 1;",
  ]);
  expect(sections.map((section) => section.offset)).toEqual([
    full.indexOf("export type"),
    full.indexOf("let value"),
  ]);
});
test("non-script files remain one original source section", () => {
  expect(inventorySections("const value=1", "module.ts")).toEqual([
    { text: "const value=1", offset: 0 },
  ]);
});
