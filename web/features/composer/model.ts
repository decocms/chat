import { mentionHandle, mentionWho } from "../../../shared/mention";
import {
  FILE_TYPES as UPLOAD_FILE_TYPES,
  maxBytes,
} from "../../../shared/composition";
import { EMOJI } from "../../../shared/emoji";
import type { Attachment, Message, Room } from "../../../shared/room";
import type { ComposerAgent } from "./types";
export const AUDIO_EXT: Readonly<Record<string, string>> = {
  m4a: "audio/x-m4a",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  flac: "audio/flac",
};
export const FILE_TYPES = new Set(UPLOAD_FILE_TYPES);
export const FILE_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/html,.html,.htm,text/markdown,.md,text/plain,.txt,text/csv,.csv,audio/*,.m4a,.mp3,.wav,.aac,.ogg,.opus,.webm,.flac";
export const mediaType = (value: string) =>
  value.split(";")[0].trim().toLowerCase();
export function normalizeFile(input: File, now = Date.now()): File {
  let file = input;
  const extension = (/\.(\w+)$/.exec(file.name)?.[1] || "").toLowerCase();
  let type = mediaType(file.type);
  if (!type && /\.html?$/i.test(file.name)) type = "text/html";
  if (!type && extension === "md") type = "text/markdown";
  if (extension === "txt") type = "text/plain";
  if (extension === "csv") type = "text/csv";
  if (AUDIO_EXT[extension] && !type.startsWith("audio/"))
    type = AUDIO_EXT[extension];
  const name =
    !file.name || file.name === "image.png"
      ? `print-${new Date(now).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.png`
      : file.name;
  if (type !== file.type || name !== file.name)
    // A Blob part avoids older Bun retaining the original File's name.
    file = new File([file.slice()], name, { type });
  return file;
}
export const fileIssue = (file: File) =>
  !FILE_TYPES.has(mediaType(file.type))
    ? "type"
    : file.size > maxBytes(mediaType(file.type))
      ? "size"
      : file.size === 0
        ? "empty"
        : null;
export const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "");
export function mentionPicks(
  text: string,
  caret: number,
  room: Room,
  names: Readonly<Record<string, string>> = {},
  agents: readonly ComposerAgent[] = [],
) {
  const before = text.slice(0, caret),
    match = /(^|\s)@([\p{L}\p{N}._-]*)$/u.exec(before);
  if (!match) return null;
  const query = fold(match[2]);
  const tagPeople = {
    members: room.members,
    names: { ...names, ...room.names },
    handles: room.handles,
  };
  // Each person by name with their @handle (two Rafaels are two rows): picking inserts the tag that reaches only them.
  const people = room.members
    .filter((email) => email !== room.me)
    .map((email) => ({
      email,
      handle: mentionHandle(email, tagPeople),
      label: room.names?.[email] || names[email] || email.split("@")[0],
      agent: false,
    }));
  for (const agent of agents)
    if (
      agent.email === room.me &&
      typeof agent.name === "string" &&
      agent.name.trim()
    )
      people.push({
        email: agent.email,
        handle: agent.name,
        label: "seu agent no sandbox",
        agent: true,
      });
  // @room calls everyone in the room (the server reads @sala/@todos the same way).
  people.push({
    email: "",
    handle: "room",
    label: "todos na sala",
    agent: false,
  });
  return {
    start: before.length - match[2].length - 1,
    items: people
      .filter(
        (person) =>
          !query ||
          person.handle.startsWith(query) ||
          fold(person.label).includes(query) ||
          (!!person.email && fold(person.email).startsWith(query)),
      )
      .slice(0, 8),
  };
}
/** Whether `@handle` reaches someone in this room: @vibe/@ai, @room/@sala/@todos, or a member by
 *  first name, email local part or its first token (the server's and the sent message's rule). */
export function knownMention(
  handle: string,
  room: Room,
  names: Readonly<Record<string, string>> = {},
) {
  const key = fold(handle);
  if (!key) return false;
  if (["vibe", "ai", "room", "sala", "todos"].includes(key)) return true;
  return (
    mentionWho(key, {
      members: room.members,
      names: { ...names, ...room.names },
      handles: room.handles,
    }) !== null
  );
}
/** Where the known @mentions sit in a draft: [start (the @), end) pairs, the same rule that
 *  highlights them in a sent message (`(^|[\s(])@handle`), kept only when `known` names someone. */
