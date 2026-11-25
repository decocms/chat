// Agent names in a room (src/agentNames.ts): the pure part, shared with the profile's handle check and the tests.

/** Handles that are agent names, never a person's @handle (src/profile.ts). */
export const AGENT_HANDLE = /^(agent|claude|codex)(-\d{1,3})?$/;
/** A name not used for this long goes back to the pool. */
export const NAME_KEEP = 3 * 86400_000;

export const baseName = (client: string | null | undefined) =>
  /codex/i.test(client ?? "") ? "codex" : "claude";

/** `claude` < `claude-2` < `claude-10` < `codex`. */
const order = (n: string) => {
  const m = /^(.*?)(?:-(\d+))?$/.exec(n)!;
  return [m[1], Number(m[2] ?? 1)] as const;
};
export const byName = (a: string, b: string) => {
  const [x, i] = order(a),
    [y, j] = order(b);
  return x < y ? -1 : x > y ? 1 : i - j;
};

/** The first of base, base-2, … that isn't taken. */
export const freeName = (base: string, taken: Iterable<string>) => {
  const t = new Set(taken);
  for (let i = 1; ; i++)
    if (!t.has(i === 1 ? base : `${base}-${i}`))
      return i === 1 ? base : `${base}-${i}`;
};
