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
  import { mentionSegments } from "../composer/model";
  import { mountCube } from "../home/cube";
  import HomeAsk from "../home/HomeAsk.svelte";
  import {
    fold,
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
  import {
    inboxAsks,
    inboxPreview,
    roomInboxModel,
    type RoomInboxMessage,
  } from "./roomInboxModel";
  /**
   * The desktop Home: the agent's cube, one line and the ask box always on
   * top (what you type goes to the right room and thread); under them one
   * Inbox in four tabs. "Pra você": one feed, newest first, of everything that
   * needs you: asks and @mentions, your tasks in review, your Claude's
   * questions, and answers to what you sent from the ask box (waits r<msg>).
   * "Menções": every @ of you the app holds. "Não lidas": one card per room
   * with messages you haven't read. "Tarefas": your open tasks. Every item is
   * a card: "Room › Thread" and the time on top (open), ↩ reply in place and
   * ✓ done on the right, who wrote and what below. Phones keep RoomInbox.
   * Keys: j/k move, r reply, o open, e done, x select, ? shows them.
   */
  let {
    owner,
    binding,
    services,
  }: {
    owner: ApplicationInbox;
    binding: InboxBinding;
    services: BrowserApplicationServices;
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
    about: message.wait?.about ?? "",
    ts: message.ts,
    wait: message.wait,
    message,
    summary: summaries.get(message.book),
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
  const order = $derived(lists[tab]);
  const tabs: { id: Tab; label: string }[] = [
    { id: "foryou", label: "Pra você" },
    { id: "mentions", label: "Menções" },
    { id: "unread", label: "Não lidas" },
    { id: "tasks", label: "Tarefas" },
  ];
  const waiting = $derived(feed.length);
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
      editable(event.target)
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
    const index = order.findIndex((card) => card.key === cursor),
      card = order[index];
    const move = (to: number) => {
      const next = order[Math.max(0, Math.min(order.length - 1, to))];
      if (!next) return;
      cursor = next.key;
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
    else if (event.key === "o" || event.key === "Enter") {
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
  class="relative flex min-h-0 min-w-0 flex-1 flex-col bg-background font-sans text-foreground"
>
  <div class="min-h-0 flex-1 overflow-auto">
    <div
      class="mx-auto flex w-full max-w-[720px] flex-col gap-10 px-8 pt-14 pb-24"
    >
      <!-- The hero: the cube, one line, the ask box. Always here. -->
      <header data-home-hero class="flex flex-col items-center gap-5">
        <canvas
          bind:this={cube}
          width="384"
          height="384"
          aria-hidden="true"
          class="size-24 shrink-0"
        ></canvas>
        <h1
          data-home-hero-line
          class="m-0 text-center text-2xl font-medium tracking-tight text-balance"
        >
          {#if waiting}{waiting === 1
              ? t("1 coisa espera você")
              : t("{n} coisas esperam você", { n: waiting })}{:else}{first
              ? t("Tudo em dia, {name}.", { name: first })
              : t("Tudo em dia.")}
            <span class="text-muted-foreground"
              >{t("O que vamos fazer agora?")}</span
            >{/if}
        </h1>
        <div data-home-ask="inbox" class="w-full">
          <HomeAsk
            personal={services.personal}
            {lang}
            onnavigate={(target) => services.actions.navigate(target)}
            onnew={(trigger) => services.navigation.openCreate(trigger)}
            onsearch={() => services.navigation.openSearch()}
          />
        </div>
      </header>

      <div class="flex flex-col gap-4">
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
                  "-mb-px flex h-10 cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-3 font-sans text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
              )}><Icon icon="dots-horizontal" size={15} /></DropdownMenuTrigger
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
            class="grid gap-3"
          >
            {#each [0, 1, 2] as index (index)}<div
                class="grid gap-3 rounded-xl border border-border p-4"
              >
                <Skeleton class="h-3.5 w-2/5" />
                <div class="grid grid-cols-[32px_minmax(0,1fr)] gap-3">
                  <Skeleton class="size-8 rounded-full" />
                  <Skeleton
                    class={cn("h-3.5", index % 2 ? "w-3/4" : "w-11/12")}
                  />
                </div>
              </div>{/each}
          </div>
        {:else if tab === "tasks"}{#if tasks.length}<div
              data-home-tasks
              role="tabpanel"
              class="grid"
            >
              {#each tasks as item (item.task ?? item.key)}{@render taskRow(
                  item,
                )}{/each}
            </div>{:else}{@render empty(t("Nenhuma tarefa aberta."))}{/if}
        {:else if order.length}<div
            data-home-feed={tab}
            role="tabpanel"
            class="grid gap-3"
          >
            {#each order as item (item.wait ?? item.message?.mention ?? item.key)}{@render card(
                item,
              )}{/each}
          </div>
        {:else if !$inbox.error}{@render empty(
            tab === "foryou"
              ? t("Nada esperando você.")
              : tab === "mentions"
                ? t("Nenhuma menção.")
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
      {t("j/k mover · r responder · o abrir · e resolver · x selecionar")}
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
</section>

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

<!-- One card: where and when on top (open), ↩ and ✓ on the right; who and what below. -->
{#snippet card(item: Card)}<div
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
            data-home-card
            data-kind={row.kind}
            aria-current={cursor === row.key || undefined}
            class={cn(
              "relative grid rounded-xl border border-border bg-background transition-colors duration-150",
              cursor === row.key && "bg-muted",
            )}
          >
            <div class="flex items-center gap-2 pt-2 pr-2 pl-2">
              <button
                type="button"
                data-inbox-open
                class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left font-sans text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onclick={(event) => {
                  if (live(event)) {
                    cursor = row.key;
                    open(row);
                  }
                }}
              >
                <RoomAvatar
                  title={row.room}
                  icon={row.summary ? roomIcon(row.summary) : null}
                  {lang}
                  size="2xs"
                  surface="background"
                />
                <span class="min-w-0 truncate"
                  ><span class="font-medium text-foreground">{row.room}</span
                  >{#if row.where}<span class="px-1">›</span
                    >{row.where}{/if}</span
                >
                {#if row.kind === "room" && row.news}<span
                    data-home-room-news
                    class="shrink-0 text-muted-foreground tabular-nums"
                    >· {row.news === 1
                      ? t("1 nova")
                      : t("{n} novas", { n: row.news })}</span
                  >{/if}
                {#if row.ts}<span class="shrink-0 tabular-nums"
                    >· {since(row.ts)}</span
                  >{/if}
              </button>
              <div
                data-inbox-actions
                class="flex shrink-0 items-center gap-0.5"
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
                    label={t(
                      row.kind === "room" ? "Marcar como lida" : "Feito",
                    )}
                    size="icon-sm"
                    tooltipSide="bottom"
                    onclick={(event) => {
                      if (live(event)) done([row]);
                    }}><Icon icon="check" size={15} /></IconButton
                  >{/if}{#if row.kind === "claude" || row.kind === "review"}<IconButton
                    label={t(
                      row.kind === "claude" ? "Ir pro agent" : "Abrir tarefa",
                    )}
                    size="icon-sm"
                    tooltipSide="bottom"
                    onclick={(event) => {
                      if (live(event)) open(row);
                    }}
                    ><Icon
                      icon={row.kind === "claude"
                        ? "app-agents"
                        : "link-external-01"}
                      size={15}
                    /></IconButton
                  >{/if}
              </div>
            </div>
            <button
              type="button"
              class="grid cursor-pointer gap-2 border-0 bg-transparent px-4 pt-2 pb-4 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-b-xl"
              onclick={(event) => {
                if (live(event)) {
                  cursor = row.key;
                  open(row);
                }
              }}
            >
              {#if row.kind === "reply" && row.about}<span
                  data-home-asked
                  class="line-clamp-1 text-sm text-muted-foreground"
                  ><span class="font-medium">{t("Você pediu:")}</span>
                  {inboxPreview(row.about)}</span
                >{/if}
              <span class="flex min-w-0 items-start gap-3">
                {#if yourClaude(row)}<AgentMark
                    class="mt-0.5 text-sm"
                  />{:else if row.kind === "review"}<span
                    class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                    ><Icon icon="check-circle" size={15} /></span
                  >{:else if row.author === "ai"}<AgentMark
                    mark="✦"
                    class="mt-0.5 text-sm text-foreground"
                  />{:else if row.author}<PersonAvatar
                    data-avatar="person"
                    size="sm"
                    class="mt-0.5"
                    email={row.author}
                    version={avatar(row.author)}
                  />{/if}
                <span class="grid min-w-0 flex-1 gap-0.5">
                  <strong class="text-sm font-medium">{name(row)}</strong>
                  <span
                    data-home-card-text
                    class="line-clamp-3 text-sm leading-6 break-words"
                    >{@render rich(row.text)}</span
                  >
                </span>
              </span>
            </button>
            {#if row.kind === "ask" && selected[row.key]}<span
                class="pointer-events-none absolute top-3 left-0 h-[calc(100%-1.5rem)] w-0.5 rounded-full bg-foreground"
              ></span>{/if}
            {#if replying === row.key}<form
                data-inbox-reply={row.key}
                class="grid animate-in gap-2 border-t border-border px-4 pt-3 pb-4 duration-150 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:-0.25rem] motion-reduce:animate-none"
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

<!-- One of your open tasks: its title, where it lives, its status. -->
{#snippet taskRow(item: Card)}<div data-inbox-row={item.key}>
    <Snapshot value={item}
      >{#snippet children(row)}<button
          type="button"
          data-room-inbox-message
          data-kind="task"
          aria-current={cursor === row.key || undefined}
          class={cn(
            "flex h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left font-sans text-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            cursor === row.key && "bg-muted",
          )}
          onclick={(event) => {
            if (live(event)) {
              cursor = row.key;
              open(row);
            }
          }}
        >
          <span class="min-w-0 flex-1 truncate text-sm">{row.text}</span>
          <span
            class="max-w-[40%] min-w-0 shrink truncate text-xs text-muted-foreground"
            >{row.room}{row.where ? ` › ${row.where}` : ""}</span
          >
          {#if row.task?.due}<span
              class="shrink-0 text-xs text-muted-foreground tabular-nums"
              >{row.task.due}</span
            >{/if}
          <span
            data-home-task-status={row.task?.status}
            class={cn(
              "shrink-0 rounded-md px-2 text-[11px] leading-5 font-medium",
              row.task?.status === "doing"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground",
            )}>{t(statusLabel(row.task?.status ?? ""))}</span
          >
        </button>{/snippet}</Snapshot
    >
  </div>{/snippet}
