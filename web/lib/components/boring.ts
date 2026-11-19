// The "beam" and "marble" variants of Boring Avatars (https://boringavatars.com, MIT, by Hayk An), ported from its
// React components to plain geometry. The same name always gives the same picture.

/** deco's brand colours, as the palette every generated picture draws from. */
export const BRAND_PALETTE = [
  "#d0ec1a",
  "#07401a",
  "#a595ff",
  "#ffc116",
  "#69daec",
  "#151042",
] as const;

function hashCode(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash &= hash;
  }
  return Math.abs(hash);
}
const digit = (number: number, place: number) =>
  Math.floor((number / 10 ** place) % 10);
const even = (number: number, place: number) => !(digit(number, place) % 2);
function unit(number: number, range: number, place?: number) {
  const value = number % range;
  return place && digit(number, place) % 2 === 0 ? -value : value;
}
const pick = (number: number, colors: readonly string[]) =>
  colors[number % colors.length] ?? "#000000";
function contrast(hex: string) {
  const c = hex.replace("#", "");
  const yiq =
    (299 * Number.parseInt(c.slice(0, 2), 16) +
      587 * Number.parseInt(c.slice(2, 4), 16) +
      114 * Number.parseInt(c.slice(4, 6), 16)) /
    1000;
  return yiq >= 128 ? "#000000" : "#FFFFFF";
}

/** A small round face for a person, on a 36×36 canvas. */
export function beam(name: string, colors: readonly string[] = BRAND_PALETTE) {
  const n = hashCode(name);
  const wrapper = pick(n, colors);
  const preX = unit(n, 10, 1);
  const x = preX < 5 ? preX + 4 : preX;
  const preY = unit(n, 10, 2);
  const y = preY < 5 ? preY + 4 : preY;
  const mouth = 19 + unit(n, 3);
  const eyes = unit(n, 5);
  const faceX = x > 6 ? x / 2 : unit(n, 8, 1);
  const faceY = y > 6 ? y / 2 : unit(n, 7, 2);
  return {
    background: pick(n + 13, colors),
    wrapper,
    wrapperTransform: `translate(${x} ${y}) rotate(${unit(n, 360)} 18 18) scale(${1 + unit(n, 3) / 10})`,
    wrapperRadius: even(n, 1) ? 36 : 6,
    face: contrast(wrapper),
    faceTransform: `translate(${faceX} ${faceY}) rotate(${unit(n, 10, 3)} 18 18)`,
    smile: even(n, 2),
    mouth: even(n, 2)
      ? `M15 ${mouth}c2 1 4 1 6 0`
      : `M13,${mouth} a1,0.75 0 0,0 10,0`,
    leftEye: 14 - eyes,
    rightEye: 20 + eyes,
  };
}

/** A soft marbled square for an organization or a room, on an 80×80 canvas. */
export function marble(
  name: string,
  colors: readonly string[] = BRAND_PALETTE,
) {
  const n = hashCode(name);
  const part = (i: number) => ({
    color: pick(n + i, colors),
    x: unit(n * (i + 1), 8, 1),
    y: unit(n * (i + 1), 8, 2),
    scale: 1.2 + unit(n * (i + 1), 4) / 10,
    rotate: unit(n * (i + 1), 360, 1),
  });
  const [a, b, c] = [part(0), part(1), part(2)];
  return {
    background: a.color,
    first: b.color,
    firstTransform: `translate(${b.x} ${b.y}) rotate(${b.rotate} 40 40) scale(${c.scale})`,
    second: c.color,
    secondTransform: `translate(${c.x} ${c.y}) rotate(${c.rotate} 40 40) scale(${c.scale})`,
  };
}
