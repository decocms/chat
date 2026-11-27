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
