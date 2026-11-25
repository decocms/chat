<script lang="ts">
  import { onDestroy, onMount, tick, untrack, type Snippet } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import { cn } from "../../lib/studio/utils";
  import Chat from "../chat/Chat.svelte";
  import Composer from "../composer/Composer.svelte";
  import TaskList from "../tasks/TaskList.svelte";
  import RichContent from "../rich-text/RichContent.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { chatDateTime, chatTime } from "../chat/time";
  import { visibleChatMessages } from "../chat/privacy";
  import {
    roomAvatarVersion,
    roomMessages,
    roomName,
  } from "../room-scope/model";
  import { threadTitle } from "../room-sidebar/model";
  import { roomIcon, type RoomSummary } from "../home/model";
  import { createRoomConnection } from "../../app/roomConnection";
  import { reduceRoom } from "../../app/roomStore";
  import { kb } from "../../app/panels";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import type { Attachment, Room, RoomEvent } from "../../../shared/room";
  import type { CommandOutcome, RoomCommand } from "../../../shared/commands";
  import type { ComposerDrafts } from "../composer/drafts";
  import type { ComposerUpload } from "../composer/types";
  import type { BrowserApplicationServices } from "./browser";
  /**
   * The Home as the place you work: the open Inbox item (a thread of a room)
   * beside the list, with the views of it that matter (its conversation, doc,
   * tasks and files), the item's own actions (`itemActions`: Ciente, Aprovar
   * / Reprovar, your Claude's choices) and the room's composer to answer. It
   * is the room itself, over a socket of its own (the same /ws a room opens,
   * reduced by reduceRoom), so nothing here is a copy. "Abrir na sala" is
   * the one way into the room.
   */
  type View = "chat" | "doc" | "tasks" | "files";
  let {
    services,
    drafts,
    book,
    thread,
    focus,
    title,
    summary,
    onchanged,
    onopen,
    onclose,
    itemActions,
  }: {
    services: BrowserApplicationServices;
    drafts: ComposerDrafts;
    book: string;
    thread: string;
    /** The item's message: scrolled to and marked. */
    focus?: number;
    /** The room's name as the Inbox shows it (until the room's own arrives). */
    title: string;
    summary?: RoomSummary;
    /** Something sent from here went through: the Inbox reads again. */
    onchanged: () => void;
    /** "Abrir na sala": leave the Home for the room, on this thread. */
    onopen: () => void;
    onclose: () => void;
    /** What the open item asks of you, above the composer: Ciente, Aprovar / Reprovar, your Claude's choices. */
    itemActions?: Snippet;
  } = $props();
  const roomId = untrack(() => book),
    selected = untrack(() => thread),
    t = untrack(() => services.t),
    locale = untrack(() => services.locale),
    lang = untrack(() => (services.language === "en" ? "en" : "pt")),
    personal = untrack(() => services.personal.state);

  let room = $state.raw<Room | null>(null),
    phase = $state<"loading" | "live" | "gone">("loading"),
    view = $state<View>("chat"),
    active = true,
    pulls = 0,
    asked = false;
  const me = () => services.personal.peek();
  const socketUrl = (code: string) => {
    const url = new URL(
      `/ws/${encodeURIComponent(roomId)}?t=${encodeURIComponent(selected)}${code ? `&rc=${encodeURIComponent(code)}` : ""}`,
      location.href,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    return url.href;
  };
  const threadMessages = (value: Room) =>
    roomMessages(value).filter((message) => message.thread === selected);
  // The item's message is older than what the socket sent: read back until it shows (a few pages at most).
  function pullTowardFocus(value: Room) {
    const target = untrack(() => focus);
    if (
      !target ||
      pulls >= 6 ||
      value.complete ||
      value.full?.includes(selected)
    )
      return;
    const first = threadMessages(value)[0]?.id ?? 0;
    if (!first || first <= target) return;
    pulls++;
    connection.send({ t: "older", thread: selected, before: first });
  }
  function receive(event: RoomEvent) {
    if (!active) return;
    if (event.t === "state" && event.me !== me()?.email) return;
    const next = reduceRoom(room, event, roomId);
    if (!next) return;
    room = next;
    if (event.t === "state") {
      phase = "live";
      if (!asked) {
        asked = true;
        connection.send({
          t: "doc.get",
          epic: selected === "main" ? "" : selected,
        });
      }
    }
    if (event.t === "state" || event.t === "older") pullTowardFocus(next);
  }
  const connection = createRoomConnection({
    url: socketUrl,
    onEvent: receive,
    onRemoved: () => {
      if (active) phase = "gone";
    },
    onUnavailable: () => {
      if (active) phase = "gone";
    },
  });
  onMount(() => connection.start());
  onDestroy(() => {
    active = false;
    connection.dispose();
  });

  /** Every command from here; what changes the room tells the Inbox to read again. */
  const request = async (command: RoomCommand): Promise<CommandOutcome> => {
    if (!active) return { ok: false, error: "disconnected" };
    const outcome = await connection.request(command);
    if (
      active &&
      outcome.ok &&
      command.t !== "older" &&
      command.t !== "doc.get"
    )
      onchanged();
    return outcome;
  };
  const send = (command: RoomCommand) => {
    void request(command);
    return true;
  };
  const composerRequest = (command: RoomCommand) =>
    command.t === "msg" && (command.thread ?? "main") !== selected
      ? Promise.resolve<CommandOutcome>({ ok: false, error: "disconnected" })
      : request(command);
  const upload: ComposerUpload = (input, signal) =>
    services.personal.api.upload(roomId, input.body, signal);

  const scope = () => ({
    account: room?.me ?? me()?.email ?? "",
    roomId,
    thread: selected,
  });
  const name = (email: string) =>
    room ? roomName(room, me(), email) : email.split("@")[0]!;
  const ago = (ts: number) => {
    const m = Math.round((Date.now() - ts) / 60000);
    return m < 1
      ? t("agora")
      : m < 60
        ? `${m} min`
        : m < 1440
          ? `${Math.round(m / 60)} h`
          : `${Math.round(m / 1440)} d`;
  };
  const bridge = $derived.by((): ChatBridge => {
    const person = $personal.me;
    return {
      t,
      name,
      ago,
      locale,
      pageUrl: location.href,
      knownNames: {
        ...Object.fromEntries(
          person?.friends
            .filter((friend) => friend.name)
            .map((friend) => [friend.email, friend.name!]) ?? [],
        ),
        ...(person?.name ? { [person.email]: person.name } : {}),
      },
      avatarVersion: (email) => roomAvatarVersion(room, person, email),
      hhmm: (ts) => chatTime(locale, ts),
      dateTime: (ts) => chatDateTime(locale, ts),
      waiting: (id) =>
        !!person?.waits.some(
          (wait) => wait.book_id === roomId && wait.ref === `m${id}`,
        ),
    };
  });
  const entry = () => drafts.entry(scope());
  function replyTo(id: number, text?: string) {
    const target = room && roomMessages(room).find((m) => m.id === id);
    if (!target || target.thread !== selected) return;
    view = "chat";
    entry().reply(target, text);
    entry().focus();
  }
  const fileUrl = (file: Attachment) =>
    `/api/books/${encodeURIComponent(roomId)}/files/${encodeURIComponent(file.id)}`;
  const openFile = (file: Attachment) =>
    window.open(fileUrl(file), "_blank", "noopener");
  const leave = (messageId?: number, target = selected) =>
    services.actions.navigate({ roomId, thread: target, messageId });
  const actions: ChatActions = {
    request,
    reply: (id) => replyTo(id),
    draftReply: (draft) => replyTo(draft.messageId, draft.text),
    navigate: (id, target) => {
      if ((target ?? selected) === selected) {
        view = "chat";
        void tick().then(() => mark(id, true));
      } else leave(id, target);
    },
    openThread: (id) => leave(undefined, id),
    openFile,
  };

  const list = $derived(room ? visibleChatMessages(room, selected) : []);
  const more = $derived(
    !!room &&
      !room.complete &&
      !room.full?.includes(selected) &&
      list.length > 0,
  );
  const epic = $derived(
    room && selected !== "main"
      ? room.epics.find((item) => item.id === selected)
      : undefined,
  );
  const taskRows = $derived(
    epic?.tasks ?? (selected === "main" ? (room?.roomTasks ?? []) : []),
  );
  const open = $derived(taskRows.filter((task) => !task.done).length);
  const doc = $derived(
    room ? (selected === "main" ? room.doc : room.docs?.[selected]) : undefined,
  );
  const files = $derived(
    list.flatMap((message) =>
      (message.files ?? []).map((file) => ({ file, by: message.author })),
    ),
  );
  const header = $derived(
    room
      ? {
          room: room.book.title || title,
          thread:
            selected === "main"
              ? t("Sala principal")
              : (threadTitle(room, selected) ?? ""),
        }
      : { room: title, thread: "" },
  );
  const views = $derived<{ id: View; label: string; count?: number }[]>([
    { id: "chat", label: t("Conversa") },
    { id: "doc", label: t("Doc") },
    { id: "tasks", label: t("Tarefas"), count: open },
    { id: "files", label: t("Arquivos"), count: files.length },
  ]);

  /** Enter on the Inbox: the composer takes the keyboard. */
  export function focusComposer() {
    if (room) entry().focus();
  }

  // Scroll: to the item's message (centered, marked), else to the end.
  let scroller = $state<HTMLElement | null>(null),
    placed = false;
  function mark(id: number | undefined, smooth = false) {
    if (!scroller) return false;
    for (const node of scroller.querySelectorAll("[data-inbox-target]"))
      node.removeAttribute("data-inbox-target");
    const node = id ? scroller.querySelector<HTMLElement>(`#m${id}`) : null;
    if (!node) return false;
    node.setAttribute("data-inbox-target", "");
    node.scrollIntoView({
      block: "center",
      behavior: smooth ? "smooth" : "auto",
    });
    return true;
  }
  $effect(() => {
    const target = focus;
    list;
    if (!scroller || !room || view !== "chat") return;
    void tick().then(() => {
      if (!active || !scroller) return;
      if (mark(target, placed)) placed = true;
      else if (!placed) scroller.scrollTop = scroller.scrollHeight;
    });
  });
</script>

<section
  data-task-workspace
  aria-label={header.thread ? `${header.room} › ${header.thread}` : header.room}
  class="flex h-full min-h-0 min-w-0 flex-col bg-background"
>
  <!-- One row, as high as the ask box on the list's side, so the two rows of tabs line up. -->
  <header class="flex h-16 shrink-0 items-center gap-2.5 px-6">
    <RoomAvatar
      title={header.room}
      icon={summary ? roomIcon(summary) : null}
      {lang}
      size="xs"
      surface="background"
    />
    <h2 class="m-0 flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
      <span class="shrink-0 text-muted-foreground">{header.room}</span>
      {#if header.thread}<span class="shrink-0 text-subtle-foreground">›</span
        ><span class="min-w-0 truncate font-medium">{header.thread}</span>{/if}
    </h2>
    <Button
      data-task-open-room
      size="sm"
      variant="ghost"
      class="h-8 shrink-0 px-2.5 text-xs text-muted-foreground"
      onclick={onopen}
      ><Icon icon="link-external-01" size={13} />{t("Abrir na sala")}</Button
    >
    <IconButton
      data-task-close
      label={t("Fechar")}
      size="icon-sm"
      tooltipSide="bottom"
      class="text-muted-foreground"
      onclick={onclose}><Icon icon="x" size={16} /></IconButton
    >
  </header>
  <div
    role="tablist"
    aria-label={t("Visões da tarefa")}
    class="flex h-10 shrink-0 border-b border-border px-6"
  >
    {#each views as item (item.id)}<button
        type="button"
        role="tab"
        data-task-view={item.id}
        aria-selected={view === item.id}
        class={cn(
          "-mb-px flex cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-3 font-sans text-sm whitespace-nowrap outline-none first:pl-0 focus-visible:ring-2 focus-visible:ring-ring",
          view === item.id
            ? "border-foreground font-medium text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
        onclick={() => (view = item.id)}
        >{item.label}{#if item.count}<span
            class="text-xs font-normal text-muted-foreground tabular-nums"
            >{item.count}</span
          >{/if}</button
      >{/each}
  </div>

  <div
    bind:this={scroller}
    data-task-body={view}
    class={cn(
      "min-h-0 flex-1 overflow-auto",
      "[&_[data-inbox-target]]:bg-muted",
    )}
  >
    {#if !room}{#if phase === "gone"}<p
          class="m-0 p-8 text-center text-sm text-muted-foreground"
        >
          {t("Não foi possível abrir esta conversa.")}
        </p>{:else}<div
          role="status"
          aria-label={t("Carregando…")}
          class="grid gap-5 p-6"
        >
          {#each [0, 1, 2] as index (index)}<div
              class="grid grid-cols-[32px_minmax(0,1fr)] gap-3"
            >
              <Skeleton class="size-8 rounded-full" />
              <div class="grid gap-2">
                <Skeleton class="h-3 w-1/4" />
                <Skeleton
                  class={cn("h-3.5", index % 2 ? "w-2/3" : "w-11/12")}
                />
              </div>
            </div>{/each}
        </div>{/if}
    {:else if view === "chat"}<Chat
        {room}
        thread={selected}
        {list}
        {more}
        vb={bridge}
        {actions}
        onloadolder={() => {
          const first = list[0]?.id;
          if (first)
            connection.send({ t: "older", thread: selected, before: first });
        }}
      />
    {:else if view === "doc"}<div data-task-doc class="px-6 py-6">
        {#if doc?.trim()}<RichContent
            text={doc}
            {room}
            actions={{ navigate: actions.navigate, openFile }}
            names={bridge.knownNames}
            {t}
          />{:else}<p class="m-0 py-6 text-sm text-muted-foreground">
            {t("Esta tarefa ainda não tem doc.")}
          </p>{/if}
      </div>
    {:else if view === "tasks"}<div data-task-tasks class="px-3 py-4">
        <TaskList
          {room}
          thread={selected}
          vb={{ t, name }}
          {send}
          waits={$personal.me?.waits ?? []}
        />
      </div>
    {:else if view === "files"}<div
        data-task-files
        class="grid gap-1 px-3 py-4"
      >
        {#each files as item (item.file.id)}<a
            href={fileUrl(item.file)}
            target="_blank"
            rel="noopener"
            class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-foreground no-underline hover:bg-muted"
            ><Icon icon="file-02" size={16} /><span
              class="min-w-0 flex-1 truncate">{item.file.name}</span
            ><span class="text-xs text-muted-foreground tabular-nums"
              >{name(item.by)} · {kb(item.file.size)}</span
            ></a
          >{:else}<p class="m-0 p-4 text-sm text-muted-foreground">
            {t("Nenhum arquivo nesta tarefa.")}
          </p>{/each}
      </div>
    {/if}
  </div>

  {#if room}<div data-task-answer class="shrink-0 pt-2">
      {#if itemActions}<div
          data-task-item-actions
          class="flex flex-wrap items-center gap-2 px-6 pb-1"
        >
          {@render itemActions()}
        </div>{/if}
      <Composer
        {room}
        thread={selected}
        vb={bridge}
        {drafts}
        request={composerRequest}
        {upload}
        navigate={(id) => actions.navigate(id)}
      />
    </div>{/if}
</section>
