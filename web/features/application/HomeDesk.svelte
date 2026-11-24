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
  import Progress from "../../lib/studio/Progress.svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { InboxTask, Wait } from "../../app/types";
  import { mountCube } from "../home/cube";
  import HomeAsk from "../home/HomeAsk.svelte";
  import {
    personVersion,
    roomIcon,
    roomLabel,
    roomsOnly,
    unread,
    type RoomSummary,
  } from "../home/model";
  import { EPIC_PROGRESS } from "../room-shell/shape";
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
   * top; under them the Inbox grouped by what you have to do. "Responder":
   * asks and mentions to you (reply in place, 👍, open, resolve). "Aprovar":
   * your tasks in review and your Claude's questions. "Nas suas salas": rooms
   * with messages you haven't read (the rail's own unread data). "Suas
   * tarefas": your open tasks, folded. Phones keep RoomInbox (HomeInbox).
   * Keys: j/k move, r reply, o open, e resolve, x select, ? shows them.
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

  type Section = "reply" | "approve" | "room" | "task";
  type Row = {
    key: string;
    section: Section;
    kind: "ask" | "mention" | "claude" | "review" | "room" | "task";
    book: string;
    room: string;
    thread: string;
    where: string;
    author: string;
    authorName: string | null;
    text: string;
    ts: number;
    wait?: Wait;
    message?: RoomInboxMessage;
    task?: InboxTask;
    summary?: RoomSummary;
    news?: number;
  };

  const model = $derived(roomInboxModel($inbox.data, "", true));
  const hidden = $derived(new Set($inbox.hidden));
  const visible = (wait?: Wait) =>
    !wait || !hidden.has(`${wait.book_id}/${wait.ref}`);
  const roomName = (book: string, room: string) =>
    roomLabel($personal.me, book, room, lang);
  const fromMessage = (message: RoomInboxMessage, section: Section): Row => ({
    key: message.key,
    section,
    kind: message.kind,
    book: message.book,
    room: roomName(message.book, message.room),
    thread: message.thread,
    where: message.topic || "",
    author: message.author,
    authorName: message.authorName,
    text: message.text,
    ts: message.ts,
    wait: message.wait,
    message,
  });
  const newest = (left: Row, right: Row) => right.ts - left.ts;
  // Responder: what someone asked you, and where you were @mentioned.
  const replies = $derived(
    model.messages
      .filter((message) => message.kind !== "claude" && visible(message.wait))
      .map((message) => fromMessage(message, "reply"))
      .sort(newest),
  );
  // Aprovar: your tasks waiting for your OK, and your Claude's questions.
  const approvals = $derived(
    [
      ...model.messages
        .filter((message) => message.kind === "claude" && visible(message.wait))
        .map((message) => fromMessage(message, "approve")),
      ...model.oks.filter(visible).map((wait): Row => ({
        key: `w:${wait.book_id}:${wait.ref}`,
        section: "approve",
        kind: "review",
        book: wait.book_id,
        room: roomName(wait.book_id, wait.room),
        thread: wait.thread,
        where: wait.topic || "",
        author: wait.author,
        authorName: wait.author_name,
        text: wait.text,
        ts: wait.ts,
        wait,
      })),
    ].sort(newest),
  );
  // Nas suas salas: rooms someone wrote in since you last looked (the rail's dot), newest first.
  const rooms = $derived(
    roomsOnly($personal.me?.books ?? [])
      .filter((room) => unread(room, $personal.seen[room.id] ?? 0))
      .map((room): Row => ({
        key: `r:${room.id}`,
        section: "room",
        kind: "room",
        book: room.id,
        room: room.title ?? "deco.chat",
        thread: "main",
        where: "",
        author: room.last_by ?? "",
        authorName: room.last_by_name ?? null,
        text: room.last_text ?? "",
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
  const ROOMS_SHOWN = 6;
  let allRooms = $state(false);
  const shownRooms = $derived(allRooms ? rooms : rooms.slice(0, ROOMS_SHOWN));
  // Suas tarefas: your open tasks (not the ones already in Aprovar), folded by default.
  const tasks = $derived(
    model.groups.flatMap((group) =>
      group.tasks.map((task): Row => ({
        key: `t:${task.book_id}:${task.task_id}`,
        section: "task",
        kind: "task",
        book: task.book_id,
        room: roomName(task.book_id, task.room),
        thread: task.epic_id,
        where: group.epic || "",
        author: "",
        authorName: null,
        text: task.title,
        ts: 0,
        task,
      })),
    ),
  );
  let tasksOpen = $state(false);
  const order = $derived([
    ...replies,
    ...approvals,
    ...shownRooms,
    ...(tasksOpen ? tasks : []),
  ]);
  const waiting = $derived(replies.length + approvals.length);
  const asks = $derived(inboxAsks(model.messages, $inbox.hidden));
  const first = $derived($personal.me?.name?.split(" ")[0] ?? "");
  const loading = $derived(
    !order.length &&
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
  const name = (row: Row) =>
    row.kind === "claude"
      ? t("Seu Claude")
      : row.author === "ai"
        ? "@vibe"
        : row.authorName ||
          ($personal.me?.email === row.author
            ? $personal.me.name
            : $personal.me?.friends.find(
                (friend) => friend.email === row.author,
              )?.name) ||
          row.author.split("@")[0] ||
          "";
  const avatar = (email: string) => personVersion($personal.me, email);
  // A task's bar, in the sidebar's epic style: how far along its status is.
  const progress = (status: string) =>
    status === "review" ? 85 : status === "doing" ? 50 : 0;
  const statusLabel = (status: string) =>
    status === "review"
      ? "revisar"
      : status === "doing"
        ? "fazendo"
        : "a fazer";

  // The current row (keyboard), the selection (asks), the inline reply.
  let cursor = $state<string | null>(null),
    selected = $state<Record<string, boolean>>({}),
    replying = $state<string | null>(null),
    draft = $state(""),
    sending = $state(false),
    replyError = $state(""),
    reacting = $state<string | null>(null),
    leaving = $state<Record<string, boolean>>({}),
    notice = $state(""),
    hints = $state(false),
    reduced = $state(false);
  const picked = $derived(
    replies.filter((row) => row.kind === "ask" && selected[row.key]),
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

  function open(row: Row) {
    if (!current()) return;
    switch (row.kind) {
      case "task":
        if (row.task) owner.openTask(opening, row.task);
        return;
      case "room":
        owner.openRoom(opening, row.book);
        return;
      case "ask":
      case "claude":
      case "review":
      case "mention":
        if (row.wait) owner.openWait(opening, row.wait);
        else if (row.message?.mention)
          owner.openMention(opening, row.message.mention);
        return;
      default: {
        const never: never = row.kind;
        return never;
      }
    }
  }
  function resolve(rows: Row[]) {
    if (!current()) return;
    const waits = rows.flatMap((row) =>
      row.kind === "ask" && row.wait ? [row.wait] : [],
    );
    if (!waits.length) return;
    const index = order.findIndex((row) => row.key === cursor);
    const gone = new Set(rows.map((row) => row.key));
    cursor =
      order.slice(index + 1).find((row) => !gone.has(row.key))?.key ?? null;
    for (const row of rows) delete selected[row.key];
    if (replying && gone.has(replying)) replying = null;
    for (const row of rows) leaving[row.key] = true;
    setTimeout(() => {
      for (const row of rows) delete leaving[row.key];
      if (current()) owner.resolveLater(opening, waits);
    }, exit());
  }
  async function react(row: Row) {
    if (!current() || !row.wait || reacting) return;
    reacting = row.key;
    const ok = await owner.react(opening, row.wait);
    if (!current()) return;
    reacting = null;
    say(ok ? t("Reação enviada") : t("Não deu pra reagir agora."));
  }
  async function startReply(row: Row) {
    if (!current() || (row.kind !== "ask" && row.kind !== "mention")) return;
    replying = row.key;
    cursor = row.key;
    draft = "";
    replyError = "";
    await tick();
    document
      .querySelector<HTMLTextAreaElement>(
        `[data-inbox-reply="${CSS.escape(row.key)}"] textarea`,
      )
      ?.focus();
  }
  async function send(row: Row) {
    if (!current() || sending || !draft.trim()) return;
    sending = true;
    replyError = "";
    const ok = await owner.reply(opening, row, draft);
    if (!current()) return;
    sending = false;
    if (!ok) {
      replyError = t("Não deu pra enviar. Tente de novo.");
      return;
    }
    replying = null;
    draft = "";
    // A reply answers the ask on the server: the row collapses until the refresh drops it.
    if (row.kind === "ask") leaving[row.key] = true;
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
    const index = order.findIndex((row) => row.key === cursor),
      row = order[index];
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
    else if (!row) return;
    else if (event.key === "o" || event.key === "Enter") {
      event.preventDefault();
      open(row);
    } else if (event.key === "r") {
      event.preventDefault();
      void startReply(row);
    } else if (event.key === "e") {
      event.preventDefault();
      resolve(picked.length ? picked : [row]);
    } else if (event.key === "x" && row.kind === "ask") {
      event.preventDefault();
      selected[row.key] = !selected[row.key];
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
      class="mx-auto flex w-full max-w-[720px] flex-col gap-12 px-8 pt-14 pb-24"
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
          class="grid gap-5"
        >
          {#each [0, 1, 2] as index (index)}<div
              class="grid grid-cols-[32px_minmax(0,1fr)] gap-3 px-3"
            >
              <Skeleton class="size-8 rounded-full" />
              <div class="grid gap-2">
                <Skeleton class="h-3.5 w-2/5" />
                <Skeleton
                  class={cn("h-3.5", index % 2 ? "w-3/4" : "w-11/12")}
                />
              </div>
            </div>{/each}
        </div>{/if}

      {#if replies.length}<section data-home-section="reply" class="grid gap-1">
          <div class="flex h-7 items-center gap-2 px-3">
            <h2 class="m-0 text-xs font-medium text-muted-foreground">
              {t("Responder")}
              <span class="ml-1 font-normal tabular-nums">{replies.length}</span
              >
            </h2>
            {#if picked.length}<span
                data-inbox-selection
                class="ml-2 flex items-center gap-1 text-xs text-muted-foreground"
                >{t("{n} selecionados", { n: picked.length })}<Button
                  size="sm"
                  variant="ghost"
                  class="h-6 px-2 text-xs"
                  onclick={(event) => {
                    if (live(event)) resolve(picked);
                  }}>{t("Resolver selecionados")}</Button
                ></span
              >{/if}
            <DropdownMenu>
              <DropdownMenuTrigger
                data-home-reply-menu
                aria-label={t("Mais ações")}
                class={cn(
                  buttonVariants({ variant: "ghost", size: "icon-sm" }),
                  "ml-auto size-7 text-muted-foreground",
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
          {#each replies as item (item.wait ?? item.message?.mention ?? item.key)}{@render row(
              item,
            )}{/each}
        </section>{/if}

      {#if approvals.length}<section
          data-home-section="approve"
          class="grid gap-1"
        >
          {@render label(t("Aprovar"), approvals.length)}
          {#each approvals as item (item.wait ?? item.key)}{@render row(
              item,
            )}{/each}
        </section>{/if}

      {#if rooms.length}<section data-home-section="rooms" class="grid gap-1">
          {@render label(t("Nas suas salas"), rooms.length)}
          {#each shownRooms as item (item.key)}{@render roomRow(item)}{/each}
          {#if rooms.length > ROOMS_SHOWN}<Button
              data-home-rooms-all
              variant="ghost"
              size="sm"
              class="mx-1 h-8 justify-start px-2 text-xs text-muted-foreground"
              onclick={(event) => {
                if (live(event)) allRooms = !allRooms;
              }}
              >{allRooms
                ? t("Ver menos")
                : t("Ver todas ({n})", { n: rooms.length })}</Button
            >{/if}
        </section>{/if}

      {#if tasks.length}<section data-home-section="tasks" class="grid gap-1">
          <Button
            data-home-tasks-toggle
            variant="ghost"
            aria-expanded={tasksOpen}
            class="h-7 justify-start gap-1 self-start px-3 text-xs font-medium text-muted-foreground"
            onclick={(event) => {
              if (live(event)) tasksOpen = !tasksOpen;
            }}
            >{t("Suas tarefas")}<span class="ml-1 font-normal tabular-nums"
              >{tasks.length}</span
            ><Icon
              icon="chevron-down"
              size={14}
              class={cn(
                "transition-transform duration-150 motion-reduce:transition-none",
                !tasksOpen && "-rotate-90",
              )}
            /></Button
          >
          {#if tasksOpen}<div
              class="grid animate-in gap-1 duration-150 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:-0.25rem] motion-reduce:animate-none"
            >
              {#each tasks as item (item.task ?? item.key)}{@render taskRow(
                  item,
                )}{/each}
            </div>{/if}
        </section>{/if}
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

{#snippet label(text: string, count: number)}<h2
    class="m-0 flex h-7 items-center px-3 text-xs font-medium text-muted-foreground"
  >
    {text}<span class="ml-2 font-normal tabular-nums">{count}</span>
  </h2>{/snippet}

<!-- One thing to answer or approve: who, where, when; then what they said. -->
{#snippet row(item: Row)}<div
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
            data-kind={row.kind}
            aria-current={cursor === row.key || undefined}
            class={cn(
              "group/row relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 rounded-xl transition-colors duration-150 hover:bg-muted focus-within:bg-muted",
              cursor === row.key && "bg-muted",
            )}
          >
            <Button
              variant="ghost"
              class="h-auto min-w-0 items-start justify-start gap-3 rounded-xl px-3 py-3 text-left font-normal leading-5 whitespace-normal hover:bg-transparent"
              onclick={(event) => {
                if (live(event)) {
                  cursor = row.key;
                  open(row);
                }
              }}
            >
              {#if row.kind === "claude"}<AgentMark
                  class="mt-0.5 text-sm"
                />{:else if row.kind === "review"}<span
                  class="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground group-hover/row:bg-background"
                  ><Icon icon="check-circle" size={15} /></span
                >{:else if row.author === "ai"}<AgentMark
                  mark="✦"
                  class="mt-0.5 text-sm text-foreground"
                />{:else}<PersonAvatar
                  data-avatar="person"
                  size="sm"
                  class="mt-0.5"
                  email={row.author}
                  version={avatar(row.author)}
                />{/if}
              <span class="grid min-w-0 flex-1 gap-1">
                <span
                  class="flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground"
                >
                  <strong class="shrink-0 text-sm font-medium text-foreground"
                    >{row.kind === "review"
                      ? t("Sua tarefa")
                      : name(row)}</strong
                  ><span class="min-w-0 truncate"
                    >{row.room}{row.where ? ` · ${row.where}` : ""}</span
                  >{#if row.ts}<span class="shrink-0 tabular-nums"
                      >· {since(row.ts)}</span
                    >{/if}
                </span>
                <span class="line-clamp-2 text-sm break-words"
                  >{inboxPreview(row.text)}</span
                >
              </span>
            </Button>
            <div
              data-inbox-actions
              class={cn(
                "flex items-center gap-0.5 pt-2.5 pr-2 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100",
                (cursor === row.key || replying === row.key) && "opacity-100",
              )}
            >
              {#if row.kind === "ask" || row.kind === "mention"}<IconButton
                  data-inbox-reply-button
                  label={t("Responder")}
                  size="icon-sm"
                  tooltipSide="bottom"
                  onclick={(event) => {
                    if (live(event)) void startReply(row);
                  }}><Icon icon="reverse-left" size={15} /></IconButton
                >{/if}{#if row.kind === "ask" && row.wait}<IconButton
                  data-inbox-react
                  label={t("Reagir com 👍")}
                  size="icon-sm"
                  tooltipSide="bottom"
                  aria-busy={reacting === row.key || undefined}
                  disabled={reacting !== null}
                  onclick={(event) => {
                    if (live(event)) void react(row);
                  }}
                  >{#if reacting === row.key}<Spinner size="xs" />{:else}<span
                      aria-hidden="true"
                      class="text-sm leading-none">👍</span
                    >{/if}</IconButton
                >{/if}<IconButton
                data-inbox-open
                label={t(
                  row.kind === "claude"
                    ? "Ir pro agent"
                    : row.kind === "review"
                      ? "Abrir tarefa"
                      : "Abrir mensagem",
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
              >{#if row.kind === "ask" && row.wait}<IconButton
                  data-inbox-resolve
                  label={t("Resolver")}
                  size="icon-sm"
                  tooltipSide="bottom"
                  onclick={(event) => {
                    if (live(event)) resolve([row]);
                  }}><Icon icon="check" size={15} /></IconButton
                >{/if}
            </div>
            {#if row.kind === "ask" && selected[row.key]}<span
                class="pointer-events-none absolute top-3 left-0 h-[calc(100%-1.5rem)] w-0.5 rounded-full bg-foreground"
              ></span>{/if}
            {#if replying === row.key}<form
                data-inbox-reply={row.key}
                class="col-span-2 grid animate-in gap-2 pr-3 pb-3 pl-14 duration-150 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:-0.25rem] motion-reduce:animate-none"
                onsubmit={(event) => {
                  event.preventDefault();
                  if (live(event)) void send(row);
                }}
              >
                <Textarea
                  rows={2}
                  value={draft}
                  disabled={sending}
                  placeholder={t("Responder para {name}…", { name: name(row) })}
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

<!-- A room with messages you haven't read: its tile, how many are new, the newest one. -->
{#snippet roomRow(item: Row)}<div data-inbox-row={item.key}>
    <Button
      data-home-room={item.book}
      variant="ghost"
      aria-current={cursor === item.key || undefined}
      class={cn(
        "h-auto w-full min-w-0 items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-left font-normal leading-5 whitespace-normal hover:bg-muted",
        cursor === item.key && "bg-muted",
      )}
      onclick={(event) => {
        if (live(event)) {
          cursor = item.key;
          open(item);
        }
      }}
    >
      {#if item.summary}<RoomAvatar
          title={item.room}
          icon={roomIcon(item.summary)}
          {lang}
          size="sm"
          surface="background"
        />{/if}
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="flex min-w-0 items-center gap-2">
          <strong class="min-w-0 truncate text-sm font-medium"
            >{item.room}</strong
          ><span
            data-home-room-news
            class="shrink-0 rounded-full bg-destructive px-1.5 text-[11px] leading-4 font-medium text-destructive-foreground tabular-nums"
            >{item.news === 1
              ? t("1 nova")
              : t("{n} novas", { n: item.news ?? 0 })}</span
          ><span
            class="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums"
            >{item.ts ? since(item.ts) : ""}</span
          >
        </span>
        {#if item.text}<span class="truncate text-sm text-muted-foreground"
            >{#if item.author}<span class="text-foreground"
                >{name(item).split(" ")[0]}:{" "}</span
              >
            {/if}{inboxPreview(item.text)}</span
          >{/if}
      </span>
    </Button>
  </div>{/snippet}

<!-- One of your open tasks: its title, where it lives, the sidebar's progress bar. -->
{#snippet taskRow(item: Row)}<div data-inbox-row={item.key}>
    <Snapshot value={item}
      >{#snippet children(row)}<article
          data-room-inbox-message
          data-kind="task"
          class={cn(
            "relative rounded-xl hover:bg-muted",
            cursor === row.key && "bg-muted",
          )}
        >
          <Button
            variant="ghost"
            class="h-auto w-full min-w-0 items-center justify-start gap-3 rounded-xl px-3 pt-2.5 pb-4 text-left font-normal leading-5 whitespace-normal hover:bg-transparent"
            onclick={(event) => {
              if (live(event)) {
                cursor = row.key;
                open(row);
              }
            }}
          >
            <span
              class="grid size-5 shrink-0 place-items-center text-muted-foreground"
              ><Icon icon="check-circle" size={15} /></span
            >
            <span class="flex min-w-0 flex-1 items-baseline gap-2">
              <span class="min-w-0 truncate text-sm">{row.text}</span>
              <span
                class="min-w-0 shrink truncate text-xs text-muted-foreground"
                >{row.room}{row.where ? ` · ${row.where}` : ""}</span
              >
              <span class="ml-auto shrink-0 text-xs text-muted-foreground"
                >{t(statusLabel(row.task?.status ?? ""))}{row.task?.due
                  ? ` · ${row.task.due}`
                  : ""}</span
              >
            </span>
          </Button>
          <Progress
            data-home-task-progress={row.task?.status}
            aria-label={t(statusLabel(row.task?.status ?? ""))}
            value={progress(row.task?.status ?? "")}
            tone="success"
            class={cn(EPIC_PROGRESS, "left-11")}
          />
        </article>{/snippet}</Snapshot
    >
  </div>{/snippet}
