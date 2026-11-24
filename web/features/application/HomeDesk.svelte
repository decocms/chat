<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import ErrorState from "../../lib/components/ErrorState.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { InboxTask, Wait } from "../../app/types";
  import { choicesOf, type Choices } from "../chat-interactive/eligibility";
  import { mentionSegments } from "../composer/model";
  import { mountCube } from "../home/cube";
  import HomeAsk from "../home/HomeAsk.svelte";
  import type { ComposerDrafts } from "../composer/drafts";
  import {
    fold,
    messageIdentity,
    personVersion,
    roomIcon,
    roomLabel,
    roomsOnly,
    unread,
    type RoomSummary,
  } from "../home/model";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import type { BrowserApplicationServices } from "./browser";
  import type { ApplicationInbox, InboxBinding } from "./inbox";
  import InboxThread from "./InboxThread.svelte";
  import {
    inboxAsks,
    inboxPreview,
    roomInboxModel,
    type RoomInboxMessage,
  } from "./roomInboxModel";
  /**
   * The desktop Home: the agent's cube and the ask box on top (what you type
   * goes to the right room and thread; the line "Tudo em dia" only when
   * nothing waits, the red count on "Pra você" says the rest); under them one
   * Inbox in four tabs. "Pra você": everything that needs you (asks and
   * @mentions, your tasks in review, your Claude's questions, answers to what
   * you sent from the box), grouped by room, rooms ordered by their newest
   * item. "Menções": every @ of you. "Não lidas": one row per room with news.
   * "Tarefas": your open tasks, by room. Every item is a two-line row: who ·
   * thread · when, then the message; ↩ reply, ✓ done and open show on hover
   * or focus, and a click opens it. Your Claude's question answers with its
   * own buttons, a task in review with "Aprovar". A dot marks what came after
   * your last visit. Phones keep RoomInbox.
   * A click selects an item and opens its thread beside the list (the
   * reading pane, InboxThread: the room's own chat and composer), without
   * leaving the Home; "Abrir na sala" there leaves for the room. A reply or a
   * reaction in the pane clears the item and the next one opens.
   * Keys: j/k move, Enter opens / types in the pane, Esc closes it, r reply,
   * o open in the room, e done, x select, ? shows them.
   */
  let {
    owner,
    binding,
    services,
    drafts,
  }: {
    owner: ApplicationInbox;
    binding: InboxBinding;
    services: BrowserApplicationServices;
    drafts: ComposerDrafts;
  } = $props();
  const opening = untrack(() => binding),
    inbox = untrack(() => owner.state),
    personal = untrack(() => services.personal.state),
    t = untrack(() => services.t);
  const lang = $derived(services.language === "en" ? "en" : "pt");

  type Tab = "foryou" | "mentions" | "unread" | "tasks";
  type Kind =
    "ask" | "mention" | "claude" | "review" | "reply" | "room" | "task";
  type Card = {
    key: string;
    kind: Kind;
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
  };
  type Group = {
    key: string;
    book: string;
    room: string;
    summary?: RoomSummary;
    items: Card[];
  };

  let tab = $state<Tab>("foryou");
  const model = $derived(roomInboxModel($inbox.data, "", true));
  const hidden = $derived(new Set($inbox.hidden));
  const visible = (wait?: Wait) =>
    !wait || !hidden.has(`${wait.book_id}/${wait.ref}`);
  const summaries = $derived(
    new Map(($personal.me?.books ?? []).map((room) => [room.id, room])),
  );
  const roomName = (book: string, room: string) =>
    roomLabel($personal.me, book, room, lang);
  const fromMessage = (message: RoomInboxMessage): Card => ({
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
  const newest = (left: Card, right: Card) => right.ts - left.ts;
  // Pra você: asks and mentions, answers to your Home requests, your Claude's
  // questions and your tasks in review, in one feed.
  const feed = $derived(
    [
      ...model.messages
        .filter((message) => visible(message.wait))
        .map(fromMessage),
      ...model.oks.filter(visible).map((wait): Card => ({
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
    ].sort(newest),
  );
  // Menções: the held @mentions, and asks whose text @s you by name.
  const handles = $derived(
    [
      $personal.me?.name?.split(" ")[0] ?? "",
      $personal.me?.email.split("@")[0] ?? "",
    ]
      .map(fold)
      .filter(Boolean),
  );
  const mine = (handle: string) => handles.includes(fold(handle));
  const atsMe = (text: string) =>
    mentionSegments(text, () => true).some(
      (part) => part.mention && mine(part.text.slice(1)),
    );
  const mentions = $derived(
    feed.filter(
      (card) =>
        card.kind === "mention" || (card.kind === "ask" && atsMe(card.text)),
    ),
  );
  // Não lidas: rooms someone wrote in since you last looked (the rail's dot).
  const rooms = $derived(
    roomsOnly($personal.me?.books ?? [])
      .filter((room) => unread(room, $personal.seen[room.id] ?? 0))
      .map((room): Card => ({
        key: `r:${room.id}`,
        kind: "room",
        book: room.id,
        room: room.title ?? "deco.chat",
        thread: "main",
        where: "",
        author: room.last_by ?? "",
        authorName: room.last_by_name ?? null,
        text: room.last_text ?? "",
        about: "",
        ts: room.updated_at ?? 0,
        summary: room,
        news: Math.max(
          1,
          Math.max(room.last_human_id, room.last_agent_id) -
            Math.max(room.read_id, $personal.seen[room.id] ?? 0),
        ),
      }))
      .sort(newest),
  );
  // Tarefas: your open tasks (the ones in review are in Pra você).
  const tasks = $derived(
    model.groups.flatMap((group) =>
      group.tasks.map((task): Card => ({
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
  );
  const lists = $derived({
    foryou: feed,
    mentions,
    unread: rooms,
    tasks,
  } satisfies Record<Tab, Card[]>);
  // A tab's items under their room: rooms ordered by their newest item, items newest first.
  // "Não lidas" is one row per room already: no headers.
  const groups = $derived.by(() => {
    const byRoom = new Map<string, Group>();
    for (const card of lists[tab]) {
      const key = tab === "unread" ? card.key : card.book;
      let group = byRoom.get(key);
      if (!group) {
        group = {
          key,
          book: card.book,
          room: card.room,
          summary: card.summary,
          items: [],
        };
        byRoom.set(key, group);
      }
      group.items.push(card);
    }
    return [...byRoom.values()];
  });
  const order = $derived(groups.flatMap((group) => group.items));
  const tabs: { id: Tab; label: string }[] = [
    { id: "foryou", label: "Pra você" },
    { id: "mentions", label: "Menções" },
    { id: "unread", label: "Não lidas" },
    { id: "tasks", label: "Tarefas" },
  ];
  const waiting = $derived(feed.length);
  // New since your last visit: the visit before this one, kept in this browser only.
  const VISIT_KEY = "vb:home-visit";
  let lastVisit = $state(Infinity);
  onMount(() => {
    try {
      lastVisit = Number(localStorage.getItem(VISIT_KEY)) || Infinity;
    } catch {
      lastVisit = Infinity;
    }
    const mark = () => {
      try {
        localStorage.setItem(VISIT_KEY, String(Date.now()));
      } catch {
        /* No storage (private window): nothing is marked new. */
      }
    };
    mark();
    return mark;
  });
  const fresh = (card: Card) => card.kind !== "task" && card.ts > lastVisit;
  const asks = $derived(inboxAsks(model.messages, $inbox.hidden));
  const first = $derived($personal.me?.name?.split(" ")[0] ?? "");
  const loading = $derived(
    !feed.length &&
      !tasks.length &&
      ($inbox.phase === "loading" || $inbox.phase === "idle"),
  );

  let cube = $state<HTMLCanvasElement | null>(null);
  $effect(() => {
    if (cube) return mountCube(cube);
  });

  // Relative time: "agora", "5 min", "2h", "3d", then the date.
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const since = (ts: number) => {
    const minutes = Math.floor((now - ts) / 60_000);
    if (minutes < 1) return t("agora");
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
    if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 60 / 24)}d`;
    return new Intl.DateTimeFormat(services.locale, {
      day: "numeric",
      month: "short",
    }).format(ts);
  };
  // Your own Claude: a/b waits, and an answer posted by your agent (its author is you).
  const yourClaude = (card: Card) =>
    card.kind === "claude" ||
    (card.kind === "reply" && card.author === $personal.me?.email);
  const name = (card: Card) =>
    yourClaude(card)
      ? t("Seu Claude")
      : card.kind === "review"
        ? t("Sua tarefa")
        : card.author === "ai"
          ? "@vibe"
          : card.authorName ||
            ($personal.me?.email === card.author
              ? $personal.me.name
              : $personal.me?.friends.find(
                  (friend) => friend.email === card.author,
                )?.name) ||
            card.author.split("@")[0] ||
            "";
  const avatar = (email: string) => personVersion($personal.me, email);
  /** Your Claude's wait without its opener ("⏸ Seu Claude pede permissão: …"): the row's name says who. */
  const said = (card: Card) =>
    card.kind === "claude"
      ? card.text
          .replace(
            /^(⏸|❓) (Seu Claude|Seu agent|Your agent)( (pede permissão|quer seguir com este plano|espera você no terminal|is waiting for you in the terminal):| pergunta( · \*\*[^*\n]*\*\*)?)\s*/,
            "",
          )
          .trim() || card.text
      : card.text;
  const statusLabel = (status: string) =>
    status === "review"
      ? "revisar"
      : status === "doing"
        ? "fazendo"
        : "a fazer";
  /** The text as the chat draws it: one line of Markdown-free text, @mentions as chips. */
  const segments = (text: string) =>
    mentionSegments(inboxPreview(text), () => true);
  const canReply = (card: Card) =>
    card.kind === "ask" ||
    card.kind === "mention" ||
    card.kind === "reply" ||
    card.kind === "room";
  const canDone = (card: Card) =>
    ((card.kind === "ask" || card.kind === "reply") && !!card.wait) ||
    card.kind === "room";

  // The current card (keyboard), the selection (asks), the inline reply.
  let cursor = $state<string | null>(null),
    selected = $state<Record<string, boolean>>({}),
    replying = $state<string | null>(null),
    draft = $state(""),
    sending = $state(false),
    replyError = $state(""),
    leaving = $state<Record<string, boolean>>({}),
    notice = $state(""),
    hints = $state(false),
    reduced = $state(false);
  const picked = $derived(
    feed.filter((card) => card.kind === "ask" && selected[card.key]),
  );
  onMount(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    reduced = query.matches;
    const change = () => (reduced = query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  });
  const exit = () => (reduced ? 0 : 200);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;
  function say(text: string) {
    notice = text;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = ""), 2400);
  }
  const current = () => owner.owns(opening);
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;

  function pick(next: Tab) {
    tab = next;
    cursor = null;
    replying = null;
    pane = null;
  }
  // The reading pane: the selected item's thread, beside the list.
  let pane = $state<string | null>(null),
    reader = $state<ReturnType<typeof InboxThread> | null>(null);
  // Where the pane was in the list: when its item leaves (answered, done), the next one takes its place.
  let paneIndex = 0;
  const paneCard = $derived(
    pane ? (order.find((card) => card.key === pane) ?? null) : null,
  );
  $effect(() => {
    const key = pane,
      list = order;
    if (!key) return;
    const index = list.findIndex((card) => card.key === key);
    if (index >= 0) {
      paneIndex = index;
      return;
    }
    const next = list[Math.min(paneIndex, list.length - 1)];
    untrack(() => {
      pane = next?.key ?? null;
      if (next) cursor = next.key;
    });
  });
  /** The thread an item opens in the pane, and the message to show. */
  function target(card: Card): {
    book: string;
    thread: string;
    focus?: number;
  } {
    switch (card.kind) {
      case "task":
        return { book: card.book, thread: card.task?.epic_id ?? card.thread };
      case "room":
        return { book: card.book, thread: "main" };
      case "ask":
      case "claude":
      case "review":
      case "reply":
      case "mention":
        return {
          book: card.book,
          thread: card.thread,
          focus:
            card.wait && /^[mabr]/.test(card.wait.ref)
              ? messageIdentity(card.wait.ref.slice(1))
              : card.message?.mention?.msg_id,
        };
      default: {
        const never: never = card.kind;
        return never;
      }
    }
  }
  function select(card: Card) {
    if (!current()) return;
    cursor = card.key;
    pane = card.key;
    if (replying !== card.key) replying = null;
  }
  function closePane() {
    pane = null;
  }
  /** A message or reaction sent in the pane: read the Inbox again (the server clears what it answered). */
  function paneChanged(card: Card) {
    if (!current()) return;
    if (card.kind === "room" && card.summary)
      services.personal.seen(
        card.book,
        Math.max(card.summary.last_human_id, card.summary.last_agent_id),
      );
    owner.changed(opening);
  }
  function open(card: Card) {
    if (!current()) return;
    switch (card.kind) {
      case "task":
        if (card.task) owner.openTask(opening, card.task);
        return;
      case "room":
        owner.openRoom(opening, card.book);
        return;
      case "ask":
      case "claude":
      case "review":
      case "reply":
      case "mention":
        if (card.wait) owner.openWait(opening, card.wait);
        else if (card.message?.mention)
          owner.openMention(opening, card.message.mention);
        return;
      default: {
        const never: never = card.kind;
        return never;
      }
    }
  }
  /** ✓: asks and answers leave with Undo (resolveLater); a room is marked read here. */
  function done(cards: Card[]) {
    if (!current()) return;
    const gone = new Set(cards.map((card) => card.key));
    const index = order.findIndex((card) => card.key === cursor);
    if (cards.some((card) => card.key === cursor))
      cursor =
        order.slice(index + 1).find((card) => !gone.has(card.key))?.key ?? null;
    for (const card of cards) delete selected[card.key];
    if (replying && gone.has(replying)) replying = null;
    const read = cards.filter((card) => card.kind === "room");
    for (const card of read)
      if (card.summary)
        services.personal.seen(
          card.book,
          Math.max(card.summary.last_human_id, card.summary.last_agent_id),
        );
    if (read.length) say(t("Marcada como lida"));
    const waits = cards.flatMap((card) =>
      (card.kind === "ask" || card.kind === "reply") && card.wait
        ? [card.wait]
        : [],
    );
    if (!waits.length) return;
    for (const card of cards) leaving[card.key] = true;
    setTimeout(() => {
      for (const card of cards) delete leaving[card.key];
      if (current()) owner.resolveLater(opening, waits);
    }, exit());
  }
  async function startReply(card: Card) {
    if (!current() || !canReply(card)) return;
    replying = card.key;
    cursor = card.key;
    draft = "";
    replyError = "";
    await tick();
    document
      .querySelector<HTMLTextAreaElement>(
        `[data-inbox-reply="${CSS.escape(card.key)}"] textarea`,
      )
      ?.focus();
  }
  async function send(card: Card) {
    if (!current() || sending || !draft.trim()) return;
    sending = true;
    replyError = "";
    const ok = await owner.reply(opening, card, draft);
    if (!current()) return;
    sending = false;
    if (!ok) {
      replyError = t("Não deu pra enviar. Tente de novo.");
      return;
    }
    replying = null;
    draft = "";
    // A reply answers the ask (and the answer to your request) on the server: the card collapses until the refresh drops it.
    if (card.kind === "ask" || card.kind === "reply") leaving[card.key] = true;
    say(t("Resposta enviada"));
  }
  // A choice of your Claude's question, "Aprovar" on a task in review: one command to the room.
  let acting = $state<Record<string, boolean>>({});
  async function choose(card: Card, value: string) {
    if (!current() || !card.wait || acting[card.key]) return;
    acting[card.key] = true;
    const ok = await owner.answer(opening, card.wait, value);
    if (!current()) return;
    delete acting[card.key];
    say(ok ? t("Resposta enviada") : t("Não deu pra enviar. Tente de novo."));
  }
  async function approve(card: Card) {
    if (!current() || !card.wait || acting[card.key]) return;
    acting[card.key] = true;
    const ok = await owner.approve(opening, card.wait);
    if (!current()) return;
    delete acting[card.key];
    say(ok ? t("Tarefa aprovada") : t("Não deu pra enviar. Tente de novo."));
  }
  const buttons = (card: Card) =>
    card.choices && !card.choices.multi && !card.choices.closed
      ? card.choices.options
      : [];
  function editable(target: EventTarget | null) {
    return (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
        !!target.closest('[role="dialog"], [role="menu"]'))
    );
  }
  function keys(event: KeyboardEvent) {
    if (
      !current() ||
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      editable(event.target) ||
      (event.target instanceof Element &&
        !!event.target.closest("[data-inbox-thread]"))
    )
      return;
    if (event.key === "?") {
      event.preventDefault();
      hints = !hints;
      return;
    }
    if (event.key === "Escape" && hints) {
      hints = false;
      return;
    }
    if (event.key === "Escape" && pane) {
      event.preventDefault();
      closePane();
      return;
    }
    const index = order.findIndex((card) => card.key === cursor),
      card = order[index];
    const move = (to: number) => {
      const next = order[Math.max(0, Math.min(order.length - 1, to))];
      if (!next) return;
      cursor = next.key;
      if (pane) pane = next.key;
      event.preventDefault();
      void tick().then(() =>
        document
          .querySelector(`[data-inbox-row="${CSS.escape(next.key)}"]`)
          ?.scrollIntoView({ block: "nearest" }),
      );
    };
    if (event.key === "j" || event.key === "ArrowDown") move(index + 1);
    else if (event.key === "k" || event.key === "ArrowUp") move(index - 1);
    else if (!card) return;
    else if (event.key === "Enter") {
      event.preventDefault();
      if (pane === card.key) reader?.focusComposer();
      else select(card);
    } else if (event.key === "o") {
      event.preventDefault();
      open(card);
    } else if (event.key === "r") {
      event.preventDefault();
      void startReply(card);
    } else if (event.key === "e") {
      event.preventDefault();
      done(picked.length ? picked : [card]);
    } else if (event.key === "x" && card.kind === "ask") {
      event.preventDefault();
      selected[card.key] = !selected[card.key];
    }
  }
</script>

<svelte:window onkeydown={keys} />

<section
  data-home-desk
  data-room-inbox
  aria-label={t("Caixa de entrada")}
  data-home-split={paneCard ? "" : undefined}
  class="relative flex min-h-0 min-w-0 flex-1 bg-background font-sans text-foreground"
>
  <div
    data-home-list
    class={cn(
      "relative flex min-h-0 flex-col",
      paneCard ? "w-[420px] shrink-0 border-r border-border" : "min-w-0 flex-1",
    )}
  >
    <div class="min-h-0 flex-1 overflow-auto">
      <div
        class={cn(
          "mx-auto flex w-full flex-col",
          paneCard
            ? "gap-3 px-2 pt-2 pb-24"
            : "max-w-[720px] gap-6 px-8 pt-10 pb-24",
        )}
      >
        <!-- The hero: the cube and the ask box. The line only at inbox zero. Hidden while a thread is open beside. -->
        {#if paneCard}{:else if waiting || loading}<header
            data-home-hero
            class="flex items-start gap-4"
          >
            <canvas
              bind:this={cube}
              width="224"
              height="224"
              aria-hidden="true"
              class="mt-0.5 size-14 shrink-0"
            ></canvas>
            <div data-home-ask="inbox" class="min-w-0 flex-1">
              {@render ask()}
            </div>
          </header>{:else}<header
            data-home-hero
            class="flex flex-col items-center gap-4 pt-4"
          >
            <canvas
              bind:this={cube}
              width="224"
              height="224"
              aria-hidden="true"
              class="size-14 shrink-0"
            ></canvas>
            <h1
              data-home-hero-line
              class="m-0 text-center text-xl font-medium tracking-tight text-balance"
            >
              {first
                ? t("Tudo em dia, {name}.", { name: first })
                : t("Tudo em dia.")}
              <span class="text-muted-foreground"
                >{t("O que vamos fazer agora?")}</span
              >
            </h1>
            <div data-home-ask="inbox" class="w-full">{@render ask()}</div>
          </header>{/if}

        <div class="flex flex-col gap-2">
          <!-- The tabs: plain text, a solid line under the open one. -->
          <div class="flex items-center gap-1 border-b border-border">
            <div role="tablist" aria-label={t("Caixa de entrada")} class="flex">
              {#each tabs as item (item.id)}{@const count =
                  lists[item.id].length}<button
                  type="button"
                  role="tab"
                  data-home-tab={item.id}
                  aria-selected={tab === item.id}
                  class={cn(
                    "-mb-px flex h-10 cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent font-sans text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    paneCard ? "px-2" : "px-3",
                    tab === item.id
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onclick={() => pick(item.id)}
                  >{t(item.label)}{#if count}{#if item.id === "foryou"}<span
                        data-home-tab-count
                        class="min-w-5 rounded-full bg-destructive px-1.5 text-center text-[11px] leading-5 font-medium text-destructive-foreground tabular-nums"
                        >{count}</span
                      >{:else}<span
                        data-home-tab-count
                        class="text-xs font-normal text-muted-foreground tabular-nums"
                        >{count}</span
                      >{/if}{/if}</button
                >{/each}
            </div>
            {#if picked.length}<span
                data-inbox-selection
                class="ml-auto flex items-center gap-1 text-xs text-muted-foreground"
                >{t("{n} selecionados", { n: picked.length })}<Button
                  size="sm"
                  variant="ghost"
                  class="h-7 px-2 text-xs"
                  onclick={(event) => {
                    if (live(event)) done(picked);
                  }}>{t("Resolver selecionados")}</Button
                ></span
              >{/if}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-home-reply-menu
                aria-label={t("Mais ações")}
                class={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "size-8 text-muted-foreground",
                  !picked.length && "ml-auto",
                )}
                ><Icon icon="dots-horizontal" size={15} /></DropdownMenuTrigger
              >
              <DropdownMenuContent align="end" class="w-56 font-sans">
                <DropdownMenuItem
                  data-inbox-resolve-all
                  disabled={!asks.length}
                  onSelect={() => {
                    if (current()) owner.resolveLater(opening, asks);
                  }}
                  ><Icon icon="check-circle" />{asks.length
                    ? t("Resolver todos os pedidos ({n})", { n: asks.length })
                    : t("Resolver todos os pedidos")}</DropdownMenuItem
                >
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {#if $inbox.error && $inbox.error !== "resolve"}<ErrorState
              title={t("Não foi possível carregar a caixa de entrada.")}
              compact
              onretry={() => {
                if (current()) void owner.refresh(opening);
              }}
              retryLabel={t("Tentar de novo")}
            />{/if}
          {#if $inbox.error === "resolve"}<ErrorState
              title={t("Não deu pra resolver agora. Tente de novo.")}
              compact
            />{/if}

          {#if loading}<div
              data-inbox-loading
              role="status"
              aria-label={t("Carregando…")}
              class="grid pt-2"
            >
              {#each [0, 1, 2, 3] as index (index)}<div
                  class="grid grid-cols-[32px_minmax(0,1fr)] gap-3 px-3 py-3"
                >
                  <Skeleton class="size-8 rounded-full" />
                  <div class="grid gap-2">
                    <Skeleton class="h-3 w-1/3" />
                    <Skeleton
                      class={cn("h-3.5", index % 2 ? "w-3/4" : "w-11/12")}
                    />
                  </div>
                </div>{/each}
            </div>
          {:else if order.length}<div
              data-home-feed={tab}
              data-home-tasks={tab === "tasks" || undefined}
              role="tabpanel"
              class="grid gap-4 pt-2"
            >
              {#each groups as group (group.key)}<div
                  data-home-group={group.book}
                  class="grid"
                >
                  {#if tab !== "unread"}<button
                      type="button"
                      data-home-group-room
                      class="flex w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-3 py-1 font-sans text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                      onclick={(event) => {
                        if (live(event) && current())
                          owner.openRoom(opening, group.book);
                      }}
                      ><RoomAvatar
                        title={group.room}
                        icon={group.summary ? roomIcon(group.summary) : null}
                        {lang}
                        size="2xs"
                        surface="background"
                      /><span class="truncate font-medium">{group.room}</span
                      ></button
                    >{/if}
                  <div class="grid divide-y divide-border">
                    {#each group.items as item (item.wait ?? item.message?.mention ?? item.task ?? item.key)}{#if item.kind === "task"}{@render taskRow(
                          item,
                        )}{:else}{@render itemRow(item)}{/if}{/each}
                  </div>
                </div>{/each}
            </div>
          {:else if !$inbox.error}{@render empty(
              tab === "foryou"
                ? t("Nada esperando você.")
                : tab === "mentions"
                  ? t("Nenhuma menção.")
                  : tab === "tasks"
                    ? t("Nenhuma tarefa aberta.")
                    : t("Nada novo nas suas salas."),
              tab === "foryou"
                ? t(
                    "Mande algo na caixa acima. Quando alguém precisar de você, aparece aqui.",
                  )
                : "",
            )}{/if}
        </div>
      </div>
    </div>

    {#if hints}<p
        data-home-hints
        class="m-0 animate-in border-t border-border px-4 py-2 text-center text-xs text-muted-foreground duration-150 ease-out [--tw-enter-opacity:0] motion-reduce:animate-none"
      >
        {t(
          "j/k mover · Enter abrir · Esc fechar · r responder · o abrir na sala · e resolver",
        )}
      </p>{/if}
    {#if !$inbox.undo && notice}<div
        data-inbox-notice
        role="status"
        class="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 animate-in items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-lg duration-200 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:0.5rem] motion-reduce:animate-none"
      >
        <Icon icon="check-circle" size={14} />{notice}
      </div>{/if}
    {#if $inbox.undo}<div
        data-inbox-undo
        role="status"
        class="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 animate-in items-center gap-3 rounded-lg bg-foreground py-2 pr-2 pl-4 text-sm text-background shadow-lg duration-200 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:0.5rem] motion-reduce:animate-none"
      >
        <Icon icon="check-circle" size={14} />
        <span
          >{$inbox.undo === 1
            ? t("1 pedido resolvido")
            : t("{n} pedidos resolvidos", { n: $inbox.undo })}</span
        ><Button
          size="sm"
          variant="ghost"
          class="h-7 text-background hover:bg-background/15 hover:text-background"
          onclick={(event) => {
            if (live(event)) owner.undo(opening);
          }}>{t("Desfazer")}</Button
        >
      </div>{/if}
  </div>
  {#if paneCard}{@const where =
      target(paneCard)}{#key `${where.book}\n${where.thread}`}<div
        data-home-pane
        class="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <InboxThread
          bind:this={reader}
          {services}
          {drafts}
          book={where.book}
          thread={where.thread}
          focus={where.focus}
          title={paneCard.room}
          onchanged={() => {
            if (paneCard) paneChanged(paneCard);
          }}
          onopen={() => {
            if (paneCard) open(paneCard);
          }}
          onclose={closePane}
        />
      </div>{/key}{/if}
</section>

{#snippet ask()}<HomeAsk
    personal={services.personal}
    {lang}
    onnavigate={(target) => services.actions.navigate(target)}
    onnew={(trigger) => services.navigation.openCreate(trigger)}
    onsearch={() => services.navigation.openSearch()}
  />{/snippet}

{#snippet empty(title: string, detail = "")}<div
    data-home-empty
    class="flex flex-col items-center gap-1 px-6 py-14 text-center"
  >
    <p class="m-0 text-sm font-medium">{title}</p>
    {#if detail}<p class="m-0 max-w-80 text-sm text-muted-foreground">
        {detail}
      </p>{/if}
  </div>{/snippet}

<!-- A message as the chat draws it: plain text with @mentions as the purple chip. -->
{#snippet rich(
  text: string,
)}{#each segments(text) as part, index (index)}{#if part.mention}<span
        data-rich-mention
        class={mine(part.text.slice(1))
          ? "rounded-sm bg-brand-purple/25 px-1 font-semibold text-brand-purple-text"
          : "rounded-sm bg-brand-purple/12 px-1 font-medium text-brand-purple-text"}
        >{part.text}</span
      >{:else}{part.text}{/if}{/each}{/snippet}

<!-- Who wrote it: a person, @vibe, your Claude's tile, a task, a room. -->
{#snippet face(row: Card)}{#if yourClaude(row)}<AgentMark
      tint
      size="sm"
    />{:else if row.kind === "review" || row.kind === "task"}<span
      class="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
      ><Icon icon="check-circle" size={15} /></span
    >{:else if row.kind === "room"}<RoomAvatar
      title={row.room}
      icon={row.summary ? roomIcon(row.summary) : null}
      {lang}
      size="sm"
      surface="background"
    />{:else if row.author === "ai"}<AgentMark
      mark="✦"
      size="sm"
      class="text-foreground"
    />{:else if row.author}<PersonAvatar
      data-avatar="person"
      size="sm"
      email={row.author}
      version={avatar(row.author)}
    />{:else}<span class="size-8 shrink-0"></span>{/if}{/snippet}

<!-- One row: who · thread · when, then the message (2 lines). Click opens it; ↩ ✓ ↗ on hover or focus. -->
{#snippet itemRow(item: Card)}<div
    data-inbox-row={item.key}
    data-leaving={leaving[item.key] || undefined}
    class={cn(
      "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
      leaving[item.key]
        ? "pointer-events-none grid-rows-[0fr] opacity-0"
        : "grid-rows-[1fr] opacity-100",
    )}
  >
    <div class="min-h-0 overflow-hidden">
      <Snapshot value={item}
        >{#snippet children(row)}<article
            data-room-inbox-message
            data-home-row
            data-kind={row.kind}
            data-fresh={fresh(row) || undefined}
            aria-current={cursor === row.key || undefined}
            class={cn(
              "group relative my-0.5 rounded-lg transition-colors duration-150 hover:bg-muted",
              cursor === row.key && "bg-muted",
            )}
          >
            {#if fresh(row)}<span
                data-home-fresh
                aria-hidden="true"
                class="pointer-events-none absolute top-[22px] left-1 size-1.5 rounded-full bg-foreground"
              ></span>{/if}
            {#if row.kind === "ask" && selected[row.key]}<span
                class="pointer-events-none absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-foreground"
              ></span>{/if}
            <button
              type="button"
              data-inbox-open
              class="flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              onclick={(event) => {
                if (live(event)) select(row);
              }}
            >
              {@render face(row)}
              <span class="grid min-w-0 flex-1 gap-0.5">
                <span
                  data-home-row-meta
                  class="flex min-w-0 items-baseline gap-1 pr-24 text-[13px] leading-5 text-muted-foreground"
                >
                  <strong class="shrink-0 font-medium text-foreground"
                    >{row.kind === "room" ? row.room : name(row)}</strong
                  >
                  {#if row.kind === "room" && row.news}<span
                      data-home-room-news
                      class="shrink-0 tabular-nums"
                      >· {row.news === 1
                        ? t("1 nova")
                        : t("{n} novas", { n: row.news })}</span
                    >{:else if row.where}<span class="min-w-0 truncate"
                      >· {row.where}</span
                    >{/if}
                  {#if row.ts}<span class="shrink-0 tabular-nums"
                      >· {since(row.ts)}</span
                    >{/if}
                </span>
                {#if row.kind === "reply" && row.about}<span
                    data-home-asked
                    class="line-clamp-1 text-[13px] leading-5 text-muted-foreground"
                    >↪ {t("você pediu:")} {inboxPreview(row.about)}</span
                  >{/if}
                <span
                  data-home-card-text
                  class="line-clamp-2 text-sm leading-5 break-words"
                  >{#if row.kind === "room" && row.authorName}<span
                      class="text-muted-foreground">{row.authorName}:</span
                    >
                  {/if}{@render rich(said(row))}</span
                >
              </span>
            </button>
            {#if buttons(row).length || (row.kind === "review" && row.wait)}<div
                data-home-row-choices
                class="flex flex-wrap gap-1.5 pr-3 pb-2.5 pl-[56px]"
              >
                {#if row.kind === "review"}<Button
                    data-home-approve
                    size="sm"
                    variant="outline"
                    class="h-7 px-3 text-xs"
                    disabled={!!acting[row.key]}
                    onclick={(event) => {
                      if (live(event)) void approve(row);
                    }}><Icon icon="check" size={13} />{t("Aprovar")}</Button
                  >{:else}{#each buttons(row) as option (option)}<Button
                      data-home-choice={option}
                      size="sm"
                      variant="outline"
                      class="h-7 max-w-full px-3 text-xs"
                      disabled={!!acting[row.key]}
                      onclick={(event) => {
                        if (live(event)) void choose(row, option);
                      }}><span class="truncate">{option}</span></Button
                    >{/each}{/if}
              </div>{/if}
            <div
              data-inbox-actions
              class={cn(
                "absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-md bg-muted opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                cursor === row.key && "opacity-100",
              )}
            >
              {#if canReply(row)}<IconButton
                  data-inbox-reply-button
                  label={t("Responder")}
                  size="icon-sm"
                  tooltipSide="bottom"
                  onclick={(event) => {
                    if (live(event)) void startReply(row);
                  }}><Icon icon="reverse-left" size={15} /></IconButton
                >{/if}{#if canDone(row)}<IconButton
                  data-inbox-resolve
                  label={t(row.kind === "room" ? "Marcar como lida" : "Feito")}
                  size="icon-sm"
                  tooltipSide="bottom"
                  onclick={(event) => {
                    if (live(event)) done([row]);
                  }}><Icon icon="check" size={15} /></IconButton
                >{/if}<IconButton
                data-inbox-go
                label={t("Abrir")}
                size="icon-sm"
                tooltipSide="bottom"
                onclick={(event) => {
                  if (live(event)) select(row);
                }}><Icon icon="layout-right" size={15} /></IconButton
              >
            </div>
            {#if replying === row.key}<form
                data-inbox-reply={row.key}
                class="grid animate-in gap-2 pr-3 pb-3 pl-[56px] duration-150 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:-0.25rem] motion-reduce:animate-none"
                onsubmit={(event) => {
                  event.preventDefault();
                  if (live(event)) void send(row);
                }}
              >
                <Textarea
                  rows={2}
                  value={draft}
                  disabled={sending}
                  placeholder={row.kind === "room"
                    ? t("Responder em {topic}…", { topic: row.room })
                    : t("Responder para {name}…", { name: name(row) })}
                  aria-label={t("Responder")}
                  class="bg-background"
                  oninput={(event) => {
                    if (current()) draft = event.currentTarget.value;
                  }}
                  onkeydown={(event) => {
                    if (
                      event.key === "Enter" &&
                      (event.metaKey || event.ctrlKey)
                    ) {
                      event.preventDefault();
                      void send(row);
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      replying = null;
                    }
                  }}
                />
                <div class="flex flex-wrap items-center gap-2">
                  <Button
                    type="submit"
                    size="sm"
                    class="h-7"
                    disabled={sending || !draft.trim()}
                    aria-busy={sending || undefined}
                    >{#if sending}<Spinner size="xs" />{/if}{t(
                      sending ? "Enviando…" : "Enviar",
                    )}</Button
                  ><Button
                    size="sm"
                    variant="ghost"
                    class="h-7"
                    disabled={sending}
                    onclick={(event) => {
                      if (live(event)) replying = null;
                    }}>{t("Cancelar")}</Button
                  >
                  {#if replyError}<span
                      role="alert"
                      class="text-xs text-destructive">{replyError}</span
                    >{/if}
                </div>
              </form>{/if}
          </article>{/snippet}</Snapshot
      >
    </div>
  </div>{/snippet}

<!-- One of your open tasks, in the same row: its title, then its thread and due date; its status on the right. -->
{#snippet taskRow(item: Card)}<div data-inbox-row={item.key}>
    <Snapshot value={item}
      >{#snippet children(row)}<button
          type="button"
          data-room-inbox-message
          data-home-row
          data-kind="task"
          aria-current={cursor === row.key || undefined}
          class={cn(
            "my-0.5 flex w-full min-w-0 cursor-pointer items-start gap-3 rounded-lg border-0 bg-transparent px-3 py-2.5 text-left font-sans text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            cursor === row.key && "bg-muted",
          )}
          onclick={(event) => {
            if (live(event)) select(row);
          }}
        >
          {@render face(row)}
          <span class="grid min-w-0 flex-1 gap-0.5">
            <span class="truncate text-sm leading-5 font-medium"
              >{row.text}</span
            >
            <span
              class="flex min-w-0 gap-1 text-[13px] leading-5 text-muted-foreground"
              ><span class="min-w-0 truncate"
                >{row.where || t("sala principal")}</span
              >{#if row.task?.due}<span class="shrink-0 tabular-nums"
                  >· {row.task.due}</span
                >{/if}</span
            >
          </span>
          <span
            data-home-task-status={row.task?.status}
            class={cn(
              "mt-0.5 shrink-0 rounded-md px-2 text-[11px] leading-5 font-medium",
              row.task?.status === "doing"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground",
            )}>{t(statusLabel(row.task?.status ?? ""))}</span
          >
        </button>{/snippet}</Snapshot
    >
  </div>{/snippet}
