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
test("module/Svelte scripts and quoted attribute delimiters are handled without treating data-src as src", () => {
  const full = `<script data-note="x > src=y const live=1;" data-src="metadata" TYPE='module'>const live=1;</script><script lang="ts">const typed: number=1;</script><script type=importmap>{}</script>`;
  expect(
    inventorySections(full, "component.svelte").map((section) => section.text),
  ).toEqual(["const live=1;", "const typed: number=1;"]);
  expect(inventorySections(full, "component.svelte")[0].offset).toBe(
    full.indexOf("const live=1;</script>"),
  );
});
test("non-script files remain one original source section", () => {
  expect(inventorySections("const value=1", "module.ts")).toEqual([
    { text: "const value=1", offset: 0 },
  ]);
});
