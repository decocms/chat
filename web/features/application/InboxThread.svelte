<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import { cn } from "../../lib/studio/utils";
  import Chat from "../chat/Chat.svelte";
  import Composer from "../composer/Composer.svelte";
  import { chatDateTime, chatTime } from "../chat/time";
  import { visibleChatMessages } from "../chat/privacy";
  import {
    roomAvatarVersion,
    roomMessages,
    roomName,
  } from "../room-scope/model";
  import { threadTitle } from "../room-sidebar/model";
  import { createRoomConnection } from "../../app/roomConnection";
  import { reduceRoom } from "../../app/roomStore";
  import { createRoomApi } from "../../app/transport";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import type { Room, RoomEvent } from "../../../shared/room";
  import type { CommandOutcome, RoomCommand } from "../../../shared/commands";
  import type { ComposerDrafts } from "../composer/drafts";
  import type { ComposerUpload } from "../composer/types";
  import type { BrowserApplicationServices } from "./browser";
  /**
   * The Home's reading pane: one thread of one room, beside the Inbox, without
   * leaving the Home. It is the room's own Chat and Composer over a socket of
   * its own (the same /ws a room opens, reduced by reduceRoom), so what you
   * read, react to and send here is the room itself. The item's message is
   * scrolled to and stays marked. A reply or a reaction here clears the item
   * on the server (answeredHere / reactedHere); `onchanged` tells the Inbox to
   * read again.
   */
  let {
    services,
    drafts,
    book,
    thread,
    focus,
    title,
    onchanged,
    onopen,
    onclose,
  }: {
    services: BrowserApplicationServices;
    drafts: ComposerDrafts;
    book: string;
    thread: string;
    /** The item's message: scrolled to and marked. */
    focus?: number;
    /** The room's name as the Inbox shows it (until the room's own arrives). */
    title: string;
    /** A message or reaction sent from here went through. */
    onchanged: (command: RoomCommand) => void;
    /** "Abrir na sala": leave the Home for the room, on this thread and message. */
    onopen: () => void;
    onclose: () => void;
  } = $props();
  const roomId = untrack(() => book),
    selected = untrack(() => thread),
    t = untrack(() => services.t),
    locale = untrack(() => services.locale),
    personal = untrack(() => services.personal.state);

  let room = $state.raw<Room | null>(null),
    phase = $state<"loading" | "live" | "gone">("loading"),
    active = true,
    // The item's message is older than what the socket sent: read back until it shows (a few pages at most).
    pulls = 0;
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
    if (event.t === "state") phase = "live";
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

  /** Every command from the pane; a message or reaction that went through tells the Inbox. */
  const request = async (command: RoomCommand): Promise<CommandOutcome> => {
    if (!active) return { ok: false, error: "disconnected" };
    const outcome = await connection.request(command);
    if (active && outcome.ok && (command.t === "msg" || command.t === "react"))
      onchanged(command);
    return outcome;
  };
  const composerRequest = (command: RoomCommand) =>
    command.t === "msg" && (command.thread ?? "main") !== selected
      ? Promise.resolve<CommandOutcome>({ ok: false, error: "disconnected" })
      : request(command);
  const upload: ComposerUpload = (input, signal) =>
    createRoomApi(roomId, (url, init) =>
      services.fetcher(url, { ...init, signal }),
    ).uploadFile(input);

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
  function replyTo(id: number, text?: string) {
    const target = room && roomMessages(room).find((m) => m.id === id);
    if (!target || target.thread !== selected) return;
    const entry = drafts.entry(scope());
    entry.reply(target, text);
    entry.focus();
  }
  const leave = (messageId?: number, target = selected) =>
    services.actions.navigate({ roomId, thread: target, messageId });
  const actions: ChatActions = {
    request,
    reply: (id) => replyTo(id),
    draftReply: (draft) => replyTo(draft.messageId, draft.text),
    navigate: (id, target) => {
      if ((target ?? selected) === selected) mark(id, true);
      else leave(id, target);
    },
    openThread: (id) => leave(undefined, id),
    openFile: () => leave(),
  };
  const list = $derived(room ? visibleChatMessages(room, selected) : []);
  const more = $derived(
    !!room &&
      !room.complete &&
      !room.full?.includes(selected) &&
      list.length > 0,
  );
  const header = $derived(
    room
      ? {
          room: room.book.title || title,
          thread:
            selected === "main"
              ? t("sala principal")
              : (threadTitle(room, selected) ?? ""),
        }
      : { room: title, thread: "" },
  );

  /** Enter on the Inbox: the composer takes the keyboard. */
  export function focusComposer() {
    if (room) drafts.entry(scope()).focus();
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
    if (!scroller || !room) return;
    void tick().then(() => {
      if (!active || !scroller) return;
      if (mark(target, placed)) placed = true;
      else if (!placed) scroller.scrollTop = scroller.scrollHeight;
    });
  });
</script>

<section
  data-inbox-thread
  aria-label={header.thread ? `${header.room} › ${header.thread}` : header.room}
  class="flex h-full min-h-0 min-w-0 flex-col bg-background"
>
  <header
    class="flex h-13 shrink-0 items-center gap-1 border-b border-border pr-2 pl-5"
  >
    <h2
      class="m-0 flex min-w-0 flex-1 items-baseline gap-1.5 text-sm font-medium"
    >
      <span class="truncate">{header.room}</span>
      {#if header.thread}<span class="shrink-0 text-muted-foreground">›</span
        ><span class="min-w-0 truncate">{header.thread}</span>{/if}
    </h2>
    <Button
      data-inbox-thread-open
      size="sm"
      variant="ghost"
      class="h-8 shrink-0 px-2.5 text-[13px]"
      onclick={onopen}
      ><Icon icon="link-external-01" size={14} />{t("Abrir na sala")}</Button
    >
    <IconButton
      data-inbox-thread-close
      label={t("Fechar")}
      size="icon-sm"
      tooltipSide="bottom"
      onclick={onclose}><Icon icon="x" size={16} /></IconButton
    >
  </header>
  <div
    bind:this={scroller}
    data-inbox-thread-body
    class={cn(
      "min-h-0 flex-1 overflow-auto",
      "[&_[data-inbox-target]]:bg-muted",
    )}
  >
    {#if room}<Chat
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
      />{:else if phase === "gone"}<p
        class="m-0 p-8 text-center text-sm text-muted-foreground"
      >
        {t("Não foi possível abrir esta conversa.")}
      </p>{:else}<div
        role="status"
        aria-label={t("Carregando…")}
        class="grid gap-5 p-5"
      >
        {#each [0, 1, 2] as index (index)}<div
            class="grid grid-cols-[32px_minmax(0,1fr)] gap-3"
          >
            <Skeleton class="size-8 rounded-full" />
            <div class="grid gap-2">
              <Skeleton class="h-3 w-1/4" />
              <Skeleton class={cn("h-3.5", index % 2 ? "w-2/3" : "w-11/12")} />
            </div>
          </div>{/each}
      </div>{/if}
  </div>
  {#if room}<div data-inbox-thread-composer class="shrink-0">
      <Composer
        {room}
        thread={selected}
        vb={bridge}
        {drafts}
        request={composerRequest}
        {upload}
        navigate={(id) => mark(id, true)}
      />
    </div>{/if}
</section>
