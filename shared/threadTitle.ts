/** A new thread's title from its message (Gimenes #4123): the first line, no Markdown, at most 60 characters,
 *  cut at a word. The server uses it too, for a blank thread's first message (Gimenes #4267). */
export function threadTitle(text: string) {
  const line = (text.split("\n").find((part) => part.trim()) ?? "")
    .replace(/\*\*|`|^[#>]+ ?|\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (line.length <= 60) return line;
  const cut = line.slice(0, 60);
  const space = cut.lastIndexOf(" ");
  return `${(space > 30 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
