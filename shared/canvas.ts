// The room's canvas (Gui, 27/11): one plane per room and one per epic, where the Claudes of the room put cards while
// people talk. The call's stage and each ```canvas block of a doc are viewports (x, y, zoom) on the same plane.
// The Book keeps it (meta `canvas:<scope>`), agents write one card at a time (canvas_put), the app only draws it.
// Browser-safe: zod/mini only.
import * as z from "zod/mini";

// A whiteboard (Gui #6669): shapes drawn in the color of their Claude (rect, ellipse, text, arrow), and blocks that
// carry content (mermaid, markdown, html). Every element is a box x, y, w, h on an infinite plane; an arrow goes from
// x, y to x + w, y + h (w and h can be negative).
export const CANVAS_SHAPES = ["rect", "ellipse", "text", "arrow"] as const;
export const CANVAS_KINDS = [
  ...CANVAS_SHAPES,
  "markdown",
  "mermaid",
  "html",
] as const;
export type CanvasKind = (typeof CANVAS_KINDS)[number];
export const isShape = (kind: string) =>
  (CANVAS_SHAPES as readonly string[]).includes(kind);
export const CANVAS_MAX_CARDS = 300;
/** canvas_put with `elements`: at most this many in one call. */
export const CANVAS_MAX_BATCH = 50;
/** The size of a new element of each kind, when the call gives none. */
const DEFAULT_SIZE: Record<CanvasKind, { w: number; h: number }> = {
  rect: { w: 160, h: 80 },
  ellipse: { w: 120, h: 120 },
  text: { w: 200, h: 32 },
  arrow: { w: 160, h: 0 },
  markdown: { w: 360, h: 240 },
  mermaid: { w: 360, h: 240 },
  html: { w: 360, h: 240 },
};
/** markdown and mermaid; html cards go through the same check as HTML in a post (src/embed.ts) and up to EMBED_MAX. */
export const CANVAS_MAX_TEXT = 8_000;
export const CANVAS_CARD_W = 360;
export const CANVAS_CARD_H = 240;
const GAP = 40;
/** Auto-placed cards fill rows of this width, left to right, then the next row. */
const ROW_W = 4 * (CANVAS_CARD_W + GAP);

export const CanvasCardSchema = z.object({
  id: z.string(),
  kind: z.enum(CANVAS_KINDS),
  title: z.optional(z.string()),
  body: z.string(),
  /** Who wrote it last: the email of the person whose Claude it is, and that Claude's @name in the room. */
  author: z.string(),
  agent: z.optional(z.string()),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  at: z.number(),
});
export type CanvasCard = z.infer<typeof CanvasCardSchema>;
export const CanvasSchema = z.object({
  cards: z.array(CanvasCardSchema),
  /** The room's canvas only: shown on the call's stage (the Canvas button). */
  open: z.optional(z.boolean()),
});
export type Canvas = z.infer<typeof CanvasSchema>;
/** "" = the room's canvas; else an epic's id. */
export const canvasKey = (scope: string) => `canvas:${scope}`;

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w + GAP &&
  b.x < a.x + a.w + GAP &&
  a.y < b.y + b.h + GAP &&
  b.y < a.y + a.h + GAP;
type Box = { x: number; y: number; w: number; h: number };

/** The first free place for a w×h card, in reading order on a grid of rows: never on top of another card. */
export function placeCard(
  cards: readonly Box[],
  w = CANVAS_CARD_W,
  h = CANVAS_CARD_H,
): { x: number; y: number } {
  const step = CANVAS_CARD_W + GAP;
  // ponytail: linear scan over grid slots, fine for CANVAS_MAX_CARDS; a spatial index if canvases get large.
  for (let row = 0; ; row++)
    for (let x = 0; x + w <= ROW_W; x += step) {
      const box = { x, y: row * (CANVAS_CARD_H + GAP), w, h };
      if (!cards.some((c) => overlaps(box, c))) return { x: box.x, y: box.y };
    }
}

export type CardInput = {
  id?: string;
  kind?: string;
  title?: string;
  body?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
};
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : undefined;
/** A box's side: 8 to 4000 px; an arrow's offset: -4000 to 4000. */
const size = (v: unknown, fallback: number, arrow = false) =>
  Math.min(4000, Math.max(arrow ? -4000 : 8, num(v) ?? fallback));

/** canvas_put: create or replace ONE card by id. A new card without x/y gets a free place; a replaced one keeps its
 *  place unless x/y come. Answers the new canvas, or an error for the agent. */
