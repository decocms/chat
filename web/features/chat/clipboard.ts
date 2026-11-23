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

/**
 * The messages a selection takes in, when the browser's own copy would bring
 * the room's chrome along (names, avatars, agent marks, reactions, buttons):
 * the selection reaches past one message's text. Null when it stays inside
 * one message's text (or touches no message): then the browser copies it.
 */
export function selectedMessageIds(range: Range, root: Element) {
  const start = range.commonAncestorContainer;
  const inside = start instanceof Element ? start : start.parentElement;
  if (inside?.closest("[data-rich-content]")) return null;
  const ids = [...root.querySelectorAll<HTMLElement>("[data-chat-message]")]
    .filter((row) => range.intersectsNode(row))
    .map((row) => row.dataset.chatMessage ?? "")
    .filter(Boolean);
  return ids.length ? ids : null;
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
