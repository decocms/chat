<script lang="ts">
  import { onDestroy, onMount, tick, untrack, type Snippet } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import { cn } from "../../lib/studio/utils";
  import Chat from "../chat/Chat.svelte";
  import Composer from "../composer/Composer.svelte";
  import RichContent from "../rich-text/RichContent.svelte";
  import SideFilePanel from "../file-viewer/SideFilePanel.svelte";
  import { createSideFileSession } from "../file-viewer/side";
  import { createFileViewer } from "../file-viewer/session";
  import { knownViewerFiles } from "../file-viewer/model";
  import { paneFocus } from "../room-layout/focus";
  import { itemArtifacts, type ItemArtifact } from "./itemArtifact";
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
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import type { Attachment, Room, RoomEvent } from "../../../shared/room";
  import type { CommandOutcome, RoomCommand } from "../../../shared/commands";
  import type { ComposerDrafts } from "../composer/drafts";
  import type { ComposerUpload } from "../composer/types";
  import type { BrowserApplicationServices } from "./browser";
  /**
   * The Home as the place you work: the open Inbox item is its thread (the
   * conversation with the asked message marked, the item's own actions
   * `itemActions` and the room's composer). When the item is about a thing
   * (a file, a room app such as a presentation, the thread's doc: see
   * itemArtifacts for the rule), that thing is shown big and the thread
   * becomes a column beside it; a row of names switches between the thread's
   * other artifacts. It is the room itself, over a socket of its own (the
   * same /ws a room opens, reduced by reduceRoom), and the room's own file
   * viewer (SideFilePanel), so nothing here is a copy. "Abrir na sala" is the
   * one way into the room.
   */
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
    // The artifact shown: null follows the rule; "none" is the thread alone (closed).
    chosen = $state<string | null>(null),
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
  // The room's own file viewer, embedded: the same reads, versions and media as the room's side pane.
  const side = createSideFileSession(
    createFileViewer({
      href: () => window.location.href,
      state: () => window.history.state,
      history: window.history,
      embedded: true,
    }),
    { current: () => active, changed: () => {} },
  );
  onDestroy(() => {
    active = false;
    connection.dispose();
    side.dispose();
    paneFocus.set(false);
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
      if ((target ?? selected) === selected)
        void tick().then(() => mark(id, true));
      else leave(id, target);
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
  const doc = $derived(
    room ? (selected === "main" ? room.doc : room.docs?.[selected]) : undefined,
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
  const artifacts = $derived(
    room
      ? itemArtifacts({
          messages: list,
          known: knownViewerFiles(room),
          focus,
          doc,
          docName: t("Doc da thread"),
        })
      : { primary: null, all: [] },
  );
  const shown = $derived.by((): ItemArtifact | null => {
    if (chosen === "none") return null;
    const picked = chosen
      ? artifacts.all.find((item) => item.key === chosen)
      : undefined;
    return picked ?? artifacts.primary;
  });
  // The viewer follows the room and opens the shown file (a new version of it too).
  $effect(() => {
    if (room) side.sync(room, request);
  });
  $effect(() => {
    const target = shown;
    if (!room || target?.kind !== "file") return;
    untrack(() => {
      if (side.target()?.id !== target.file.id) side.open(target.file);
    });
  });
  const richActions = { navigate: actions.navigate, openFile };
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
    if (!scroller || !room) return;
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
  <header class="flex h-[92px] shrink-0 items-center gap-2.5 px-6">
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
  <!-- Wide enough (960px+), the artifact and the thread side by side; narrower, the artifact on top. -->
  <div class="@container flex min-h-0 flex-1">
    <div class="flex min-h-0 min-w-0 flex-1 flex-col @[960px]:flex-row">
      {#if room && shown}<div
          data-task-artifact={shown.kind}
          class="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border @[960px]:border-r"
        >
          {#if artifacts.all.length > 1}<div
              data-task-artifacts
              class="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-3"
            >
              {#each artifacts.all as item (item.key)}<button
                  type="button"
                  data-task-artifact-pick={item.key}
                  aria-pressed={item.key === shown.key}
                  class={cn(
                    "h-7 shrink-0 cursor-pointer truncate rounded-md border-0 px-2.5 font-sans text-xs",
                    item.key === shown.key
                      ? "bg-secondary-hover font-medium text-foreground"
                      : "bg-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onclick={() => (chosen = item.key)}>{item.name}</button
                >{/each}
            </div>{/if}
          {#if shown.kind === "file"}<div class="min-h-0 flex-1">
              <SideFilePanel
                owner={side}
                {lang}
                actions={richActions}
                current={() => active}
                fullscreen={() => {}}
                close={() => (chosen = "none")}
              />
            </div>{:else}<section
              data-task-doc
              class="flex min-h-0 flex-1 flex-col"
            >
              <header
                class="flex h-12 shrink-0 items-center gap-1 border-b border-border pr-2 pl-4"
              >
                <h2 class="m-0 flex-1 truncate text-sm font-semibold">
                  {shown.name}
                </h2>
                <IconButton
                  label={t("Fechar")}
                  size="icon"
                  class="text-muted-foreground hover:text-foreground"
                  onclick={() => (chosen = "none")}
                  ><Icon icon="x" size={18} /></IconButton
                >
              </header>
              <div class="min-h-0 flex-1 overflow-auto px-6 py-5">
                <RichContent
                  text={doc ?? ""}
                  {room}
                  actions={richActions}
                  names={bridge.knownNames}
                  {t}
                />
              </div>
            </section>{/if}
        </div>{/if}
      <!-- The thread: the whole pane, or a column beside the artifact (hidden while the artifact is expanded). -->
      <div
        data-task-thread
        class={cn(
          "flex min-h-0 flex-col",
          room && shown
            ? cn(
                "h-[42%] shrink-0 border-t border-border @[960px]:h-auto @[960px]:w-[380px]",
                $paneFocus && "hidden",
              )
            : "min-w-0 flex-1",
        )}
      >
        <div
          bind:this={scroller}
          data-task-body
          class="min-h-0 flex-1 overflow-auto [&_[data-inbox-target]]:bg-muted"
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
          {:else}<Chat
              {room}
              thread={selected}
              {list}
              {more}
              vb={bridge}
              {actions}
              onloadolder={() => {
                const first = list[0]?.id;
                if (first)
                  connection.send({
                    t: "older",
                    thread: selected,
                    before: first,
                  });
              }}
            />{/if}
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
      </div>
    </div>
  </div>
</section>
