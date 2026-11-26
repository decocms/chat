/** The quick reactions offered by the touch reaction row (the long-press sheet). */
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "🔥"];
/** The hover toolbar keeps three, like Slack and Discord: a short bar covers less. */
export const TOOLBAR_REACTIONS = QUICK_REACTIONS.slice(0, 3);
/** Your own reaction, wherever an emoji is shown as yours: the chip under the message and the hover toolbar. */
export const OWN_REACTION =
  "border-brand-purple/60 bg-brand-purple/15 hover:bg-brand-purple/25";

/** The hover toolbar's reactions: the three quick ones, then any other you gave this message (Valls), in order. */
export function toolbarReactions(
  reactions: Record<string, string[]> | undefined,
  me: string,
): string[] {
  const yours = Object.entries(reactions ?? {})
    .filter(
      ([emoji, who]) =>
        !!me && who.includes(me) && !TOOLBAR_REACTIONS.includes(emoji),
    )
    .map(([emoji]) => emoji);
  return [...TOOLBAR_REACTIONS, ...yours];
}
