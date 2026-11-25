import type { ChatMessage } from "../../app/chatTypes";
import { messageKind } from "../chat/model";

/** A message you can forward: a person's or an agent's message with text or files. Not a notice, an issue, a
 *  reminder, a deleted message or an agent that is still typing. */
export function forwardable(message: ChatMessage): boolean {
  return (
    messageKind(message) === "regular" &&
    !message.deleted &&
    !!(message.text?.trim() || message.files?.length)
  );
}

/** The messages picked in selection mode, in the order of the thread, and the last one clicked (Shift+click starts
 *  its range there). */
export type ForwardPick = Readonly<{
  ids: readonly number[];
  anchor: number | null;
}>;

/**
 * A click on a message in selection mode. A click toggles the message. Shift+click gives every message from the last
 * one clicked to this one the state of the last one clicked: usually "selected", so Shift+click selects the range.
 * `order` is the ids that can be picked, oldest first; a click on another id changes nothing.
 */
export function pickMessage(
  pick: ForwardPick,
  order: readonly number[],
  id: number,
  shift = false,
): ForwardPick {
  const at = order.indexOf(id);
  if (at < 0) return pick;
  const chosen = new Set(pick.ids);
  const from = pick.anchor === null ? -1 : order.indexOf(pick.anchor);
  if (shift && from >= 0) {
    const on = chosen.has(pick.anchor!);
    for (const each of order.slice(Math.min(from, at), Math.max(from, at) + 1))
      if (on) chosen.add(each);
      else chosen.delete(each);
  } else if (chosen.has(id)) chosen.delete(id);
  else chosen.add(id);
  // Ids that are not in `order` (older messages that left the loaded window) stay, before the others.
  const kept = pick.ids.filter(
    (each) => !order.includes(each) && chosen.has(each),
  );
  return {
    ids: [...kept, ...order.filter((each) => chosen.has(each))],
    anchor: id,
  };
}

/** One forwarded message: who wrote it, when, its text and the names of its files. */
export type ForwardItem = Readonly<{
  who: string;
  when: string;
  text: string;
  files: readonly string[];
}>;
type Copy = (text: string, vars?: Record<string, string | number>) => string;

/**
 * The forwarded messages as one quote block, for the composer of the destination. A person's message draws lines
 * that start with "> " as one quote (rich-text `human`), and Markdown readers (the agents) read it the same way:
 *
 *   Encaminhado de Sala de teste › Lançamento
 *   > **Ana Souza** · 14:32, 25/11/2026
 *   > The text
 *   > Anexo: plan.pdf
 *   >
 *   > **Bruno Lima** · 14:35, 25/11/2026
 *   > More text
 */
export function forwardText(
  items: readonly ForwardItem[],
  from: string,
  t: Copy,
): string {
  const blocks = items.map((item) => {
    const lines = [`**${item.who}** · ${item.when}`];
    const text = item.text.replace(/\r\n?/g, "\n").trim();
    if (text) lines.push(...text.split("\n"));
    if (item.files.length)
      lines.push(
        item.files.length === 1
          ? t("Anexo: {name}", { name: item.files[0]! })
          : t("Anexos: {names}", { names: item.files.join(", ") }),
      );
    return lines.map((line) => (line ? `> ${line}` : ">")).join("\n");
  });
  if (!blocks.length) return "";
  return `${t("Encaminhado de {from}", { from })}\n${blocks.join("\n>\n")}`;
}

/** The package after what the composer already holds, with an empty line between them. */
export function withDraft(draft: string, text: string): string {
  const before = draft.trimEnd();
  return before ? `${before}\n\n${text}` : text;
}
