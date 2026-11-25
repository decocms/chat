import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import {
  badgedFaviconUrl,
  FAVICON_SVG,
  setFaviconBadge,
} from "../web/features/notifications/favicon";

test("the inline icon is public/favicon.svg", () => {
  expect(FAVICON_SVG).toBe(
    readFileSync(new URL("../public/favicon.svg", import.meta.url), "utf8"),
  );
});

test("the badged icon is the app icon with a ringed red dot, as a data URL", () => {
  const url = badgedFaviconUrl("light");
  expect(url.startsWith("data:image/svg+xml,")).toBe(true);
  const svg = decodeURIComponent(url.slice("data:image/svg+xml,".length));
  expect(svg.startsWith(FAVICON_SVG.replace("</svg>\n", ""))).toBe(true);
  expect(svg).toContain('fill="#fefdfb"');
  expect(svg).toContain('fill="#df2225"');
  expect(badgedFaviconUrl("dark")).toContain(
    encodeURIComponent('fill="#121212"'),
  );
});

test("the tab's icon gets the dot while something waits and loses it at 0", () => {
  const { document } = new Window({ url: "https://vibebook.test/" });
  document.head.innerHTML =
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />';
  const link = document.querySelector('link[rel="icon"]')!;
  const doc = document as unknown as Document;
  const BADGED_FAVICON_URL = badgedFaviconUrl("light");

  setFaviconBadge(true, doc);
  expect(link.getAttribute("href")).toBe(BADGED_FAVICON_URL);
  setFaviconBadge(true, doc);
  expect(link.getAttribute("href")).toBe(BADGED_FAVICON_URL);
  setFaviconBadge(false, doc);
  expect(link.getAttribute("href")).toBe("/favicon.svg");
  setFaviconBadge(false, doc);
  expect(link.getAttribute("href")).toBe("/favicon.svg");
  setFaviconBadge(true, doc);
  expect(link.getAttribute("href")).toBe(BADGED_FAVICON_URL);
});
