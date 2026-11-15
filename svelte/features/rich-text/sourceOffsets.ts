/** Marked normalizes CRLF/lone CR. Preserve a code-unit boundary map for source edits. */
export function markdownSourceOffsets(source: string) {
  const parts: string[] = [],
    offsets = [0];
  for (let index = 0; index < source.length;) {
    const char = source[index]!;
    if (char === "\r") {
      index += source[index + 1] === "\n" ? 2 : 1;
      parts.push("\n");
    } else {
      index++;
      parts.push(char);
    }
    offsets.push(index);
  }
  return { source: parts.join(""), offsets };
}
