/** iOS gesture fallback is preserved; all authored styling uses the sole Tailwind entry. */
export async function copyChatText(text: string): Promise<void> {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.className = "fixed left-0 top-0 opacity-0 text-base";
  const focused = document.activeElement;
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
  } finally {
    textarea.remove();
    if (focused instanceof HTMLElement && focused.isConnected)
      focused.focus({ preventScroll: true });
  }
  if (copied) return;
  if (!navigator.clipboard) throw new Error("clipboard unavailable");
  await navigator.clipboard.writeText(text);
}

/** A message that a copy takes in: the part of its text that is selected. */
export type SelectedMessage = {
  id: string;
  /** The selected text, as the message shows it. Empty for a message with only files. */
  text: string;
  /** The selection takes in all of the message's text. */
  whole: boolean;
  /** The selection takes in the message's name line or avatar. */
  head: boolean;
};

/**
 * The messages a selection takes in, when the browser's own copy would bring
 * the room's chrome along (names, avatars, agent marks, reactions, buttons):
 * the selection reaches past one message's text. Each message gives only the
 * part of its text that is selected, so a selection that starts in a word and
 * ends past the text does not copy the full message. A message that the
 * selection touches only outside its text is left out. Null when the selection
 * stays inside one message's text (or takes in no message's text): then the
 * browser copies it.
 */
export function selectedMessages(
  range: Range,
  root: Element,
): SelectedMessage[] | null {
  const start = range.commonAncestorContainer;
  const inside = start instanceof Element ? start : start.parentElement;
  if (inside?.closest("[data-rich-content]")) return null;
  const picked = [...root.querySelectorAll<HTMLElement>("[data-chat-message]")]
    .filter((row) => row.dataset.chatMessage && range.intersectsNode(row))
    .flatMap((row): SelectedMessage[] => {
      const id = row.dataset.chatMessage ?? "";
      const head = [
        ...row.querySelectorAll("[data-message-head], [data-message-avatar]"),
      ].some((node) => range.intersectsNode(node));
      const texts = [...row.querySelectorAll("[data-rich-content]")].filter(
        (node) => !node.parentElement?.closest("[data-rich-content]"),
      );
      if (!texts.length) return [{ id, text: "", whole: true, head }];
      const parts = texts.flatMap((node) => {
        const part = selectedPart(range, node);
        return part ? [part] : [];
      });
      if (!parts.length) return [];
      return [
        {
          id,
          text: parts.map((part) => part.text).join("\n"),
          whole:
            parts.length === texts.length && parts.every((part) => part.whole),
          head,
        },
      ];
    });
  return picked.length ? picked : null;
}

/** The part of one text element that a range takes in, or null when it takes in no text of it. */
function selectedPart(range: Range, node: Element) {
  if (!range.intersectsNode(node)) return null;
  const part = node.ownerDocument.createRange();
  part.selectNodeContents(node);
  const fromStart =
    range.compareBoundaryPoints(range.START_TO_START, part) <= 0;
  const toEnd = range.compareBoundaryPoints(range.END_TO_END, part) >= 0;
  if (!fromStart) part.setStart(range.startContainer, range.startOffset);
  if (!toEnd) part.setEnd(range.endContainer, range.endOffset);
  const text = plainText(part.cloneContents()).replace(/^\n+|\n+$/g, "");
  return text.trim() ? { text, whole: fromStart && toEnd } : null;
}

const BLOCKS = new Set([
  "P",
  "DIV",
  "LI",
  "PRE",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "TR",
  "UL",
  "OL",
  "TABLE",
]);

/** The text of copied nodes, with a line break after each block, as the browser copies it. */
function plainText(node: Node): string {
  if (node.nodeType === node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeName === "BR") return "\n";
  const inner = [...node.childNodes].map(plainText).join("");
  return BLOCKS.has(node.nodeName) && !inner.endsWith("\n")
    ? `${inner}\n`
    : inner;
}

/** One line a copied message becomes. */
export type TranscriptLine = { when: string; who: string; text: string };

/** Copied messages as WhatsApp writes them (Gimenes #3955): "[time, date] name: text", one per message. */
export function transcriptText(lines: readonly TranscriptLine[]) {
  return lines
    .filter((line) => line.text.trim())
    .map((line) => `[${line.when}] ${line.who}: ${line.text.trim()}`)
    .join("\n");
}
