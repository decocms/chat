// What the room keeps of a recorded call (src/calls.ts, callRecorded). Pure, so a test can load it.
export type CallLine = { name: string; start: number; text: string };
const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
/** The transcript as a Markdown file: one paragraph for each turn, with the time and who spoke. A person who
 *  goes on speaking keeps one paragraph. */
export function transcriptMarkdown(title: string, lines: readonly CallLine[]) {
  const turns: CallLine[] = [];
  for (const line of lines) {
    const text = line.text.trim(), last = turns.at(-1);
    if (!text) continue;
    if (last && last.name === line.name) last.text += ` ${text}`;
    else turns.push({ ...line, text });
  }
  return `# ${title}\n\n${turns.map((turn) => `**${turn.name}** (${clock(turn.start)}): ${turn.text}`).join("\n\n")}\n`;
}
/** The file's name: calls sort by date in the room's files. */
export const transcriptName = (now = Date.now()) => `call-${new Date(now).toISOString().slice(0, 16).replace(/[T:]/g, "-")}.md`;
