import type { Ack, Room } from "../../../shared/room";
import type { ChatBridge, ChatMessage } from "../../app/chatTypes";
type Receipt = NonNullable<Room["receipts"]>[number];
function lastWhere<T>(
  rows: readonly T[],
  predicate: (row: T) => boolean,
): T | undefined {
  for (let index = rows.length - 1; index >= 0; index--)
    if (predicate(rows[index])) return rows[index];
  return undefined;
}
export const prettyModel = (value: string) =>
  value.replace(
    /^claude-(opus|sonnet|haiku|fable)-(\d+)-(\d+)(?:-\d{8})?$/i,
    (_, family: string, a: string, b: string) =>
      `Claude ${family[0].toUpperCase()}${family.slice(1)} ${a}.${b}`,
  );
export const continues = (
  previous: ChatMessage | undefined,
  current: ChatMessage,
) =>
  !!previous &&
  previous.author === current.author &&
  (previous.kind || null) === (current.kind || null) &&
  (previous.tag || null) === (current.tag || null) &&
  current.ts - previous.ts < 5 * 60_000 &&
  !previous.poll &&
  !current.poll;
export const isNotice = (m: ChatMessage) =>
  m.author === "ai" &&
  (m.tag === "notice" ||
    m.tag === "done" ||
    /^↩ (Reabri|I reopened)/.test(m.text));
export const messageKind = (m: ChatMessage) =>
  m.tag === "reminder"
    ? "reminder"
    : m.tag === "issue"
      ? "issue"
      : isNotice(m)
        ? "notice"
        : "regular";
const foldKey = (m?: ChatMessage) =>
  m?.tag === "reminder"
    ? m.text.split("\n")[0]
    : m?.tag === "issue"
      ? "⚠issue"
      : null;
export function foldMessages(list: readonly ChatMessage[]) {
  const out: ChatMessage[] = [];
  for (const m of list) {
    if (isNotice(m)) continue; // @vibe's routine lines are gone (Gui #3317); old ones stay in the DB, hidden here
    const key = foldKey(m),
      previous = out.at(-1);
    if (key && previous && foldKey(previous) === key)
      out[out.length - 1] = {
        ...m,
        runs: [...(previous.runs || [previous.ts]), m.ts],
        group: [...(previous.group || [previous]), m],
      };
    else out.push(m);
  }
  return out;
}
/** A new thread's title from its message (Gimenes #4123): the first line, no Markdown, at most 60 characters,
 *  cut at a word. */
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
/** A thread id the client picks (8 hex, as the server's own): the app opens it, and a retry does not make two. */
export const newThreadId = () =>
  crypto.randomUUID().replace(/-/g, "").slice(0, 8);
/** A message can start a thread: not in a DM, not a status line, and not the start of a thread already, either
 *  itself or through the line in main that replies to it (a thread from inside a thread). The room's `origins`
 *  carry every live thread's origin, so a thread view knows main's lines without loading main. */
export const canStartThread = (room: Room, m: ChatMessage) => {
  if (room.book.dm || m.tag || m.author === "ai") return false;
  const starts = new Set(room.epics.map((epic) => epic.from_msg));
  if (starts.has(m.id)) return false;
  return ![...room.messages, ...(room.origins ?? [])].some(
    (line) =>
      line.reply_to === m.id && line.thread === "main" && starts.has(line.id),
  );
};
/** A thread started from this message: it keeps its origin, so it has no delete (Gimenes #4621; the server refuses it too). */
export const startsThread = (room: Room, m: ChatMessage) =>
  room.epics.some((epic) => epic.from_msg === m.id);
