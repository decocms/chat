/** The Markdown marks that a person's message renders: `code`, [text](https://link), **bold**, __underline__ (as in
 *  Discord), ~~strikethrough~~, _italic_ and *italic*. The composer's shortcuts write them. Only on one line, and `_`,
 *  `__` or `*` only between words, so `snake_case` and `2*3*4` stay text. The browser renders them; the Worker counts
 *  the messages that have them. */
export const INLINE_MARK =
  /`(?<code>[^`\n]+)`|\[(?<label>[^\]\n]+)\]\((?<href>https?:\/\/[^\s()]+)\)|\*\*(?<strong>(?=\S)[^\n]*?\S)\*\*|(?<![\p{L}\p{N}_])__(?<u>(?=\S)[^\n]*?\S)__(?![\p{L}\p{N}_])|~~(?<del>(?=\S)[^\n]*?\S)~~|(?<![\p{L}\p{N}_])_(?<em>(?=[^\s_])[^\n]*?[^\s_])_(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}*])\*(?<star>(?=[^\s*])[^\n]*?[^\s*])\*(?![\p{L}\p{N}*])/gu;

/** A line that opens or closes a code block in a person's message. */
export const FENCE_LINE = /^```/;

/** True when `text` has at least one mark or code block. */
export function hasInlineMark(text: string): boolean {
  INLINE_MARK.lastIndex = 0;
  return (
    INLINE_MARK.test(text) ||
    text.split("\n").some((line) => FENCE_LINE.test(line))
  );
}
