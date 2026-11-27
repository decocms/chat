/** A Claude Code menu at the foot of the screen: the question above the options, then `1. …`, `2. …`. */
export function menuOf(screen: string): { question: string; options: string[] } | null {
  const lines = screen.split("\n").map((l) => l.replace(/\s+$/, ""));
  let last = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (/^\s*(❯\s*)?\d\.\s+\S/.test(lines[i])) { last = i; break; }
  if (last < 0) return null;
  let first = last;
  while (first > 0 && /^\s*(❯\s*)?\d\.\s+\S/.test(lines[first - 1])) first--;
  const options = lines.slice(first, last + 1).map((l) => l.replace(/^\s*(❯\s*)?\d\.\s+/, "").trim());
  if (options.length < 2 || options.length > 9) return null;
  // The question: the text lines above the options, up to a rule (─ ╌) or a blank gap, read top-down.
  const above: string[] = [];
  for (let i = first - 1; i >= 0 && above.length < 4; i--) {
    const l = lines[i].trim();
    if (/^[╌┄\-]{6,}$/.test(l)) continue; // a dashed rule inside the question box
    if (/^[─━═]{6,}$/.test(l)) { if (above.length) break; else continue; }
    if (!l) { if (above.length) break; else continue; }
    above.unshift(l);
  }
  const question = above.join(" ").replace(/\s+/g, " ").slice(0, 400);
  return question ? { question, options } : null;
}
