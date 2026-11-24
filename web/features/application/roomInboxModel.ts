import type { Room } from "../../../shared/room";
import type { InboxResult } from "../../../shared/schemas";
import type { Wait, InboxMention, InboxTask } from "../../app/types";
export type RoomInboxMessage = {
  /** reply = an answer to what you sent from the Home's ask box (wait r<msg>). */
  kind: "ask" | "claude" | "mention" | "reply";
  key: string;
  book: string;
  room: string;
  thread: string;
  topic: string | null;
  messageId: number | undefined;
  author: string;
  authorName: string | null;
  text: string;
  ts: number;
  wait?: Wait;
  mention?: InboxMention;
};
const messageId = (ref: string) => {
  const id = /^[mabr]\d+$/.test(ref) ? Number(ref.slice(1)) : NaN;
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
};
export function roomInboxModel(
  data: InboxResult,
  roomId: string,
  all: boolean,
) {
  const mine = <T extends { book_id: string }>(rows: readonly T[]) =>
    rows.filter((row) => all || !roomId || row.book_id === roomId);
  const waits = mine(data.waits),
    asks = waits.filter((wait) => !wait.ref.startsWith("t")),
    oks = waits.filter((wait) => wait.ref.startsWith("t"));
  const seen = new Set(
    asks.flatMap((wait) => {
      const id = messageId(wait.ref);
      return id ? [`${wait.book_id}/${id}`] : [];
    }),
  );
  const messages: RoomInboxMessage[] = [
    ...asks.map((wait) => ({
      kind: wait.ref.startsWith("m")
        ? ("ask" as const)
        : wait.ref.startsWith("r")
          ? ("reply" as const)
          : ("claude" as const),
      key: `w:${wait.book_id}:${wait.ref}`,
      book: wait.book_id,
      room: wait.room,
      thread: wait.thread,
      topic: wait.topic,
      messageId: messageId(wait.ref),
      author: wait.author,
      authorName: wait.author_name,
      text: wait.text,
      ts: wait.ts,
      wait,
    })),
    ...mine(data.mentions)
      .filter((mention) => !seen.has(`${mention.book_id}/${mention.msg_id}`))
      .map((mention) => ({
        kind: "mention" as const,
        key: `m:${mention.book_id}:${mention.msg_id}`,
        book: mention.book_id,
        room: mention.room,
        thread: mention.thread,
        topic: null,
        messageId: mention.msg_id,
        author: mention.author,
        authorName: mention.author_name,
        text: mention.text,
        ts: mention.ts,
        mention,
      })),
  ].sort((left, right) => left.ts - right.ts);
  const waitingTasks = new Set(
    oks.map((wait) => `${wait.book_id}/${wait.ref.slice(1)}`),
  );
  const groups = new Map<
    string,
    {
      room: string;
      bookId: string;
      epicId: string;
      epic: string | null;
      first: InboxTask;
      tasks: InboxTask[];
    }
  >();
  for (const task of mine(data.tasks)) {
    if (waitingTasks.has(`${task.book_id}/${task.task_id}`)) continue;
    const key = `${task.book_id}/${task.epic_id}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        room: task.room,
        bookId: task.book_id,
        epicId: task.epic_id,
        epic: task.epic,
        first: task,
        tasks: [],
      };
      groups.set(key, group);
    }
    group.tasks.push(task);
  }
  return { messages, oks, groups: [...groups.values()] };
}
export function inboxTopic(
  item: RoomInboxMessage,
  room: Room | null,
): string | null {
  return (
    item.topic ||
    (item.thread === "main"
      ? null
      : room?.id === item.book
        ? (room.epics.find((epic) => epic.id === item.thread)?.title ?? "")
        : "")
  );
}
/** One line of a message for the Inbox: no Markdown marks, no line breaks. */
export function inboxPreview(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|~~|`)(.+?)\1/g, "$2")
    .replace(/\s*\n+\s*/g, " · ")
    .trim();
}
/** The asks "Resolve all" takes: in this scope, not already resolved in the app. */
export function inboxAsks(
  messages: readonly RoomInboxMessage[],
  hidden: readonly string[],
) {
  const gone = new Set(hidden);
  return messages.flatMap((message) =>
    message.kind === "ask" &&
    message.wait &&
    !gone.has(`${message.wait.book_id}/${message.wait.ref}`)
      ? [message.wait]
      : [],
  );
}
