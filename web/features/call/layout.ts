// The call stage's layout: each person's color, and the grid of tiles (like a video app: one person fills the
// stage, two go side by side or stacked by the stage's shape, then 2×2, 3×3…). Classes are whole strings, so
// Tailwind finds them.

/** One calm solid color per person (tokens --vb-call-1…6), the same in every call and on every screen. */
const COLORS = [
  "bg-call-1",
  "bg-call-2",
  "bg-call-3",
  "bg-call-4",
  "bg-call-5",
  "bg-call-6",
] as const;
function colorIndex(email: string) {
  // FNV-1a, then a final mix: emails share their domain, so a plain sum of the letters would give one color.
  let hash = 2166136261;
  for (const char of email)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 0) % COLORS.length;
}
/** Each person's color in this call: their own one, or (taken by someone who joined earlier) the next free one,
 * so that two people in the same call do not share a color while there are colors left. */
export function callColors(emails: readonly string[]) {
  const taken = new Set<number>();
  const colors: Record<string, (typeof COLORS)[number]> = {};
  for (const email of emails) {
    let index = colorIndex(email);
    for (let step = 0; step < COLORS.length && taken.has(index); step++)
      index = (index + 1) % COLORS.length;
    taken.add(index);
    if (taken.size >= COLORS.length) taken.clear();
    colors[email] = COLORS[index] ?? COLORS[0];
  }
  return colors;
}

/** Widths and heights of a tile, by the number of columns (rows), with the grid's gap of 0.5rem. */
const WIDTHS = [
  "w-full",
  "w-[calc((100%-0.5rem)/2)]",
  "w-[calc((100%-1rem)/3)]",
  "w-[calc((100%-1.5rem)/4)]",
] as const;
const HEIGHTS = [
  "h-full",
  "h-[calc((100%-0.5rem)/2)]",
  "h-[calc((100%-1rem)/3)]",
  "h-[calc((100%-1.5rem)/4)]",
] as const;
const GAP = 8,
  MAX_COLUMNS = WIDTHS.length,
  /** A tile is at its best at 16:9. */
  RATIO = 16 / 9;

/** The columns that give each of `count` tiles the most room in a stage of `width` × `height` (pixels). More
 * rows than fit: the tiles keep a fixed height and the grid scrolls. */
export function callGrid(count: number, width: number, height: number) {
  const people = Math.max(1, count);
  let columns = 1,
    best = -1;
  for (let c = 1; c <= Math.min(people, MAX_COLUMNS); c++) {
    const rows = Math.ceil(people / c);
    const w = (width - GAP * (c - 1)) / c,
      h = (height - GAP * (rows - 1)) / rows;
    // The tile's usable size: its width, or the width that its height allows at 16:9.
    const size = Math.min(w, h * RATIO);
    // A near tie goes to more columns: side by side reads better than stacked (video apps do the same).
    if (size >= best * 0.93) {
      best = size;
      columns = c;
    }
  }
  const rows = Math.ceil(people / columns);
  const scroll = rows > HEIGHTS.length;
  return {
    columns,
    rows,
    scroll,
    width: WIDTHS[columns - 1] ?? WIDTHS[0],
    height: scroll ? "h-40" : (HEIGHTS[rows - 1] ?? HEIGHTS[0]),
  };
}