export function putCard(
  canvas: Canvas,
  input: CardInput,
  author: string,
  now: number,
  agent?: string,
): { canvas: Canvas; card: CanvasCard } | { error: string } {
  const kind = input.kind ?? "markdown";
  if (!(CANVAS_KINDS as readonly string[]).includes(kind))
    return { error: `kind must be one of ${CANVAS_KINDS.join(", ")}` };
  const body = typeof input.body === "string" ? input.body : "";
  // A rect, an ellipse or an arrow can have no text; the others are their text.
  if (!body.trim() && !["rect", "ellipse", "arrow"].includes(kind))
    return { error: "body is required" };
  if (kind !== "html" && body.length > CANVAS_MAX_TEXT)
    return { error: `body is longer than ${CANVAS_MAX_TEXT} characters` };
  const id = (input.id ?? "").trim() || crypto.randomUUID().slice(0, 8);
  if (!/^[\w-]{1,40}$/.test(id))
    return { error: "id: 1 to 40 letters, digits, _ or -" };
  const old = canvas.cards.find((c) => c.id === id);
  if (!old && canvas.cards.length >= CANVAS_MAX_CARDS)
    return {
      error: `the canvas has ${CANVAS_MAX_CARDS} cards: replace or delete one`,
    };
  const base = DEFAULT_SIZE[kind as CanvasKind];
  const w = size(input.w, old?.w ?? base.w, kind === "arrow"),
    h = size(input.h, old?.h ?? base.h, kind === "arrow");
  const others = canvas.cards.filter((c) => c.id !== id);
  const x = num(input.x),
    y = num(input.y);
  const at =
    x !== undefined && y !== undefined
      ? { x, y }
      : old
        ? { x: x ?? old.x, y: y ?? old.y }
        : placeCard(others, Math.abs(w) || 1, Math.abs(h) || 1);
  const title = input.title?.trim().slice(0, 120) || undefined;
  const card: CanvasCard = {
    id,
    kind: kind as CanvasKind,
    ...(title ? { title } : {}),
    body,
    author,
    ...(agent ? { agent } : {}),
    ...at,
    w,
    h,
    at: now,
  };
  return {
    canvas: {
      ...canvas,
      cards: old
        ? canvas.cards.map((c) => (c.id === id ? card : c))
        : [...canvas.cards, card],
    },
    card,
  };
}

/** Each Claude's color on a canvas (Gui #6627): its own one, fixed by its person and @name; when another Claude on
 *  the same canvas got there first with that color, the next free one (as the call's tiles, web/features/call/layout.ts).
 *  "First" is by each Claude's oldest card, so every viewer sees the same colors. Key: `author/agent`; values are
 *  indexes into the app's palette (web/features/canvas/canvasStyle.ts CLAUDE_COLORS). */
export const claudeKey = (card: { author: string; agent?: string }) =>
  `${card.author}/${card.agent || "claude"}`;
export function claudeColors(
  cards: readonly CanvasCard[],
  colors = 6,
): Map<string, number> {
  const first = new Map<string, number>();
  for (const c of cards)
    first.set(
      claudeKey(c),
      Math.min(first.get(claudeKey(c)) ?? Infinity, c.at),
    );
  const out = new Map<string, number>(),
    taken = new Set<number>();
  for (const [key] of [...first].sort((a, b) => a[1] - b[1])) {
    // FNV-1a and a final mix: emails share their domain.
    let hash = 2166136261;
    for (const char of key)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
    let index = ((hash ^ (hash >>> 16)) >>> 0) % colors;
    for (let step = 0; step < colors && taken.has(index); step++)
      index = (index + 1) % colors;
    taken.add(index);
    if (taken.size >= colors) taken.clear();
    out.set(key, index);
  }
  return out;
}

/** canvas_put with `elements`: each one in order, as one change (all or none). */
export function putCards(
  canvas: Canvas,
  inputs: readonly CardInput[],
  author: string,
  now: number,
  agent?: string,
): { canvas: Canvas; cards: CanvasCard[] } | { error: string } {
  if (inputs.length > CANVAS_MAX_BATCH)
    return { error: `at most ${CANVAS_MAX_BATCH} elements in one call` };
  const cards: CanvasCard[] = [];
  for (const [i, input] of inputs.entries()) {
    const r = putCard(canvas, input, author, now, agent);
    if ("error" in r) return { error: `elements[${i}]: ${r.error}` };
    canvas = r.canvas;
    cards.push(r.card);
  }
  return { canvas, cards };
}

/** A ```canvas block of a doc: "x=0 y=0 zoom=1" (each optional), the viewport on the plane. */
export function parseViewport(source: string): {
  x: number;
  y: number;
  zoom: number;
} {
  const get = (k: string) =>
    Number(new RegExp(`${k}\\s*=\\s*(-?[\\d.]+)`).exec(source)?.[1]);
  const zoom = get("zoom");
  return {
    x: get("x") || 0,
    y: get("y") || 0,
    zoom: zoom > 0 ? Math.min(4, Math.max(0.1, zoom)) : 1,
  };
}
