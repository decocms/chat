import type { InboxResult, MeResult } from "../../../shared/schemas";
import { threadWait, type ThreadWait } from "../../../shared/threadWait";
import type { InboxTask, Wait } from "../../app/types";
import { choicesOf, type Choices } from "../chat-interactive/eligibility";
import { mentionSegments } from "../composer/model";
import {
  fold,
  roomLabel,
  type RoomSummary,
  type RoomTarget,
} from "../home/model";
import type { CopyVars } from "./copy";
import type { ApplicationInbox, InboxBinding } from "./inbox";
import { roomInboxModel, type RoomInboxMessage } from "./roomInboxModel";

/**
 * The Home's Inbox tabs, as lists: the desktop Home draws them as tabs over its
 * split (HomeDesk), a phone's home as chips over its list of conversations
 * (HomePanel). One model, so both count and show the same items.
 * "Pra você": everything that needs you, newest first (asks and @mentions,
 * your tasks in review, your Claude's questions, answers to what you sent
 * from the ask box, your threads ready to close). "Menções": every @ of you.
 * "Tarefas": your open threads and tasks.
 */
export type HomeInboxTab = "foryou" | "mentions" | "tasks";
export type HomeInboxKind =
  | "ask"
  | "mention"
  | "claude"
  | "review"
  | "reply"
  | "room"
  | "task"
  | "thread";
export type HomeInboxCard = {
  key: string;
  kind: HomeInboxKind;
  book: string;
  room: string;
  thread: string;
  where: string;
  author: string;
  authorName: string | null;
  text: string;
  /** reply: what you asked from the Home's box. */
  about: string;
  ts: number;
  wait?: Wait;
  message?: RoomInboxMessage;
  task?: InboxTask;
  summary?: RoomSummary;
  news?: number;
  /** claude: the question's buttons (a<msg> waits carry them in `about`). */
  choices?: Choices | null;
  /** thread: an open thread you own (e<epic>): its state and how far its tasks went. */
  open?: ThreadWait;
};
/** The tabs in order; the labels are the application copy's keys. */
export const HOME_INBOX_TABS: readonly { id: HomeInboxTab; label: string }[] = [
  { id: "foryou", label: "Pra você" },
  { id: "mentions", label: "Menções" },
  { id: "tasks", label: "Tarefas" },
];
/** Your first name and your email's handle, folded: what an @ of you looks like. */
export const homeInboxHandles = (me: MeResult | null) =>
  [me?.name?.split(" ")[0] ?? "", me?.email.split("@")[0] ?? ""]
    .map(fold)
    .filter(Boolean);