export function mentionSpans(
  text: string,
  known: (handle: string) => boolean,
): [number, number][] {
  const out: [number, number][] = [];
  if (!text.includes("@")) return out;
  for (const match of text.matchAll(/(^|[\s(])@([\p{L}\p{N}._-]+)/gu)) {
    if (!known(match[2])) continue;
    const start = match.index + match[1].length;
    out.push([start, start + match[2].length + 1]);
  }
  return out;
}
/** The draft split into plain runs and mentions, for the highlight layer behind the field. */
export function mentionSegments(
  text: string,
  known: (handle: string) => boolean,
) {
  const out: { text: string; mention: boolean }[] = [];
  let at = 0;
  for (const [start, end] of mentionSpans(text, known)) {
    if (start > at) out.push({ text: text.slice(at, start), mention: false });
    out.push({ text: text.slice(start, end), mention: true });
    at = end;
  }
  if (at < text.length) out.push({ text: text.slice(at), mention: false });
  return out;
}
/** A key on a collapsed caret next to a mention treats it as one unit:
 *  Backspace/Delete select the whole mention (the browser's own delete then removes it, so undo
 *  works), ←/→ jump over it. `typing` = the caret sits right where the person just typed: a
 *  mention typed by hand still loses one letter per Backspace, so fixing a typo isn't a surprise. */
export function mentionKey(
  text: string,
  caret: number,
  key: string,
  known: (handle: string) => boolean,
  typing = false,
): { select: [number, number] } | { move: number } | null {
  if (!["Backspace", "Delete", "ArrowLeft", "ArrowRight"].includes(key))
    return null;
  const spans = mentionSpans(text, known);
  const ending = spans.find(([, end]) => end === caret),
    starting = spans.find(([start]) => start === caret);
  if (key === "Backspace" && ending && !typing) return { select: ending };
  if (key === "Delete" && starting) return { select: starting };
  if (key === "ArrowLeft" && ending && !typing) return { move: ending[0] };
  if (key === "ArrowRight" && starting) return { move: starting[1] };
  return null;
}
export function insertAt(
  text: string,
  start: number,
  end: number,
  value: string,
) {
  return {
    text: text.slice(0, start) + value + text.slice(end),
    caret: start + value.length,
  };
}
export function emojiPicks(query: string) {
  const needle = query.trim().toLowerCase().replace(/:/g, "");
  return [
    ...new Map(
      Object.entries(EMOJI).map(([name, value]) => [value, name]),
    ).entries(),
  ]
    .filter(
      ([emoji]) =>
        !needle ||
        Object.entries(EMOJI).some(
          ([name, value]) => value === emoji && name.includes(needle),
        ),
    )
    .map(([emoji, name]) => ({ emoji, name }));
}
/** Slack-style `:sho` before the caret (2+ letters, after a space or the start, not closed with
 *  a second `:`): the emoji whose :shortcode: matches, names that start with it first, one row per emoji. */
export function emojiTyped(text: string, caret: number) {
  const match = /(^|[\s(])(:([a-z0-9_+-]{2,40}))$/.exec(
    text.slice(0, caret).toLowerCase(),
  );
  if (!match) return null;
  const query = match[3],
    seen = new Set<string>(),
    items: { emoji: string; name: string }[] = [];
  const table: Readonly<Record<string, string>> = EMOJI;
  const names = Object.keys(table).filter((name) => name.includes(query));
  names.sort(
    (a, b) =>
      Number(!a.startsWith(query)) - Number(!b.startsWith(query)) ||
      a.length - b.length,
  );
  for (const name of names) {
    const emoji = table[name];
    if (seen.has(emoji)) continue;
    seen.add(emoji);
    items.push({ emoji, name });
    if (items.length === 8) break;
  }
  return items.length ? { start: caret - match[2].length, items } : null;
}
export const quoteSnippet = (message: Message) =>
  (
    message.text ||
    message.files?.map((file) => file.name).join(", ") ||
    (message.poll ? "votação" : "")
  )
    .replace(/\*\*|`|^[#>]+ ?/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
export type MessageSnapshot = {
  text: string;
  fileIds: string[];
  replyId?: number;
  baseline: number;
  revision: number;
};
export function matchingMessage(
  room: Room,
  thread: string,
  snapshot: MessageSnapshot,
): Message | undefined {
  const files = snapshot.fileIds.slice().sort().join(",");
  return room.messages.find(
    (message) =>
      message.id > snapshot.baseline &&
      message.author === room.me &&
      message.kind !== "agent" &&
      message.tag !== "fire" &&
      message.thread === thread &&
      message.text === snapshot.text &&
      (message.reply_to || undefined) === snapshot.replyId &&
      (message.files || [])
        .map((file) => file.id)
        .sort()
        .join(",") === files,
  );
}
export const maxMessageId = (room: Room) =>
  [room.messages, room.origins || []].reduce(
    (max, rows) =>
      rows.reduce((value, message) => Math.max(value, message.id), max),
    0,
  );
export type PendingAttachment = {
  id: number;
  name: string;
  type: string;
  size: number;
  file?: File;
  meta?: Attachment;
  phase: "queued" | "uploading" | "ready" | "error";
  error?: string;
};
export function composerError(
  error: string,
  t: (text: string, vars?: Record<string, string | number>) => string,
): string {
  if (error === "timeout")
    return t(
      "O upload não foi confirmado. Confira os arquivos antes de tentar novamente.",
    );
  if (error === "account-changed")
    return t("A conta mudou; selecione o arquivo novamente.");
  if (error === "forbidden") return t("Você não tem acesso a esta sala.");
  if (error === "offline") return t("Sem conexão. Seu rascunho foi mantido.");
  if (error === "text-limit")
    return t("A mensagem pode ter no máximo 4000 caracteres.");
  if (error === "attachments-limit")
    return t("Anexe no máximo 10 arquivos por mensagem.");
  if (error === "attachments-pending")
    return t("Espere os anexos terminarem ou remova-os.");
  if (error === "reply-missing")
    return t(
      "A mensagem não está mais disponível. Cancele a resposta para continuar.",
    );
  if (error === "draft-limit")
    return t(
      "Envie ou descarte um dos seus 64 rascunhos antes de abrir outro.",
    );
  if (error === "unknown thread")
    return t("O tópico não está mais disponível. Seu rascunho foi mantido.");
  if (error.startsWith("blocked:"))
    return t(
      "Não enviei: parece {reason}. Segredo não entra na sala, nem pra você nem pros agents. Manda por um canal seguro.",
      { reason: error.slice(8).trim() },
    );
  if (error.startsWith("file-type:"))
    return `${error.slice(11).trim()}: ${t("só imagens (png, jpg, webp, gif), PDF, HTML, Markdown, .txt, .csv e áudio.")}`;
  if (error.startsWith("file-size:"))
    return `${error.slice(10).trim()}: ${t("Arquivo maior que o limite: 10MB, ou 50MB para áudio.")}`;
  if (error.startsWith("file-empty:"))
    return `${error.slice(11).trim()}: ${t("Arquivo vazio.")}`;
  return error;
}
