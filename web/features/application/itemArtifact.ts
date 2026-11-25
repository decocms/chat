import type { Attachment, Message } from "../../../shared/room";

/**
 * What an open Inbox item is about, when it is about a thing: a file or an app
 * of the room (an attachment, or a room app `apps/<name>.html` named in the
 * text as `[[app:room/<name>]]` or by its path), or the thread's doc. The Home
 * shows it big beside the thread, so "Leandro made a new presentation, look"
 * opens on the presentation.
 */
export type ItemArtifact =
  | Readonly<{ kind: "file"; key: string; name: string; file: Attachment }>
  | Readonly<{ kind: "doc"; key: "doc"; name: string }>;

/** How many messages before the ask (and after it) count as "around" it. */
export const AROUND_BEFORE = 6;
export const AROUND_AFTER = 2;

const APP_REF = /\[\[app:room\/([\w.-]+)\]\]|\bapps\/([\w.-]+)\.html\b/g;
const DOC_REF = /\b(doc|documento|document)\b/i;

/** The newest version of each file name: what a name in the text opens. */
function latestByName(files: readonly Attachment[]) {
  const byName = new Map<string, Attachment>();
  for (const file of files) {
    const known = byName.get(file.name);
    if (!known || file.ts > known.ts) byName.set(file.name, file);
  }
  return byName;
}

/** The files a message carries or names: its attachments, then the room apps its text names. */
export function messageArtifacts(
  message: Pick<Message, "files" | "text">,
  known: readonly Attachment[],
): Attachment[] {
  const byName = latestByName(known);
  const out = [...(message.files ?? [])];
  for (const match of message.text.matchAll(APP_REF)) {
    const file = byName.get(`apps/${match[1] ?? match[2]}.html`);
    if (file && !out.some((item) => item.id === file.id)) out.push(file);
  }
  return out;
}

const fileArtifact = (file: Attachment): ItemArtifact => ({
  kind: "file",
  key: `file:${file.name}`,
  name: file.name.replace(/^apps\//, "").replace(/\.html$/, ""),
  file,
});

/**
 * The item's artifact, and every artifact of the thread for the switcher.
 *
 * The rule, in order:
 * (a) a file or room app the asked message (`focus`) carries or names;
 * (b) else the newest one carried or named by a message around the ask
 *     (AROUND_BEFORE messages before it, AROUND_AFTER after; with no asked
 *     message, the thread's last AROUND_BEFORE messages);
 * (c) else the thread's doc, when it has text and the asked message talks
 *     about it ("doc", "documento").
 * Else none: the thread takes the whole pane. `all` is the primary first, then
 * the thread's other files and apps (one per name, newest first), then the
 * doc when it has text.
 */
export function itemArtifacts(input: {
  /** The thread's messages, oldest first. */
  messages: readonly Message[];
  /** Every file the room knows (for the names in the text). */
  known: readonly Attachment[];
  focus?: number;
  doc?: string;
  docName: string;
}): { primary: ItemArtifact | null; all: ItemArtifact[] } {
  const { messages, known } = input;
  const live = messages.filter((message) => !message.deleted);
  const index = input.focus
    ? live.findIndex((message) => message.id === input.focus)
    : -1;
  const asked = index >= 0 ? live[index] : undefined;
  const hasDoc = !!input.doc?.trim();
  const doc: ItemArtifact = { kind: "doc", key: "doc", name: input.docName };

  let primary: ItemArtifact | null = null;
  const own = asked ? messageArtifacts(asked, known) : [];
  if (own[0]) primary = fileArtifact(own[0]);
  else {
    const around =
      index >= 0
        ? live.slice(
            Math.max(0, index - AROUND_BEFORE),
            index + 1 + AROUND_AFTER,
          )
        : live.slice(-AROUND_BEFORE);
    for (const message of [...around].reverse()) {
      const found = messageArtifacts(message, known)[0];
      if (found) {
        primary = fileArtifact(found);
        break;
      }
    }
  }
  if (!primary && hasDoc && asked && DOC_REF.test(asked.text)) primary = doc;

  const all: ItemArtifact[] = primary ? [primary] : [];
  for (const message of [...live].reverse())
    for (const file of messageArtifacts(message, known)) {
      const item = fileArtifact(file);
      if (!all.some((other) => other.key === item.key)) all.push(item);
    }
  if (hasDoc && !all.some((item) => item.key === "doc")) all.push(doc);
  return { primary, all };
}