export function homeInboxLists({
  data,
  hidden: hiddenKeys,
  me,
  lang,
  t,
}: {
  data: InboxResult;
  /** Resolved in the app, not yet sent (the Undo window): `${book_id}/${ref}`. */
  hidden: readonly string[];
  me: MeResult | null;
  lang: "pt" | "en";
  t: (pt: string, vars?: CopyVars) => string;
}): Record<HomeInboxTab, HomeInboxCard[]> {
  const model = roomInboxModel(data, "", true);
  const hidden = new Set(hiddenKeys);
  const visible = (wait?: Wait) =>
    !wait || !hidden.has(`${wait.book_id}/${wait.ref}`);
  /** A held @mention (no wait) and an open task leave the list the same way, by their own key. */
  const shownMessage = (message: RoomInboxMessage) =>
    visible(message.wait) &&
    (!message.mention ||
      !hidden.has(`${message.mention.book_id}/d${message.mention.msg_id}`));
  const summaries = new Map((me?.books ?? []).map((room) => [room.id, room]));
  const roomName = (book: string, room: string) =>
    roomLabel(me, book, room, lang);
  const fromMessage = (message: RoomInboxMessage): HomeInboxCard => ({
    key: message.key,
    kind: message.kind,
    book: message.book,
    room: roomName(message.book, message.room),
    thread: message.thread,
    where: message.topic || "",
    author: message.author,
    authorName: message.authorName,
    text: message.text,
    about: message.kind === "reply" ? (message.wait?.about ?? "") : "",
    ts: message.ts,
    wait: message.wait,
    message,
    summary: summaries.get(message.book),
    choices:
      message.kind === "claude" && message.wait?.ref.startsWith("a")
        ? choicesOf(message.wait.about)
        : null,
  });
  const newest = (left: HomeInboxCard, right: HomeInboxCard) =>
    right.ts - left.ts;
  // Your open threads (e<epic>): all of them in Tarefas; in Pra você only the ones ready to close or that @vibe
  // called you about, so many open threads don't bury the asks.
  const threads = model.threads
    .filter(visible)
    .flatMap((wait): HomeInboxCard[] => {
      const open = threadWait(wait);
      return open
        ? [
            {
              key: `e:${wait.book_id}:${wait.ref}`,
              kind: "thread",
              book: wait.book_id,
              room: roomName(wait.book_id, wait.room),
              thread: wait.thread,
              where: open.total
                ? t("{done}/{total} tarefas", {
                    done: open.done,
                    total: open.total,
                  })
                : t("Sem tarefas"),
              author: wait.author,
              authorName: null,
              text: wait.topic || "",
              about: "",
              ts: wait.ts,
              wait,
              summary: summaries.get(wait.book_id),
              open,
            },
          ]
        : [];
    });
  // Pra você: asks and mentions, answers to your Home requests, your Claude's
  // questions and your tasks in review, in one feed.
  const feed = [
    ...model.messages.filter(shownMessage).map(fromMessage),
    ...model.oks.filter(visible).map((wait): HomeInboxCard => ({
      key: `w:${wait.book_id}:${wait.ref}`,
      kind: "review",
      book: wait.book_id,
      room: roomName(wait.book_id, wait.room),
      thread: wait.thread,
      where: wait.topic || "",
      author: wait.author,
      authorName: wait.author_name,
      text: wait.text,
      about: "",
      ts: wait.ts,
      wait,
      summary: summaries.get(wait.book_id),
    })),
    ...threads.filter((card) => card.open?.ready || card.open?.stale),
  ].sort(newest);
  // Menções: the held @mentions, and asks whose text @s you by name.
  const handles = homeInboxHandles(me);
  const atsMe = (text: string) =>
    mentionSegments(text, () => true).some(
      (part) => part.mention && handles.includes(fold(part.text.slice(1))),
    );
  const mentions = feed.filter(
    (card) =>
      card.kind === "mention" || (card.kind === "ask" && atsMe(card.text)),
  );
  // Tarefas: your open threads, then your open tasks (the ones in review are in Pra você).
  const tasks = [
    ...threads,
    ...model.groups.flatMap((group) =>
      group.tasks
        .filter((task) => !hidden.has(`${task.book_id}/t${task.task_id}`))
        .map((task): HomeInboxCard => ({
          key: `t:${task.book_id}:${task.task_id}`,
          kind: "task",
          book: task.book_id,
          room: roomName(task.book_id, task.room),
          thread: task.epic_id,
          where: group.epic || "",
          author: "",
          authorName: null,
          text: task.title,
          about: "",
          ts: 0,
          task,
          summary: summaries.get(task.book_id),
        })),
    ),
  ];
  return { foryou: feed, mentions, tasks };
}

/** Your own Claude: a/b waits, and an answer posted by your agent (its author is you). */
export const homeInboxYourClaude = (card: HomeInboxCard, me: MeResult | null) =>
  card.kind === "claude" ||
  (card.kind === "reply" && card.author === me?.email);
/** Who the item is from, as its row names them. */
export const homeInboxWho = (
  card: HomeInboxCard,
  me: MeResult | null,
  t: (pt: string, vars?: CopyVars) => string,
) =>
  homeInboxYourClaude(card, me)
    ? t("Seu Claude")
    : card.kind === "review"
      ? t("Sua tarefa")
      : card.author === "ai"
        ? "@vibe"
        : card.authorName ||
          (me?.email === card.author
            ? me.name
            : me?.friends.find((friend) => friend.email === card.author)
                ?.name) ||
          card.author.split("@")[0] ||
          "";
/** Your Claude's wait without its opener ("⏸ Seu Claude pede permissão: …"): the row's name says who. */
export const homeInboxSaid = (card: HomeInboxCard) =>
  card.kind === "claude"
    ? card.text
        .replace(
          /^(⏸|❓) (Seu Claude|Seu agent|Your agent)( (pede permissão|quer seguir com este plano|espera você no terminal|is waiting for you in the terminal):| pergunta( · \*\*[^*\n]*\*\*)?:?)\s*/,
          "",
        )
        .trim() || card.text
    : card.text;
/** "Abrir na sala": the item's room, at its message or thread (the Inbox closes as you leave). */
export function homeInboxLeave(
  owner: ApplicationInbox,
  binding: InboxBinding,
  card: HomeInboxCard,
  navigate: (target: RoomTarget) => void,
) {
  switch (card.kind) {
    case "task":
      if (card.task) owner.openTask(binding, card.task);
      return;
    case "thread":
      navigate({ roomId: card.book, thread: card.thread });
      return;
    case "room":
      owner.openRoom(binding, card.book);
      return;
    case "ask":
    case "claude":
    case "review":
    case "reply":
    case "mention":
      if (card.wait) owner.openWait(binding, card.wait);
      else if (card.message?.mention)
        owner.openMention(binding, card.message.mention);
      return;
    default: {
      const never: never = card.kind;
      return never;
    }
  }
}
