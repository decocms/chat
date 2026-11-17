/** The quick reactions offered by the message toolbar's picker and the reaction row. */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "🔥"];

const KEY = "vb.reactions.used";

function read(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, number] => typeof entry[1] === "number",
      ),
    );
  } catch {
    return {};
  }
}

/** The person's most used reactions in this browser, filled up from the quick ones. */
export function topReactions(n = 3): string[] {
  const used = Object.entries(read())
    .sort((a, b) => b[1] - a[1])
    .map(([emoji]) => emoji);
  return [...new Set([...used, ...QUICK_REACTIONS])].slice(0, n);
}

/** Counts a reaction the person added (not one they took back). */
export function noteReaction(emoji: string) {
  try {
    const used = read();
    used[emoji] = (used[emoji] ?? 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(used));
  } catch {
    // Private windows and blocked storage: the defaults stay.
  }
}
