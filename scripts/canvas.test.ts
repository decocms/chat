import { expect, test } from "bun:test";
import { CANVAS_MAX_CARDS, parseViewport, placeCard, putCard, type Canvas } from "../shared/canvas";
import { reduceRoom } from "../web/app/roomStore";
import type { Room } from "../shared/room";

const empty: Canvas = { cards: [] };
const put = (canvas: Canvas, input: Parameters<typeof putCard>[1]) => {
  const r = putCard(canvas, input, "gui@x.test", 1);
  if ("error" in r) throw new Error(r.error);
  return r;
};

test("auto-placed cards never overlap, and fill a row before the next", () => {
  let canvas = empty;
  for (let i = 0; i < 9; i++) canvas = put(canvas, { id: `c${i}`, body: "x" }).canvas;
  const [a, b, , , e] = canvas.cards;
  expect(a).toMatchObject({ x: 0, y: 0 });
  expect(b!.y).toBe(0);
  expect(e!.y).toBeGreaterThan(0);
  for (const p of canvas.cards)
    for (const q of canvas.cards)
      if (p !== q) expect(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y).toBe(true);
  // A card placed by hand is avoided too.
  expect(placeCard([{ x: 0, y: 0, w: 360, h: 240 }])).toEqual({ x: 400, y: 0 });
});

test("a put replaces one card by id, keeping its place unless x/y come", () => {
  let canvas = put(empty, { id: "a", body: "one", x: 900, y: 50 }).canvas;
  canvas = put(canvas, { id: "a", body: "two" }).canvas;
  expect(canvas.cards).toHaveLength(1);
  expect(canvas.cards[0]).toMatchObject({ body: "two", x: 900, y: 50, author: "gui@x.test" });
  canvas = put(canvas, { id: "a", body: "three", y: 10 }).canvas;
  expect(canvas.cards[0]).toMatchObject({ x: 900, y: 10 });
});

test("a put refuses what the canvas does not take", () => {
  expect(putCard(empty, { body: "" }, "g", 1)).toEqual({ error: "body is required" });
  expect("error" in putCard(empty, { body: "x", kind: "pdf" }, "g", 1)).toBe(true);
  expect("error" in putCard(empty, { id: "no spaces", body: "x" }, "g", 1)).toBe(true);
  expect("error" in putCard(empty, { body: "x".repeat(9000) }, "g", 1)).toBe(true);
  let full = empty;
  for (let i = 0; i < CANVAS_MAX_CARDS; i++) full = put(full, { id: `c${i}`, body: "x" }).canvas;
  expect("error" in putCard(full, { id: "new", body: "x" }, "g", 1)).toBe(true);
  expect("error" in putCard(full, { id: "c0", body: "y" }, "g", 1)).toBe(false);
});

test("a doc's ```canvas block reads its viewport", () => {
  expect(parseViewport("x=100 y=-50 zoom=0.5")).toEqual({ x: 100, y: -50, zoom: 0.5 });
  expect(parseViewport("")).toEqual({ x: 0, y: 0, zoom: 1 });
  expect(parseViewport("zoom=99").zoom).toBe(4);
});

test("a canvas event updates that canvas only", () => {
  const room = { id: "r", messages: [], canvases: { "": { cards: [], open: true } } } as unknown as Room;
  const card = put(empty, { id: "a", body: "x" }).card;
  const next = reduceRoom(room, { t: "canvas", scope: "e1", canvas: { cards: [card] } }, "r");
  expect(next?.canvases?.[""]?.open).toBe(true);
  expect(next?.canvases?.e1?.cards).toHaveLength(1);
});

test("each Claude has its own color on a canvas, and two Claudes never share one while colors are left (Gui #6627)", async () => {
  const { claudeColors, claudeKey } = await import("../shared/canvas");
  const card = (author: string, at: number, agent?: string) => ({ id: `${author}${at}`, kind: "markdown" as const, body: "x", author, ...(agent ? { agent } : {}), x: 0, y: 0, w: 1, h: 1, at });
  const people = ["valls", "ana", "bruno", "gui", "pedro", "cecilia"].map((p, i) => card(`${p}@example.com`, i));
  const colors = claudeColors([...people, card("gui@example.com", 9, "claude-2")]);
  expect(new Set([...colors.values()].slice(0, 6)).size).toBe(6);
  // The same Claude keeps its color as the canvas changes after it; another of the same person is another Claude.
  expect(claudeColors(people.slice(0, 2)).get(claudeKey(people[0]!))).toBe(colors.get(claudeKey(people[0]!)));
  expect(colors.has("gui@example.com/claude-2")).toBe(true);
  // The last Claude to write a card gives it its name and color.
  const r = putCard(empty, { id: "a", body: "x" }, "gui@x.test", 1, "claude-2");
  if ("error" in r) throw new Error(r.error);
  expect(r.card).toMatchObject({ author: "gui@x.test", agent: "claude-2" });
});

test("a whiteboard: shapes without text, arrows both ways, and a whole drawing in one call (Gui #6669)", async () => {
  const { putCards, CANVAS_MAX_BATCH } = await import("../shared/canvas");
  const r = putCards(
    empty,
    [
      { id: "a", kind: "rect", body: "Hook", x: 0, y: 0 },
      { id: "b", kind: "ellipse", x: 300, y: 0, w: 100, h: 100 },
      { id: "c", kind: "arrow", x: 160, y: 40, w: 140, h: 0 },
      { id: "d", kind: "arrow", x: 300, y: 200, w: -200, h: -100 },
      { id: "e", kind: "text", body: "Pergunta do Claude", x: 0, y: -60 },
    ],
    "gui@x.test",
    1,
    "claude",
  );
  if ("error" in r) throw new Error(r.error);
  expect(r.cards.map((c) => c.kind)).toEqual(["rect", "ellipse", "arrow", "arrow", "text"]);
  expect(r.cards[0]).toMatchObject({ w: 160, h: 80 });
  expect(r.cards[3]).toMatchObject({ w: -200, h: -100 });
  expect(r.canvas.cards).toHaveLength(5);
  // Text and blocks still need their text; one bad element refuses the whole call.
  expect(putCards(empty, [{ kind: "rect" }, { kind: "text" }], "g", 1)).toEqual({ error: "elements[1]: body is required" });
  expect("error" in putCards(empty, Array.from({ length: CANVAS_MAX_BATCH + 1 }, () => ({ kind: "rect" })), "g", 1)).toBe(true);
});