/** `poll` names a poll with no text, in the app's language. */
export const messageSnippet = (m: ChatMessage, poll = "votação") =>
  (m.text || m.files?.map((f) => f.name).join(", ") || (m.poll ? poll : ""))
    .replace(/\*\*|`|^[#>]+ ?/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
export function reminderParts(m: ChatMessage) {
  const [heading, ...rest] = m.text.split("\n\n"),
    head = heading.replace(/^⏰\s*/, ""),
    match = head.match(/^\*\*(.+?)\*\*\s*(.*)$/);
  return {
    name: match?.[1],
    head: match?.[2] ?? head,
    body: rest.join("\n\n"),
    runs: m.runs || [m.ts],
  };
}
export function issueParts(m: ChatMessage) {
  const [head, ...rest] = m.text.split("\n\n");
  return { head: head.replace(/^⚠\s*/, ""), body: rest.join("\n\n") };
}
export type MessageStatus = {
  ack: Ack;
  kind: "blocked" | "doing" | "done" | "waiting" | "idle";
  owners: string[];
};
export type Reader = { receipt: Receipt; read: boolean };
export type MessageFooter = { statuses: MessageStatus[]; readers: Reader[] };
export function messageFooters(
  room: Room,
  thread: string,
  now: number,
): Map<number, MessageFooter> {
  const footers = new Map<number, MessageFooter>(),
    seen = new Set<string>();
  const at = (id: number) => {
    let value = footers.get(id);
    if (!value) {
      value = { statuses: [], readers: [] };
      footers.set(id, value);
    }
    return value;
  };
  const latest = new Set<string>();
  for (const ack of [...(room.acks || [])].sort((a, b) => b.ts - a.ts)) {
    const key = `${ack.msg_id}|${ack.who}|${ack.email}`;
    if (latest.has(key)) continue;
    latest.add(key);
    if (ack.status === "dismissed") continue;
    const owners = [
      ...new Set(
        room.epics
          .filter((e) => e.from_msg === ack.msg_id && !e.done)
          .flatMap((e) =>
            e.tasks
              .filter((t) => t.status !== "done" && t.owner)
              .map((t) => t.owner!),
          ),
      ),
    ];
    const kind =
      ack.status === "blocked"
        ? "blocked"
        : ack.status === "doing" && now - ack.ts < 20 * 60_000
          ? "doing"
          : ack.status === "done"
            ? "done"
            : owners.length
              ? "waiting"
              : "idle";
    // An agent that looked and did nothing (a router passing, or work that went quiet) is not a line under the
    // message: it shows only as a read receipt, so a run of messages has no gaps between them.
    if (kind === "idle") continue;
    seen.add(key);
    at(ack.msg_id).statuses.push({ ack, kind, owners });
  }
  const list = room.messages.filter(
    (m) => m.thread === thread && m.tag !== "fire",
  );
  const readers = new Map<string, Receipt>();
  for (const receipt of room.receipts || []) {
    const key = `${receipt.who}|${receipt.email}`;
    const previous = readers.get(key);
    readers.set(
      key,
      previous
        ? {
            ...receipt,
            read: Math.max(previous.read, receipt.read),
            delivered: Math.max(previous.delivered, receipt.delivered),
          }
        : receipt,
    );
  }
  for (const receipt of readers.values()) {
    const message = lastWhere(
      list,
      (m) =>
        m.id <= Math.max(receipt.read, receipt.delivered) &&
        !(m.kind === "agent" && m.author === receipt.email),
    );
    if (!message || seen.has(`${message.id}|${receipt.who}|${receipt.email}`))
      continue;
    at(message.id).readers.push({ receipt, read: receipt.read >= message.id });
  }
  for (const footer of footers.values())
    footer.readers.sort((a, b) => Number(b.read) - Number(a.read));
  return footers;
}
export type Worker = {
  who: string;
  email: string;
  /** The epic this work happens in, when the agent took a message of another thread (the main thread) to it. */
  epic?: { id: string; title: string };
};
/** The epic an agent took a message to: the first open epic (not the message's own thread) the same person's agent
 * posted in after acknowledging it. Acks don't carry a thread, so this is read from the room. */
function ackEpic(
  room: Room,
  ack: { msg_id: number; email: string; ts: number },
): { id: string; title: string } | undefined {
  const own = room.messages.find((m) => m.id === ack.msg_id)?.thread;
  for (const m of room.messages) {
    if (
      m.kind !== "agent" ||
      m.author !== ack.email ||
      m.ts < ack.ts ||
      m.thread === own ||
      m.thread === "main"
    )
      continue;
    const epic = room.epics.find((e) => e.id === m.thread && !e.done);
    if (epic) return { id: epic.id, title: epic.title };
  }
  return undefined;
}
/** Fresh "doing" acks (the latest per message and agent, under 20 minutes) on messages of other threads whose work
 * moved to this epic: the epic shows who works in it even when they took the message from the main thread. */
function latestAcks(room: Room) {
  const latest = new Map<string, NonNullable<Room["acks"]>[number]>();
  for (const ack of room.acks || []) {
    const key = `${ack.msg_id}|${ack.who}|${ack.email}`;
    const prior = latest.get(key);
    if (!prior || ack.ts > prior.ts) latest.set(key, ack);
  }
  return [...latest.values()];
}
/** Whether a message taken to this epic was marked done (or dismissed): its agent's recent posts stop reading as work. */
function movedFinished(room: Room, epic: string) {
  return latestAcks(room).some((ack) => {
    if (ack.status !== "done" && ack.status !== "dismissed") return false;
    // Where the work went is read from when it started: the first ack of this agent on this message.
    const started = Math.min(
      ...(room.acks || [])
        .filter(
          (a) =>
            a.msg_id === ack.msg_id &&
            a.who === ack.who &&
            a.email === ack.email,
        )
        .map((a) => a.ts),
    );
    return ackEpic(room, { ...ack, ts: started })?.id === epic;
  });
}
function movedWorkers(room: Room, epic: string, now: number): Worker[] {
  const out: Worker[] = [];
  for (const ack of latestAcks(room))
    if (
      ack.status === "doing" &&
      now - ack.ts < 20 * 60_000 &&
      ackEpic(room, ack)?.id === epic &&
      !out.some((w) => w.who === ack.who && w.email === ack.email)
    )
      out.push({ who: ack.who, email: ack.email });
  return out;
}
export function threadWorkers(
  room: Room,
  thread: string,
  now: number,
): Worker[] {
  if (thread.startsWith("pre:")) return [];
  const epic = room.epics.find((e) => e.id === thread);
  if (epic?.done) return [];
  const messages = [
    ...room.messages,
    ...(room.origins || []).filter(
      (o) => !room.messages.some((m) => m.id === o.id),
    ),
  ];
  const branched = new Set(
    room.epics.filter((e) => e.id !== epic?.id).map((e) => e.from_msg),
  );
  const ids = new Set(
    messages
      .filter((m) => m.thread === thread && !branched.has(m.id))
      .map((m) => m.id),
  );
  if (epic?.from_msg) ids.add(epic.from_msg);
  const logical = new Set<string>();
  const latest = [...(room.acks || [])]
    .filter((a) => ids.has(a.msg_id))
    .sort((a, b) => b.ts - a.ts)
    .filter((a) => {
      const key = `${a.msg_id}|${a.who}|${a.email}`;
      if (logical.has(key)) return false;
      logical.add(key);
      return true;
    });
  const acks = latest.filter((a) => a.status !== "dismissed"),
    seen = new Set<string>(),
    workers: Worker[] = [];
  for (const ack of acks) {
    const key = `${ack.who}|${ack.email}`;
    if (
      ack.status === "doing" &&
      now - ack.ts < 20 * 60_000 &&
      !seen.has(key) &&
      acks.find(
        (a) =>
          a.msg_id === ack.msg_id && a.who === ack.who && a.email === ack.email,
      ) === ack
    ) {
      seen.add(key);
      const moved = epic ? undefined : ackEpic(room, ack);
      workers.push({
        who: ack.who,
        email: ack.email,
        ...(moved ? { epic: moved } : {}),
      });
    }
  }
  if (epic)
    for (const worker of movedWorkers(room, epic.id, now))
      if (!seen.has(`${worker.who}|${worker.email}`)) {
        seen.add(`${worker.who}|${worker.email}`);
        workers.push(worker);
      }
  if (workers.length || !epic) return workers;
  const doing = acks.find(
    (a) => a.status === "doing" && now - a.ts < 20 * 60_000,
  );
  if (doing) return [{ who: doing.who, email: doing.email }];
  if (
    latest[0]?.status === "done" ||
    latest[0]?.status === "dismissed" ||
    movedFinished(room, epic.id)
  )
    return [];
  const last = lastWhere(
    room.messages,
    (m) => m.thread === thread && m.kind === "agent",
  );
  return last && last.tag !== "done" && now - last.ts < 3 * 60_000
    ? [{ who: last.via || "Agent", email: last.author }]
    : [];
}
/** Day divider (Gui #3423): true when `current` starts a new local calendar day after `previous`. */
export const newDay = (
  previous: ChatMessage | undefined,
  current: ChatMessage,
) =>
  !previous ||
  new Date(previous.ts).toDateString() !== new Date(current.ts).toDateString();
/** "Hoje", "Ontem", else a weekday and date ("quarta, 18 de nov."), with the year when it isn't this year. */
export function dayLabel(
  ts: number,
  now: number,
  locale: string | undefined,
  t: (text: string) => string,
) {
  const d = new Date(ts),
    today = new Date(now);
  if (d.toDateString() === today.toDateString()) return t("Hoje");
  if (d.toDateString() === new Date(now - 864e5).toDateString())
    return t("Ontem");
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Who wrote a message, as its row names them and as a copy of it reads. */
export function messageAuthor(
  message: ChatMessage,
  vb: Pick<ChatBridge, "t" | "name">,
) {
  return message.author === "ai"
    ? "@vibe"
    : message.kind === "agent"
      ? vb.t("{via} de {who}", {
          via: message.via || "agent",
          who: vb.name(message.author),
        })
      : vb.name(message.author);
}
