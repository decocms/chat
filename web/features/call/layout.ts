// The call stage's layout: each person's color, and the grid of tiles (like a video app: one person fills the
// stage, two go side by side or stacked by the stage's shape, then 2×2, 3×3…). Every tile is 16:9, whatever the
// stage's shape: the grid fits as many as it can and centers them. Classes are whole strings, so Tailwind finds them.

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

/** A tile's width by the number of columns (rows), with the grid's gap of 0.5rem, in a grid that is a size
 * container ([container-type:size]): the width of a column, or the width that a row's height allows at 16:9,
 * whichever is smaller. With `aspect-video`, every tile is 16:9 and the grid centers them (letterboxed). */
const FITTED = [
  [
    "w-[min(100cqw,calc(100cqh*16/9))]",
    "w-[min(100cqw,calc((100cqh-0.5rem)/2*16/9))]",
    "w-[min(100cqw,calc((100cqh-1rem)/3*16/9))]",
    "w-[min(100cqw,calc((100cqh-1.5rem)/4*16/9))]",
  ],
  [
    "w-[min(calc((100cqw-0.5rem)/2),calc(100cqh*16/9))]",
    "w-[min(calc((100cqw-0.5rem)/2),calc((100cqh-0.5rem)/2*16/9))]",
    "w-[min(calc((100cqw-0.5rem)/2),calc((100cqh-1rem)/3*16/9))]",
    "w-[min(calc((100cqw-0.5rem)/2),calc((100cqh-1.5rem)/4*16/9))]",
  ],
  [
    "w-[min(calc((100cqw-1rem)/3),calc(100cqh*16/9))]",
    "w-[min(calc((100cqw-1rem)/3),calc((100cqh-0.5rem)/2*16/9))]",
    "w-[min(calc((100cqw-1rem)/3),calc((100cqh-1rem)/3*16/9))]",
    "w-[min(calc((100cqw-1rem)/3),calc((100cqh-1.5rem)/4*16/9))]",
  ],
  [
    "w-[min(calc((100cqw-1.5rem)/4),calc(100cqh*16/9))]",
    "w-[min(calc((100cqw-1.5rem)/4),calc((100cqh-0.5rem)/2*16/9))]",
    "w-[min(calc((100cqw-1.5rem)/4),calc((100cqh-1rem)/3*16/9))]",
    "w-[min(calc((100cqw-1.5rem)/4),calc((100cqh-1.5rem)/4*16/9))]",
  ],
] as const;
/** More rows than fit: a column's width, and the grid scrolls. */
const COLUMN_WIDTHS = [
  "w-full",
  "w-[calc((100cqw-0.5rem)/2)]",
  "w-[calc((100cqw-1rem)/3)]",
  "w-[calc((100cqw-1.5rem)/4)]",
] as const;
/** One tile alone in a box (a person on the stage): 16:9, as big as the box lets it. */
export const FITTED_ONE = FITTED[0][0];
const GAP = 8,
  MAX_COLUMNS = COLUMN_WIDTHS.length,
  MAX_ROWS = FITTED[0].length,
  /** A person's tile is always 16:9. */
  RATIO = 16 / 9;

/** The size (pixels) of each tile of `columns` × `rows` in a stage of `width` × `height`: always 16:9. */
export function callTileSize(
  columns: number,
  rows: number,
  width: number,
  height: number,
) {
  const w = Math.max(0, (width - GAP * (columns - 1)) / columns),
    h = Math.max(0, (height - GAP * (rows - 1)) / rows);
  const tile = Math.min(w, h * RATIO);
  return { width: tile, height: tile / RATIO };
}

/** The columns that give each of `count` tiles the most room in a stage of `width` × `height` (pixels), and the
 * tile's width class (with `aspect-video`). More rows than fit: the tiles keep a column's width and the grid
 * scrolls. */
export function callGrid(count: number, width: number, height: number) {
  const people = Math.max(1, count);
  let columns = 1,
    best = -1;
  // Columns that leave more rows than fit are the last resort (the grid scrolls only past 4 × 4).
  const first = Math.min(
    Math.ceil(people / MAX_ROWS),
    Math.min(people, MAX_COLUMNS),
  );
  for (let c = first; c <= Math.min(people, MAX_COLUMNS); c++) {
    const size = callTileSize(c, Math.ceil(people / c), width, height).width;
    // A near tie goes to more columns: side by side reads better than stacked (video apps do the same).
    if (size >= best * 0.93) {
      best = size;
      columns = c;
    }
  }
  const rows = Math.ceil(people / columns);
  const scroll = rows > MAX_ROWS;
  return {
    columns,
    rows,
    scroll,
    width: scroll
      ? (COLUMN_WIDTHS[columns - 1] ?? COLUMN_WIDTHS[0])
      : (FITTED[columns - 1]?.[rows - 1] ?? FITTED_ONE),
  };
}
