<script lang="ts">
  import { onMount, tick, untrack } from "svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import VibeCube from "../home/VibeCube.svelte";
  import ErrorState from "../../lib/components/ErrorState.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import type { BadgeVariants } from "../../lib/studio/badge";
  import Button from "../../lib/studio/Button.svelte";
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import { cn } from "../../lib/studio/utils";
  import type { ApplicationInbox, InboxBinding } from "./inbox";
  import type { BrowserApplicationServices } from "./browser";
  import type { InboxTask, Wait } from "../../app/types";
  import { roomAvatarVersion } from "../room-scope/model";
  import { roomLabel } from "../home/model";
  import { threadWait, type ThreadWait } from "../../../shared/threadWait";
  import { threadWaitLabel } from "../waits/model";
  import InboxControls from "./InboxControls.svelte";
  import {
    roomInboxModel,
    inboxTopic,
    inboxPreview,
    type RoomInboxMessage,
  } from "./roomInboxModel";
  /**
   * The Inbox, a triage list: what waits on you, newest first, two lines each.
   * A row opens its message; its actions reply in place, open or resolve.
   * "Resolve" waits INBOX_UNDO_MS before it reaches the server (Undo).
   * "Resolve all" lives in the home Inbox's bar (HomeInbox, InboxControls).
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
    root = untrack(() => services.rootRoom.state),
    personal = untrack(() => services.personal.state);
  const t = untrack(() => services.t);
  type Kind = "ask" | "claude" | "mention" | "review" | "task" | "thread";
  type Item = {
    key: string;
    kind: Kind;
    book: string;
    room: string;
    thread: string;
    where: string;
    author: string;
    text: string;
    ts: number;
    message?: RoomInboxMessage;
    wait?: Wait;
    task?: InboxTask;
    /** An open thread of yours (a wait e<epic>): its state. */
    open?: ThreadWait;
  };
  type Filter = "all" | Kind;
  const model = $derived(
    roomInboxModel($inbox.data, opening.roomId ?? "", $inbox.all),
  );
  const hidden = $derived(new Set($inbox.hidden));
  const waitKey = (wait: Wait) => `${wait.book_id}/${wait.ref}`;
  const roomName = (book: string, room: string) =>
    roomLabel($personal.me, book, room, services.language);
  const items = $derived.by(() => {
    const rows: Item[] = [
      ...model.messages.map((message) => ({
        key: message.key,
        kind: (message.kind === "reply" ? "ask" : message.kind) as Kind,
        book: message.book,
        room: message.room,
        thread: message.thread,
        where: inboxTopic(message, $root.room) || t("Sala principal"),
        author: message.author,
        text: message.text,
        ts: message.ts,
        message,
        wait: message.wait,
      })),
      ...model.oks.map((wait) => ({
        key: `w:${wait.book_id}:${wait.ref}`,
        kind: "review" as const,
        book: wait.book_id,
        room: wait.room,
        thread: wait.thread,
        where: wait.topic || t("Sala principal"),
        author: wait.author,
        text: wait.text,
        ts: wait.ts,
        wait,
      })),
      ...model.threads.flatMap((wait) => {
        const open = threadWait(wait);
        return open
          ? [
              {
                key: `e:${wait.book_id}:${wait.ref}`,
                kind: "thread" as const,
                book: wait.book_id,
                room: wait.room,
                thread: wait.thread,
                where: open.total
                  ? t("{done}/{total} tarefas", {
                      done: open.done,
                      total: open.total,
                    })
                  : t("Sem tarefas"),
                author: wait.author,
                text: wait.topic || "",
                ts: wait.ts,
                wait,
                open,
              },
            ]
          : [];
      }),
      ...model.groups.flatMap((group) =>
        group.tasks.map((task) => ({
          key: `t:${task.book_id}:${task.task_id}`,
          kind: "task" as const,
          book: task.book_id,
          room: task.room,
          thread: task.epic_id,
          where: group.epic || t("Sala principal"),
          author: "",
          text: task.title,
          ts: 0,
          task,
        })),
      ),
    ];
    return rows.filter((row) => !row.wait || !hidden.has(waitKey(row.wait)));
  });
  let filter = $state<Filter>("all");
  /** "Tudo" is what is for you now: not your tasks, and of your open threads only the ones ready to close or that
   *  @vibe called you about (the rest are in "Suas threads", so 60 open threads don't bury the asks). */
  const forYou = (row: Item) =>
    row.kind !== "task" &&
    (row.kind !== "thread" || !!row.open?.ready || !!row.open?.stale);
  const counts = $derived.by(() => {
    const value: Record<Filter, number> = {
      all: 0,
      ask: 0,
      claude: 0,
      mention: 0,
      review: 0,
      task: 0,
      thread: 0,
    };
    for (const row of items) {
      value[row.kind]++;
      if (forYou(row)) value.all++;
    }
    return value;
  });
  const chips: { filter: Filter; label: string }[] = [
    { filter: "all", label: "Tudo" },
    { filter: "ask", label: "Pedidos" },
    { filter: "review", label: "Revisões" },
    { filter: "claude", label: "Seu Claude" },
    { filter: "mention", label: "Menções" },
    { filter: "thread", label: "Suas threads" },
    { filter: "task", label: "Suas tarefas" },
  ];
  const shown = $derived(
    items
      .filter((row) => (filter === "all" ? forYou(row) : row.kind === filter))
      .sort((left, right) => right.ts - left.ts),
  );
  // In "All rooms", one group per room (in the order of its newest item).
  const groups = $derived.by(() => {
    if (!$inbox.all) return [{ key: "", label: "", rows: shown }];
    const byRoom = new Map<
      string,
      { key: string; label: string; rows: Item[] }
    >();
    for (const row of shown) {
      let group = byRoom.get(row.book);
      if (!group) {
        group = {
          key: row.book,
          label: roomName(row.book, row.room),
          rows: [],
        };
        byRoom.set(row.book, group);
      }
      group.rows.push(row);
    }
    return [...byRoom.values()];
  });
  const order = $derived(groups.flatMap((group) => group.rows));

  // Selection (asks only), the current row (keyboard), the inline reply.
  let selected = $state<Record<string, boolean>>({}),
    cursor = $state<string | null>(null),
    replying = $state<string | null>(null),
    draft = $state(""),
    sending = $state(false),
    replyError = $state(""),
    leaving = $state<Record<string, boolean>>({}),
    notice = $state(""),
    reduced = $state(false);
  const picked = $derived(
    order.filter((row) => row.kind === "ask" && row.wait && selected[row.key]),
  );
  onMount(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    reduced = query.matches;
    const change = () => (reduced = query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  });
  /** The rows' exit: they collapse for this long, then leave the list. */
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
  const name = (row: Item) =>
    row.kind === "claude"
      ? t("Seu Claude")
      : row.author === "ai"
        ? "@vibe"
        : row.message?.authorName ||
          row.wait?.author_name ||
          $root.room?.names?.[row.author] ||
          ($personal.me?.email === row.author
            ? $personal.me.name
            : $personal.me?.friends.find(
                (friend) => friend.email === row.author,
              )?.name) ||
          row.author.split("@")[0] ||
          "";
  const when = (ts: number) => {
    const today = new Date().toDateString() === new Date(ts).toDateString();
    return new Intl.DateTimeFormat(
      services.locale,
      today
        ? { hour: "2-digit", minute: "2-digit" }
        : { day: "numeric", month: "short" },
    ).format(ts);
  };
  const kindLabel: Record<Kind, string> = {
    ask: "pedido",
    claude: "seu Claude",
    mention: "menção",
    review: "revisar",
    task: "tarefa",
    thread: "thread",
  };
  // The row's kind is a Badge tone; a task row takes its status's tone instead.
  const kindTone: Record<Kind, NonNullable<BadgeVariants["variant"]>> = {
    ask: "warning",
    claude: "agent",
    mention: "muted",
    review: "success",
    task: "muted",
    thread: "muted",
  };
  const threadTone = (
    open: ThreadWait,
  ): NonNullable<BadgeVariants["variant"]> =>
    open.stale
      ? "warning"
      : open.ready
        ? "success"
        : open.status === "doing"
          ? "info"
          : "muted";
  const statusTone = (status: string) =>
    status === "review" ? "success" : status === "doing" ? "info" : "muted";
  const avatar = (email: string) =>
    roomAvatarVersion($root.room, $personal.me, email);

  function open(row: Item) {
    if (!current()) return;
    if (row.task) owner.openTask(opening, row.task);
    else if (row.kind === "thread" && row.wait)
      owner.openThread(opening, row.wait);
    else if (row.wait) owner.openWait(opening, row.wait);
    else if (row.message?.mention)
      owner.openMention(opening, row.message.mention);
  }
  function resolve(rows: Item[]) {
    if (!current()) return;
    const waits = rows.flatMap((row) =>
      row.kind === "ask" && row.wait ? [row.wait] : [],
    );
    if (!waits.length) return;
    const index = order.findIndex((row) => row.key === cursor);
    const gone = new Set(rows.map((row) => row.key));
    const next = order.slice(index + 1).find((row) => !gone.has(row.key));
    cursor = next?.key ?? null;
    for (const row of rows) delete selected[row.key];
    if (replying && gone.has(replying)) replying = null;
    for (const row of rows) leaving[row.key] = true;
    setTimeout(() => {
      for (const row of rows) delete leaving[row.key];
      if (current()) owner.resolveLater(opening, waits);
    }, exit());
  }
  async function markDone(row: Item) {
    if (!current() || row.kind !== "thread" || !row.wait) return;
    leaving[row.key] = true;
    const ok = await owner.markThreadDone(opening, row.wait);
    delete leaving[row.key];
    if (!current()) return;
    say(
      t(
        ok
          ? "Thread marcada como feita"
          : "Não deu pra marcar como feita. Tente de novo.",
      ),
    );
  }
  async function startReply(row: Item) {
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
  async function send(row: Item) {
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
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
    );
  }
  function keys(event: KeyboardEvent) {
    if (
      !current() ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      editable(event.target)
    )
      return;
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
      resolve([row]);
    } else if (event.key === "x" && row.kind === "ask") {
      event.preventDefault();
      selected[row.key] = !selected[row.key];
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  data-room-inbox
  aria-label={t("Caixa de entrada")}
  class="relative flex h-full min-h-0 min-w-0 flex-col bg-background font-sans text-foreground"
  onkeydown={keys}
>
  <div data-room-inbox-chat class="flex min-h-0 min-w-0 flex-1 flex-col">
    <!-- Phones: "Resolve all" (on desktop it lives in the home Inbox's bar). -->
    <InboxControls
      {owner}
      binding={opening}
      {t}
      class="flex-wrap border-b border-border px-3 py-2 md:hidden"
    />
    <header class="flex items-center gap-1.5 border-b border-border px-3 py-2">
      <div
        role="group"
        aria-label={t("Filtrar")}
        class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
      >
        {#each chips as chip (chip.filter)}{#if chip.filter === "all" || counts[chip.filter] || filter === chip.filter}<Button
              data-inbox-filter={chip.filter}
              size="sm"
              variant={filter === chip.filter ? "outline" : "ghost"}
              aria-pressed={filter === chip.filter}
              class={cn(
                "h-7 rounded-full px-2.5 text-xs font-normal",
                filter !== chip.filter && "text-muted-foreground",
              )}
              onclick={(event) => {
                if (live(event)) {
                  filter = chip.filter;
                  cursor = null;
                }
              }}
              >{t(chip.label)}<span class="tabular-nums"
                >{counts[chip.filter]}</span
              ></Button
            >{/if}{/each}
      </div>
    </header>
    {#if picked.length}<div
        data-inbox-selection
        class="flex animate-in flex-wrap items-center gap-2 border-b border-border bg-muted px-3 py-2 text-sm duration-150 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:-0.25rem] motion-reduce:animate-none"
      >
        <span class="font-medium"
          >{t("{n} selecionados", { n: picked.length })}</span
        >
        <Button
          size="sm"
          class="h-7"
          onclick={(event) => {
            if (live(event)) resolve(picked);
          }}
          ><Icon icon="check-circle" size={14} />{t(
            "Resolver selecionados",
          )}</Button
        >
        <Button
          size="sm"
          variant="ghost"
          class="h-7"
          onclick={(event) => {
            if (live(event)) selected = {};
          }}>{t("Limpar seleção")}</Button
        >
      </div>{/if}
    <div class="min-h-0 flex-1 overflow-auto">
      {#if $inbox.error && $inbox.error !== "resolve"}<div class="p-4">
          <ErrorState
            title={t("Não foi possível carregar a caixa de entrada.")}
            compact
            onretry={() => {
              if (current()) void owner.refresh(opening);
            }}
            retryLabel={t("Tentar de novo")}
          />
        </div>{/if}
      {#if $inbox.error === "resolve"}<div class="p-4">
          <ErrorState
            title={t("Não deu pra resolver agora. Tente de novo.")}
            compact
          />
        </div>{/if}
      {#if !shown.length && ($inbox.phase === "loading" || $inbox.phase === "idle")}<div
          data-inbox-loading
          role="status"
          aria-label={t("Carregando…")}
        >
          {#each [0, 1, 2, 3] as index (index)}<div
              class="grid grid-cols-[28px_minmax(0,1fr)] gap-3 border-b border-border px-4 py-3"
            >
              <Skeleton class="size-7 rounded-full" />
              <div class="grid gap-2">
                <Skeleton class="h-3.5 w-2/5" />
                <Skeleton
                  class={cn("h-3.5", index % 2 ? "w-3/4" : "w-11/12")}
                />
              </div>
            </div>{/each}
        </div>{:else}
        {#each groups as group (group.key)}
          {#if group.label}<p
              class="m-0 flex items-center gap-2 px-4 pt-4 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
            >
              {group.label}<span class="font-normal tabular-nums"
                >{group.rows.length}</span
              >
            </p>{/if}
          {#each group.rows as item (item.wait ?? item.message?.mention ?? item.task ?? item.key)}<div
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
                  >{#snippet children(row)}
                    <article
                      data-room-inbox-message
                      data-kind={row.kind}
                      aria-current={cursor === row.key || undefined}
                      class={cn(
                        "group/row relative grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-x-2 border-b border-border px-3 py-1.5 transition-colors duration-150 hover:bg-muted/60",
                        cursor === row.key &&
                          "bg-muted/60 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-foreground",
                      )}
                    >
                      <Button
                        variant="ghost"
                        class="col-start-2 row-start-1 h-auto min-w-0 items-start justify-start gap-3 rounded-lg p-1.5 text-left font-normal leading-5 whitespace-normal hover:bg-transparent"
                        onclick={(event) => {
                          if (live(event)) {
                            cursor = row.key;
                            open(row);
                          }
                        }}
                      >
                        {#if row.kind === "claude"}<AgentMark
                            class="mt-0.5 text-sm"
                          />{:else if row.kind === "thread" && row.author !== "ai"}<span
                            class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                            ><Icon icon="hash-02" size={14} /></span
                          >{:else if row.kind === "task"}<span
                            class="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
                            ><Icon icon="check-circle" size={14} /></span
                          >{:else if row.author === "ai"}<VibeCube
                            class="mt-0.5 text-sm text-foreground"
                          />{:else}<PersonAvatar
                            data-avatar="person"
                            size="sm"
                            class="mt-0.5"
                            email={row.author}
                            version={avatar(row.author)}
                          />{/if}
                        <span class="grid min-w-0 flex-1 gap-0.5">
                          <span
                            class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm"
                          >
                            {#if row.kind !== "task" && (row.kind !== "thread" || row.author === "ai")}<strong
                                class="font-medium">{name(row)}</strong
                              >{/if}<Badge
                              size="sm"
                              variant={row.open
                                ? threadTone(row.open)
                                : row.task
                                  ? statusTone(row.task.status)
                                  : kindTone[row.kind]}
                              >{t(
                                row.open
                                  ? threadWaitLabel(row.open)
                                  : row.task
                                    ? row.task.status === "review"
                                      ? "revisar"
                                      : row.task.status === "doing"
                                        ? "fazendo"
                                        : "a fazer"
                                    : kindLabel[row.kind],
                              )}</Badge
                            ><span
                              class="min-w-0 truncate text-xs text-muted-foreground"
                              >{row.where}</span
                            >{#if row.ts}<span
                                class="text-xs text-muted-foreground tabular-nums"
                                >{when(row.ts)}</span
                              >{/if}{#if row.task?.due}<Badge
                                variant="neutral"
                                size="sm">{row.task.due}</Badge
                              >{/if}
                          </span>
                          <span
                            class={cn(
                              "line-clamp-2 break-words text-sm",
                              row.kind === "thread" && "font-medium",
                            )}>{inboxPreview(row.text)}</span
                          >
                        </span>
                      </Button>
                      {#if row.kind === "ask"}<Checkbox
                          aria-label={t("Selecionar")}
                          class="col-start-1 row-start-1 mt-3.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=checked]:opacity-100 [@media(hover:none)]:opacity-100"
                          checked={!!selected[row.key]}
                          onCheckedChange={(value) => {
                            if (current()) selected[row.key] = value === true;
                          }}
                        />{/if}
                      <div
                        data-inbox-actions
                        class={cn(
                          "col-start-3 row-start-1 flex items-center gap-0.5 pt-1 opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 group-focus-within/row:opacity-100 [@media(hover:none)]:opacity-100",
                          cursor === row.key && "opacity-100",
                        )}
                      >
                        {#if row.kind === "ask" || row.kind === "mention"}<IconButton
                            data-inbox-reply-button
                            label={t("Responder")}
                            size="icon-sm"
                            tooltipSide="bottom"
                            onclick={(event) => {
                              if (live(event)) void startReply(row);
                            }}
                            ><Icon icon="reverse-left" size={15} /></IconButton
                          >{/if}{#if row.kind === "thread"}<Button
                            data-inbox-thread-done
                            size="sm"
                            variant="outline"
                            class="h-7 text-xs"
                            onclick={(event) => {
                              if (live(event)) void markDone(row);
                            }}
                            ><Icon icon="check-circle" size={14} />{t(
                              "Marcar como feita",
                            )}</Button
                          >{/if}<IconButton
                          data-inbox-open
                          label={t(
                            row.kind === "claude"
                              ? "Ir pro agent"
                              : row.kind === "thread"
                                ? "Abrir thread"
                                : row.kind === "task" || row.kind === "review"
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
                            }}
                            ><Icon icon="check-circle" size={15} /></IconButton
                          >{/if}
                      </div>
                      {#if replying === row.key}<form
                          data-inbox-reply={row.key}
                          class="col-start-2 col-end-4 row-start-2 grid animate-in gap-2 px-1.5 pt-1 pb-2 duration-150 ease-out [--tw-enter-opacity:0] [--tw-enter-translate-y:-0.25rem] motion-reduce:animate-none"
                          onsubmit={(event) => {
                            event.preventDefault();
                            if (live(event)) void send(row);
                          }}
                        >
                          <Textarea
                            rows={2}
                            value={draft}
                            disabled={sending}
                            placeholder={t("Responder em {topic}…", {
                              topic: row.where,
                            })}
                            aria-label={t("Responder")}
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
                            {#if row.kind === "ask"}<span
                                class="text-xs text-muted-foreground"
                                >{t("Enviar também resolve este pedido")}</span
                              >{/if}
                            {#if replyError}<span
                                role="alert"
                                class="text-xs text-destructive"
                                >{replyError}</span
                              >{/if}
                          </div>
                        </form>{/if}
                    </article>
                  {/snippet}</Snapshot
                >
              </div>
            </div>{/each}
        {:else}<div
            class="flex animate-in flex-col items-center gap-1 p-10 text-center text-muted-foreground duration-300 ease-out [--tw-enter-opacity:0] [--tw-enter-scale:0.96] motion-reduce:animate-none"
          >
            <Icon icon="check-circle" size={20} />
            <p class="m-0">
              {t(
                filter !== "all"
                  ? "Nada aqui. ✓"
                  : $inbox.all
                    ? "Nada esperando você. ✓"
                    : "Nada esperando você nesta sala. ✓",
              )}
            </p>
          </div>{/each}
      {/if}
    </div>
    <p
      class="m-0 hidden border-t border-border px-4 py-1.5 text-xs text-muted-foreground md:block"
    >
      {t("j/k mover · r responder · o abrir · e resolver · x selecionar")}
    </p>
  </div>
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
