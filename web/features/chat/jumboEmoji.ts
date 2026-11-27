/**
 * "Jumbo emoji" (like Slack's and WhatsApp's): a message whose text is only 1 to 3 emoji, with optional whitespace,
 * is drawn bigger. Counted in graphemes (Intl.Segmenter), so a skin tone, a ZWJ family or a flag is one emoji.
 */
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
/** One emoji grapheme: a flag (two regional indicators), a keycap, or a pictograph shown as emoji (by default, or
 *  with U+FE0F) with its skin tone, tag sequence and any ZWJ-joined parts. Plain ©, ™ or a digit are text. */
const EMOJI =
  /^(?:\p{Regional_Indicator}{2}|[#*0-9]️?⃣|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)\p{Emoji_Modifier}?[\u{E0020}-\u{E007F}]*(?:‍\p{Extended_Pictographic}️?\p{Emoji_Modifier}?)*)$/u;
export const JUMBO_MAX = 3;
/** How many emoji the text is (1–3), or 0 when it has anything else or more than three. */
export function jumboEmojiCount(text: string): number {
  if (!text || text.length > 64) return 0;
  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (/^\s+$/u.test(segment)) continue;
    if (!EMOJI.test(segment) || ++count > JUMBO_MAX) return 0;
  }
  return count;
}
