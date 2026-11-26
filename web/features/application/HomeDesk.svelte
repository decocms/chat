<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import { get } from "svelte/store";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import VibeCube from "../home/VibeCube.svelte";
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
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { cn } from "../../lib/studio/utils";
  import { mentionSegments } from "../composer/model";
  import AskStarters from "../home/AskStarters.svelte";
  import HomeAsk from "../home/HomeAsk.svelte";
  import InboxClear from "../home/InboxClear.svelte";
  import { homeText } from "../home/copy";
  import {
    fold,
    personVersion,
    roomIcon,
    roomLabel,
    type RoomSummary,
  } from "../home/model";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { threadWaitLabel } from "../waits/model";
  import TaskWorkspace from "./TaskWorkspace.svelte";
  import { paneFocus } from "../room-layout/focus";
  import type { ComposerDrafts } from "../composer/drafts";
  import type { BrowserApplicationServices } from "./browser";
  import type { ApplicationInbox, InboxBinding } from "./inbox";
  import {
    HOME_INBOX_TABS,
    homeInboxHandles,
    homeInboxLeave,
    homeInboxLists,
    homeInboxSaid,
    homeInboxWho,
    homeInboxYourClaude,
    type HomeInboxCard,
    type HomeInboxTab,
  } from "./homeInboxLists";
  import { inboxAsks, inboxPreview, roomInboxModel } from "./roomInboxModel";
  /**
   * The desktop Home is where you work, always split: on the left the ask box
   * (what you type goes to the right room and thread) and the Inbox in four
   * tabs; on the right one item open in its workspace (TaskWorkspace: its
   * conversation, doc, tasks and files, and the composer to dispatch from).
   * The Home lands on the current tab's first item (or the one you had open,
   * kept in this browser); a tab opens its first item; when the open item
   * leaves the list, the one under it opens; ✕ / Esc close it until you choose.
   * "Pra você": everything that needs you, newest first (asks and @mentions,
   * your tasks in review, your Claude's questions, answers to what you sent
   * from the ask box). "Menções": every @ of you. "Tarefas": your open threads
   * and tasks. (No "Não lidas": a room's news without an ask is not the Inbox's, PO #5566.) Every item is the same card:
   * "Room › Thread" and the time on top, who wrote and what in the middle,
   * the actions at the bottom (Responder, Feito, your Claude's choices,
   * Aprovar). "Abrir na sala" in the workspace leaves for the room. Phones
   * keep RoomInbox.
   * Keys: j/k move, Enter / o open, Esc close, r reply, e done, x select,
   * ? shows them.
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

  type Tab = HomeInboxTab;
  type Card = HomeInboxCard;

  let tab = $state<Tab>("foryou");
  const model = $derived(roomInboxModel($inbox.data, "", true));
  const summaries = $derived(
    new Map(($personal.me?.books ?? []).map((room) => [room.id, room])),
  );
  const roomName = (book: string, room: string) =>
    roomLabel($personal.me, book, room, lang);
  // The tabs' lists: the same model a phone's home draws as chips (homeInboxLists).
  const lists = $derived(
    homeInboxLists({
      data: $inbox.data,
      hidden: $inbox.hidden,
      me: $personal.me,
      lang,
      t,
    }),
  );
  const feed = $derived(lists.foryou),
    tasks = $derived(lists.tasks);
  const handles = $derived(homeInboxHandles($personal.me));
  const mine = (handle: string) => handles.includes(fold(handle));
  const order = $derived(lists[tab]);
  const tabs = HOME_INBOX_TABS;
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
  const loading = $derived(
    !feed.length &&
      !tasks.length &&
      ($inbox.phase === "loading" || $inbox.phase === "idle"),
  );

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
  const yourClaude = (card: Card) => homeInboxYourClaude(card, $personal.me);
  const name = (card: Card) => homeInboxWho(card, $personal.me, t);
  const avatar = (email: string) => personVersion($personal.me, email);
  const said = homeInboxSaid;
  const statusLabel = (status: string) =>
    status === "review"
      ? "revisar"
      : status === "doing"
        ? "fazendo"
        : "a fazer";
  /** The text as the chat draws it: one line of Markdown-free text, @mentions as chips. */
  const segments = (text: string) =>
    mentionSegments(inboxPreview(text), () => true);
  /** Everything in the Inbox can leave it: what ✓ says on each. */
  const doneLabel = (card: Card) =>
    card.kind === "room"
      ? t("Marcar como lida")
      : card.kind === "task" || card.kind === "thread"
        ? t("Concluir")
        : t("Ciente");

  // The current card (keyboard), the selection (asks), the inline reply.
  let cursor = $state<string | null>(null),
    selected = $state<Record<string, boolean>>({}),
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
    // A tab opens its first item.
    chosen = null;
    at = 0;
    closed = false;
    sent = null;
  }
  /** The task open beside the list: one thread of one room, and the card it came from. */
  type Working = {
    key: string;
    book: string;
    thread: string;
    focus?: number;
    title: string;
    summary?: RoomSummary;
    card: Card;
  };
  const workingOf = (card: Card, thread = card.thread || "main"): Working => ({
    key: card.key,
    book: card.book,
    thread,
    focus: card.message?.messageId ?? card.message?.mention?.msg_id,
    title: card.room,
    summary: card.summary,
    card,
  });
  // The split is the Home: the list on the left, one item open on the right. With nothing chosen, the tab's
  // first item is open; when the open item leaves the list (answered, resolved), the one under it opens.
  // ✕ / Esc closes it until you choose again (the workspace says so).
  const OPEN_KEY = "vb:home-open";
  let chosen = $state<string | null>(null),
    at = $state(0),
    closed = $state(false),
    // What the ask box sent: its destination, which is no item of the list.
    sent = $state.raw<Working | null>(null),
    restored = $state(false);
  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(OPEN_KEY) ?? "null");
      if (saved && tabs.some((item) => item.id === saved.tab)) {
        tab = saved.tab;
        chosen = typeof saved.key === "string" ? saved.key : null;
      }
    } catch {
      /* No storage, or an old value: the first item of Pra você opens. */
    }
    restored = true;
  });
  // The item shown last. When it leaves the list (you answered it, or cleared it), it stays open on the right,
  // with what you just sent, until you pick another item or close it (PO #5569); only the list drops it.
  let kept = $state.raw<Card | null>(null);
  const openCard = $derived.by(() => {
    if (closed) return undefined;
    const found = chosen
      ? order.find((card) => card.key === chosen)
      : undefined;
    if (found) return found;
    if (chosen && kept?.key === chosen) return kept;
    return order[Math.min(at, order.length - 1)] ?? order[0];
  });
  /** The open item is no longer in the list: it shows, but has nothing left to act on. */
  const gone = $derived(
    !!openCard && !order.some((card) => card.key === openCard.key),
  );
  $effect(() => {
    const card = openCard,
      listed = !gone;
    if (!card || !listed) return;
    untrack(() => {
      kept = card;
      if (chosen !== card.key) chosen = card.key;
    });
  });
  const working = $derived<Working | null>(
    sent ?? (openCard ? workingOf(openCard) : null),
  );
  $effect(() => {
    const key = openCard?.key ?? null,
      shown = tab;
    if (!restored) return;
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify({ tab: shown, key }));
    } catch {
      /* No storage: nothing is remembered. */
    }
  });
  function open(card: Card) {
    if (!current()) return;
    cursor = card.key;
    chosen = card.key;
    at = Math.max(
      0,
      order.findIndex((item) => item.key === card.key),
    );
    closed = false;
    sent = null;
  }
  function close() {
    closed = true;
    sent = null;
  }
  /** What the ask box sent: its destination opens beside the list, you stay on the Home. */
  function work(target: { roomId: string; thread?: string }) {
    if (!current()) return;
    const summary = summaries.get(target.roomId);
    const thread = target.thread ?? "main";
    sent = workingOf(
      {
        key: `x:${target.roomId}:${thread}`,
        kind: "room",
        book: target.roomId,
        room: roomName(target.roomId, summary?.title ?? ""),
        thread,
        where: "",
        author: "",
        authorName: null,
        text: "",
        about: "",
        ts: 0,
        summary,
      },
      thread,
    );
  }
  /** A starter of the Inbox at zero: its words go into the ask box, the caret at their end. */
  function start(text: string) {
    if (!current()) return;
    services.personal.editAsk(text);
    void tick().then(() => {
      const field = document.getElementById("home-ask");
      if (!(field instanceof HTMLTextAreaElement)) return;
      field.focus();
      field.setSelectionRange(text.length, text.length);
    });
  }
  /** "Abrir na sala": leave the Home for the item in its room. */
  function leaveFor(card: Card) {
    if (!current()) return;
    homeInboxLeave(owner, opening, card, (target) =>
      services.actions.navigate(target),
    );
  }
  /** ✓ on anything: what waits on you leaves with Undo (resolveLater), a room is marked read, a task is done. */
  function done(cards: Card[]) {
    if (!current()) return;
    const gone = new Set(cards.map((card) => card.key));
    const index = order.findIndex((card) => card.key === cursor);
    if (cards.some((card) => card.key === cursor))
      cursor =
        order.slice(index + 1).find((card) => !gone.has(card.key))?.key ?? null;
    for (const card of cards) delete selected[card.key];
    const read = cards.filter((card) => card.kind === "room");
    for (const card of read)
      if (card.summary)
        services.personal.seen(
          card.book,
          Math.max(card.summary.last_human_id, card.summary.last_agent_id),
        );
    if (read.length) say(t("Marcada como lida"));
    // Your open tasks: ✓ is Concluir (the task is done in its room).
    for (const card of cards)
      if (card.kind === "task" && card.task) {
        const task = card.task;
        leaving[card.key] = true;
        void owner.completeTask(opening, task).then((ok) => {
          delete leaving[card.key];
          if (current())
            say(
              ok
                ? t("Tarefa concluída")
                : t("Não deu pra enviar. Tente de novo."),
            );
        });
      }
    // An open thread of yours: ✓ is Concluir (the thread is done in its room).
    for (const card of cards)
      if (card.kind === "thread" && card.wait) {
        const wait = card.wait;
        leaving[card.key] = true;
        void owner.completeThread(opening, wait).then((ok) => {
          delete leaving[card.key];
          if (current())
            say(
              ok
                ? t("Thread concluída")
                : t("Não deu pra enviar. Tente de novo."),
            );
        });
      }
    // Everything else that waits on you leaves with Undo: a wait, or a held @mention.
    const waits = cards.flatMap((card) =>
      card.kind !== "room" &&
      card.kind !== "task" &&
      card.kind !== "thread" &&
      card.wait
        ? [card.wait]
        : [],
    );
    const mentions = cards.flatMap((card) =>
      !card.wait && card.message?.mention ? [card.message.mention] : [],
    );
    if (!waits.length && !mentions.length) return;
    const leave = cards.filter(
      (card) =>
        card.kind !== "room" && card.kind !== "task" && card.kind !== "thread",
    );
    for (const card of leave) leaving[card.key] = true;
    setTimeout(() => {
      for (const card of leave) delete leaving[card.key];
      if (current()) owner.resolveLater(opening, waits, mentions);
    }, exit());
  }
  /** Responder: the item opens beside the list and its composer takes the keyboard. */
  let workspace = $state<ReturnType<typeof TaskWorkspace> | null>(null);
  function startReply(card: Card) {
    if (!current()) return;
    open(card);
    void tick().then(() => workspace?.focusComposer());
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
  async function reject(card: Card) {
    if (!current() || !card.wait || acting[card.key]) return;
    acting[card.key] = true;
    const ok = await owner.reject(opening, card.wait);
    if (!current()) return;
    delete acting[card.key];
    say(ok ? t("Tarefa devolvida") : t("Não deu pra enviar. Tente de novo."));
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
      editable(event.target)
    )
      return;
    // A focused action (Responder, a choice, the tabs) takes its own Enter.
    if (
      event.key === "Enter" &&
      event.target instanceof Element &&
      !!event.target.closest("button, a, [role='tab']") &&
      !event.target.closest("[data-inbox-open]")
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
    // Esc: out of the full-screen thing first, then the open item closes.
    if (event.key === "Escape" && get(paneFocus)) {
      event.preventDefault();
      paneFocus.set(false);
      return;
    }
    if (event.key === "Escape" && working) {
      event.preventDefault();
      close();
      return;
    }
    const index = order.findIndex((card) => card.key === cursor),
      card = order[index];
    const move = (to: number) => {
      const next = order[Math.max(0, Math.min(order.length - 1, to))];
      if (!next) return;
      cursor = next.key;
      event.preventDefault();
      // Focus moves with the cursor (the card's ring shows where you are).
      void tick().then(() =>
        document
          .querySelector<HTMLElement>(
            `[data-inbox-row="${CSS.escape(next.key)}"] [data-inbox-open]`,
          )
          ?.focus({ preventScroll: false }),
      );
    };
    if (event.key === "j" || event.key === "ArrowDown") move(index + 1);
    else if (event.key === "k" || event.key === "ArrowUp") move(index - 1);
    else if (!card) return;
    else if (event.key === "Enter" || event.key === "o") {
      event.preventDefault();
      open(card);
    } else if (event.key === "r") {
      event.preventDefault();
      startReply(card);
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
  class="relative flex min-h-0 min-w-0 flex-1 flex-row bg-background font-sans text-foreground"
>
  <div
    data-home-list
    class="flex min-h-0 w-[420px] shrink-0 flex-col border-r border-border"
  >
    <!-- The ask box on top of the list (16px above it, 20px under it), as high as the open item's header:
         the two rows of tabs line up. -->
    <header data-home-hero class="flex h-[92px] shrink-0 items-start px-4 pt-4">
      <div data-home-ask="inbox" class="w-full">
        <HomeAsk
          personal={services.personal}
          {lang}
          compact
          onnavigate={(target) => work(target)}
          onnew={(trigger) => services.navigation.openCreate(trigger)}
          onsearch={() => services.navigation.openSearch()}
        />
      </div>
    </header>
    <div
      class="flex h-11 shrink-0 items-stretch gap-1 border-b border-border px-4"
    >
      <div role="tablist" aria-label={t("Caixa de entrada")} class="flex">
        {#each tabs as item (item.id)}{@const count =
            lists[item.id].length}<button
            type="button"
            role="tab"
            data-home-tab={item.id}
            aria-selected={tab === item.id}
            class={cn(
              "-mb-px flex cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-3 font-sans first:pl-0 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
          class="ml-auto flex items-center gap-1 self-center text-xs text-muted-foreground"
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
            "size-8 shrink-0 self-center text-muted-foreground",
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
    <div class="min-h-0 flex-1 overflow-auto px-2 pt-3 pb-16">
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
          class="grid gap-px"
        >
          {#each [0, 1, 2, 3] as index (index)}<div
              class="grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-3 py-2.5"
            >
              <Skeleton class="size-7 rounded-full" />
              <Skeleton class="h-3.5 w-2/5 self-center" />
              <Skeleton
                class={cn("col-start-2 h-3.5", index % 2 ? "w-3/4" : "w-11/12")}
              />
            </div>{/each}
        </div>
      {:else if order.length}<div
          data-home-feed={tab}
          data-home-tasks={tab === "tasks" || undefined}
          role="tabpanel"
          class="grid gap-px"
        >
          {#each order as item (item.wait ?? item.message?.mention ?? item.task ?? item.key)}{@render row(
              item,
            )}{/each}
        </div>
      {:else if !$inbox.error}<div data-home-list-empty={tab} class="px-1">
          {#if tab === "foryou"}<AskStarters {lang} onstart={start} />{:else}<p
              class="m-0 px-3 text-sm text-muted-foreground"
            >
              {tab === "mentions"
                ? t("Nenhuma menção.")
                : t("Nenhuma tarefa aberta.")}
            </p>{/if}
        </div>
      {/if}
    </div>
  </div>
  <div
    data-home-workspace
    data-item={working?.key}
    data-gone={gone || undefined}
    class="min-h-0 min-w-0 flex-1"
  >
    {#if working}
      {#key working.key}<TaskWorkspace
          bind:this={workspace}
          {services}
          {drafts}
          book={working.book}
          thread={working.thread}
          focus={working.focus}
          title={working.title}
          summary={working.summary}
          onchanged={() => {
            if (current()) owner.changed(opening);
          }}
          onopen={() => {
            if (!working || !current()) return;
            // What the ask box sent has no Inbox item: go to its room and thread.
            if (working.key.startsWith("x:"))
              services.actions.navigate({
                roomId: working.book,
                thread: working.thread,
              });
            else leaveFor(working.card);
          }}
          onclose={close}
          itemActions={working.key.startsWith("x:") || gone
            ? undefined
            : itemActions}
        />{/key}
    {:else if !loading && !($inbox.error && !order.length)}{#if order.length}{@render empty(
          t("Escolha um item da lista."),
        )}{:else}<div
          data-home-empty
          class="flex h-full justify-center overflow-auto"
        >
          <div class="my-auto flex w-full justify-center">
            <InboxClear
              me={$personal.me}
              now={$personal.now}
              {lang}
              title={tab === "foryou"
                ? homeText(lang, "clearTitle")
                : tab === "mentions"
                  ? t("Nenhuma menção.")
                  : t("Nenhuma tarefa aberta.")}
              clear={!feed.length}
              ago={since}
              onopen={(roomId) => work({ roomId })}
            />
          </div>
        </div>{/if}{/if}
  </div>

  {#if hints}<p
      data-home-hints
      class="absolute inset-x-0 bottom-0 m-0 animate-in border-t bg-background border-border px-4 py-2 text-center text-xs text-muted-foreground duration-150 ease-out [--tw-enter-opacity:0] motion-reduce:animate-none"
    >
      {t(
        "j/k mover · Enter abrir a tarefa · Esc fechar · r responder · e resolver · x selecionar",
      )}
    </p>{/if}
  {#if !$inbox.undo && notice}<div
      data-inbox-notice
      role="status"
      class="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 animate-in items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm whitespace-nowrap text-background shadow-lg duration-200 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:0.5rem] motion-reduce:animate-none"
    >
      <Icon icon="check-circle" size={14} />{notice}
    </div>{/if}
  {#if $inbox.undo}<div
      data-inbox-undo
      role="status"
      class="absolute bottom-10 left-1/2 z-10 flex -translate-x-1/2 animate-in items-center gap-3 rounded-lg bg-foreground py-2 pr-2 pl-4 text-sm whitespace-nowrap text-background shadow-lg duration-200 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:0.5rem] motion-reduce:animate-none"
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

{#snippet empty(title: string)}<div
    data-home-empty
    class="flex h-full flex-col items-center justify-center gap-1 px-6 py-14 text-center"
  >
    <p class="m-0 text-sm font-medium">{title}</p>
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

<!-- Who wrote it: a person, @vibe, your Claude, a task (in review or open), a room. -->
{#snippet face(row: Card)}{#if row.kind === "thread"}<span
      class="grid size-7 shrink-0 place-items-center text-muted-foreground"
      ><Icon icon="message-circle-01" size={16} /></span
    >{:else if yourClaude(row)}<AgentMark
      class="text-xs"
    />{:else if row.kind === "task"}<IconButton
      data-inbox-resolve
      label={t("Concluir")}
      size="icon-xs"
      tooltipSide="right"
      class="group/done relative z-10 size-5 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground"
      onclick={(event) => {
        if (live(event)) done([row]);
      }}
      ><Icon icon="circle" size={18} class="group-hover/done:hidden" /><Icon
        icon="check-circle"
        size={18}
        class="hidden group-hover/done:block"
      /></IconButton
    >{:else if row.kind === "review"}<span
      class="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
      ><Icon icon="check-circle" size={14} /></span
    >{:else if row.kind === "room"}<RoomAvatar
      title={row.room}
      icon={row.summary ? roomIcon(row.summary) : null}
      {lang}
      size="xs"
      surface="background"
    />{:else if row.author === "ai"}<VibeCube
      class="text-xs text-foreground"
    />{:else if row.author}<PersonAvatar
      data-avatar="person"
      size="xs"
      email={row.author}
      version={avatar(row.author)}
    />{/if}{/snippet}

<!-- One item in two lines (docs/design.md › Lists): who, where and when; then what, one line, as the chat
     draws it. A click opens it beside the list; Ciente shows on the row's hover or focus (always on touch). -->
{#snippet row(item: Card)}<div
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
            data-fresh={fresh(row) || undefined}
            data-working={working?.key === row.key || undefined}
            aria-current={cursor === row.key || undefined}
            class="group relative grid grid-cols-[28px_minmax(0,1fr)] gap-x-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-muted has-[[data-inbox-open]:focus-visible]:ring-2 has-[[data-inbox-open]:focus-visible]:ring-ring data-[working]:bg-secondary-hover"
            onfocusin={() => {
              if (current()) cursor = row.key;
            }}
          >
            <span class="flex h-5 items-center">{@render face(row)}</span>
            <button
              type="button"
              data-inbox-open
              class="grid min-w-0 cursor-pointer gap-0.5 border-0 bg-transparent p-0 text-left font-sans text-foreground outline-none after:absolute after:inset-0 after:rounded-lg after:content-['']"
              onclick={(event) => {
                if (live(event)) open(row);
              }}
            >
              <span class="flex h-5 min-w-0 items-baseline gap-1.5 text-sm">
                <strong
                  class={cn(
                    "shrink-0 truncate font-medium",
                    (row.kind === "task" || row.kind === "thread") &&
                      "min-w-0 shrink",
                  )}
                  >{row.kind === "task" || row.kind === "thread"
                    ? row.text
                    : name(row)}</strong
                >
                {#if row.kind !== "task" && row.kind !== "thread"}<span
                    class="min-w-0 truncate text-xs text-muted-foreground"
                    >{row.kind === "room" && row.news
                      ? row.news === 1
                        ? t("1 nova")
                        : t("{n} novas", { n: row.news })
                      : row.where || row.room}</span
                  >{/if}
                <span
                  class="ml-auto flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground tabular-nums group-hover:invisible group-focus-within:invisible [@media(hover:none)]:invisible"
                >
                  {#if fresh(row)}<span
                      data-home-fresh
                      aria-label={t("Novo")}
                      class="size-1.5 rounded-full bg-destructive"

                    ></span>{/if}{#if row.kind === "task"}{#if row.task?.status && row.task.status !== "todo"}{t(
                        statusLabel(row.task.status),
                      )}{/if}{:else if row.kind === "thread" && row.open}{t(
                      threadWaitLabel(row.open),
                    )}{:else if row.ts}{since(row.ts)}{/if}
                </span>
              </span>
              <span
                data-home-card-text
                class={cn(
                  "line-clamp-1 leading-5 break-words text-muted-foreground",
                  row.kind === "task" || row.kind === "thread"
                    ? "text-xs"
                    : "text-sm",
                )}
                >{#if row.kind === "thread"}{row.room} · {row.where}{:else if row.kind === "task"}{row.room}{#if row.where}<span
                      class="px-1 text-subtle-foreground">›</span
                    >{row.where}{/if}{#if row.task?.due}
                    · {row.task.due}{/if}{:else}{@render rich(
                    said(row),
                  )}{/if}</span
              >
            </button>
            {#if row.kind !== "task"}<IconButton
                data-inbox-resolve
                label={doneLabel(row)}
                size="icon-xs"
                tooltipSide="left"
                class="absolute top-2 right-2 z-10 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-background [@media(hover:none)]:opacity-100"
                onclick={(event) => {
                  if (live(event)) done([row]);
                }}><Icon icon="check" size={14} /></IconButton
              >{/if}
            {#if row.kind === "ask" && selected[row.key]}<span
                data-inbox-selected
                class="pointer-events-none absolute top-2.5 bottom-2.5 left-0 w-0.5 rounded-full bg-foreground"
              ></span>{/if}
          </article>{/snippet}</Snapshot
      >
    </div>
  </div>{/snippet}

<!-- What the open item asks of you, above its composer: your task in review is approved or sent back,
     your Claude's question is answered with its buttons, an ask or a room is acknowledged (Ciente). The
     message itself is the composer under it. -->
{#snippet itemActions()}{#if working}{@const row =
      working.card}{@const choices = buttons(row)}
    {#if row.kind === "review" && row.wait}<Button
        data-home-approve
        size="sm"
        class="h-7 px-2.5 text-xs"
        disabled={!!acting[row.key]}
        onclick={(event) => {
          if (live(event)) void approve(row);
        }}><Icon icon="check" size={13} />{t("Aprovar")}</Button
      ><Button
        data-home-reject
        size="sm"
        variant="outline"
        class="h-7 px-2.5 text-xs"
        disabled={!!acting[row.key]}
        onclick={(event) => {
          if (live(event)) void reject(row);
        }}>{t("Reprovar")}</Button
      >{/if}
    {#each choices as option, index (option)}<Button
        data-home-choice={option}
        size="sm"
        variant={index ? "outline" : "default"}
        class="h-7 max-w-full px-2.5 text-xs"
        disabled={!!acting[row.key]}
        onclick={(event) => {
          if (live(event)) void choose(row, option);
        }}><span class="truncate">{option}</span></Button
      >{/each}
    <Button
      data-inbox-ack
      size="sm"
      variant="outline"
      class="h-7 px-2.5 text-xs"
      onclick={(event) => {
        if (live(event)) done([row]);
      }}><Icon icon="check" size={13} />{doneLabel(row)}</Button
    >{/if}{/snippet}
