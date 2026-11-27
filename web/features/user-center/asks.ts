import type { MeWait } from "../../../shared/schemas";
import type { z } from "zod";
import { sendRoomCommandOnce } from "../../app/roomReact";
import { choicesOf } from "../chat-interactive/eligibility";

type Wait = z.infer<typeof MeWait>;

/**
 * Your agents waiting on you (Gimenes #6602, #6617): the a<msg> waits of every room, the oldest first. Each is a
 * question that the plugin's hooks or the runner posted ("⏸ Seu Claude pede permissão", "❓ Seu Claude pergunta").
 * They are about you, not about a room, so they are a row of the user center (docs/design.md, "The user center").
 */
export const agentAsks = (waits: readonly Wait[] | undefined) =>
  (waits ?? [])
    .filter((wait) => /^a\d+$/.test(wait.ref))
    .slice()
    .sort((a, b) => a.ts - b.ts);

/** The question's options (its message's choices JSON, in the wait's `about`), else none. */
export const askOptions = (wait: Wait) => choicesOf(wait.about)?.options ?? [];

/** The question without the opener and the markdown: what the row shows under its title. */
export const askLine = (wait: Wait) =>
  wait.text
    .replace(/^(⏸|❓)\s*Seu Claude\s*/, "")
    .replace(/[*`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);

/**
 * Answer the question from the user center, as its buttons in the room do: a reply in its thread with the option.
 * The room clears the wait (src/book.ts addMessage). True when the room took it.
 */
export function answerAsk(wait: Wait, value: string) {
  const id = Number(wait.ref.slice(1));
  if (
    !/^a\d+$/.test(wait.ref) ||
    !Number.isSafeInteger(id) ||
    !askOptions(wait).includes(value)
  )
    return Promise.resolve(false);
  const path = `/ws/${encodeURIComponent(wait.book_id)}?t=${encodeURIComponent(wait.thread)}&peek=1`;
  const url = new URL(path, globalThis.location?.href ?? "http://localhost/");
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return sendRoomCommandOnce(url.href, {
    t: "msg",
    thread: wait.thread,
    text: value,
    files: [],
    reply_to: id,
    client_id: crypto.randomUUID(),
  });
}
