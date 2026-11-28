<script lang="ts">
  import { onDestroy, onMount, tick, untrack, type Snippet } from "svelte";
  import { get } from "svelte/store";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import { cn } from "../../lib/studio/utils";
  import Chat from "../chat/Chat.svelte";
  import Composer from "../composer/Composer.svelte";
  import RichContent from "../rich-text/RichContent.svelte";
  import FileViewer from "../file-viewer/FileViewer.svelte";
  import { createSideFileSession } from "../file-viewer/side";
  import { createFileViewer } from "../file-viewer/session";
  import { externalFileURL, knownViewerFiles } from "../file-viewer/model";
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
   * The Home as the place you work: the open Inbox item is its thread, cut to
   * the stretch around the ask (EXCERPT messages before and after; "Ver a
   * conversa inteira na sala" goes to the room), with the item's own actions
   * (`itemActions`) and the room's composer. When the item is about a thing
   * (a file, a room app such as a presentation, the thread's doc: see
   * itemArtifacts for the rule), a button opens it full screen, with what you
   * are answering and the thread's composer at its foot; the thread's own
   * "Abrir" on an app or a file does the same. Esc or ✕ comes back. It is the
   * room itself, over a socket of its own (the same /ws a room opens, reduced
   * by reduceRoom), and the room's file viewer (FileViewer, embedded), so
   * nothing here is a copy.
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
    // The artifact open full screen (its key); it shows while paneFocus is on.
    chosen = $state<string | null>(null),
    active = true,
    pulls = 0,
    asked = false;
  const me = () => services.personal.peek();
  const socketUrl = (code: string) => {
    const url = new URL(
      // peek=1: looking at an item from the Inbox is not reading the room (Book.isPeekSocket).
      `/ws/${encodeURIComponent(roomId)}?t=${encodeURIComponent(selected)}&peek=1${code ? `&rc=${encodeURIComponent(code)}` : ""}`,
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
  // A file or image in the thread opens in the room's dialog, as in the room (Gimenes #5673). The Inbox is at `/`,
  // so the dialog keeps its history entry here, in memory: closing it closes it, and the address does not change.
  let dialogEntry: unknown = null;
  const dialog: ReturnType<typeof createFileViewer> = createFileViewer({
    href: () => `${window.location.origin}/b/${roomId}`,
    state: () => dialogEntry,
    history: {
      pushState: (entry: unknown) => void (dialogEntry = entry),
      replaceState: (entry: unknown) => void (dialogEntry = entry),
      back: () => {
        dialogEntry = null;
        queueMicrotask(() => dialog.consumePop());
      },
    },
  });
  onDestroy(() => {
    active = false;
    connection.dispose();
    side.dispose();
    dialog.dispose();
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
  /** The dialog, or a new tab for a file the room does not know. */
  function openFile(
    input: string | Attachment,
    trigger?: HTMLElement,
    label?: string,
  ) {
    if (!room) return false;
    dialog.sync(room, request);
    const opened = dialog.open(
      typeof input === "string"
        ? { roomId, id: input, label }
        : { roomId, id: input.id, metadata: input },
      trigger,
    );
    if (!opened && typeof input !== "string")
      window.open(fileUrl(input), "_blank", "noopener");
    return opened;
  }
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
    // A link to a room file (in a message, a thread card or the doc) opens in the same dialog (Gimenes #5689).
    openFileReference: (file) => void openFile(file.id, undefined, file.name),
  };

  const list = $derived(room ? visibleChatMessages(room, selected) : []);
  const more = $derived(
    !!room &&
      !room.complete &&
      !room.full?.includes(selected) &&
      list.length > 0,
  );
  // The stretch around the ask: EXCERPT messages before and after it (with no asked message, the last 2×EXCERPT).
  const EXCERPT = 10;
  const range = $derived.by(() => {
    const at = focus ? list.findIndex((message) => message.id === focus) : -1;
    return at >= 0
      ? {
          from: Math.max(0, at - EXCERPT),
          to: Math.min(list.length, at + EXCERPT + 1),
        }
      : { from: Math.max(0, list.length - EXCERPT * 2), to: list.length };
  });
  const excerpt = $derived(list.slice(range.from, range.to));
  const cut = $derived({
    before: range.from,
    after: list.length - range.to,
  });
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
  const shown = $derived.by((): ItemArtifact | null =>
    chosen ? (artifacts.all.find((item) => item.key === chosen) ?? null) : null,
  );
  /** Open a thing of the thread full screen, the thread's composer at its foot. */
  function expand(item: ItemArtifact) {
    chosen = item.key;
    paneFocus.set(true);
  }
  const full = $derived(!!room && !!shown && $paneFocus);
  const askedMessage = $derived(
    focus ? list.find((message) => message.id === focus) : undefined,
  );
  // The viewer follows the room and opens the shown file (a new version of it too).
  $effect(() => {
    if (room) {
      side.sync(room, request);
      dialog.sync(room, request);
    }
  });
  // The viewer is unmounted while the thread doc (or nothing) is shown, and unmounting it empties it: coming back to
  // the same file opens it again, else the app or file is blank (Cecilia #6502).
  $effect(() => {
    const target = shown;
    void full;
    if (!room || target?.kind !== "file") return;
    untrack(() => {
      if (side.target()?.id !== target.file.id || !get(side.viewer.state).open)
        side.open(target.file);
    });
  });
  const richActions = {
    navigate: actions.navigate,
    openFile,
    openFileReference: actions.openFileReference,
  };
  // The thread's own "Abrir" on a room app or a file opens it full screen here too.
  actions.openApp = (target) => {
    const item = artifacts.all.find(
      (other) =>
        other.kind === "file" &&
        target.connection === "room" &&
        other.file.name === `apps/${target.tool}.html`,
    );
    if (item) expand(item);
  };
  actions.openSideFile = (file) => {
    const item = artifacts.all.find(
      (other) => other.kind === "file" && other.file.name === file.name,
    );
    if (item) expand(item);
    else openFile(file);
  };
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
  <header
    class="flex h-14 shrink-0 items-center gap-2.5 border-b border-border pr-3 pl-5"
  >
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
      ><Icon icon="link-external-01" size={13} />{t(
        "Ver a conversa inteira na sala",
      )}</Button
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
  <!-- The thread: the stretch around the ask, the item's actions, the composer. -->
  <div data-task-thread class="flex min-h-0 flex-1 flex-col">
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
      {:else}{#if cut.before}<p
            class="m-0 pt-3 text-center text-xs text-muted-foreground"
          >
            {t("{n} mensagens antes", { n: cut.before })}
          </p>{/if}<Chat
          {room}
          thread={selected}
          list={excerpt}
          more={false}
          vb={bridge}
          {actions}
          onloadolder={() => {
            const first = excerpt[0]?.id;
            if (first)
              connection.send({
                t: "older",
                thread: selected,
                before: first,
              });
          }}
        />{#if cut.after}<button
            type="button"
            class="block w-full cursor-pointer border-0 bg-transparent py-3 text-center font-sans text-xs text-muted-foreground hover:text-foreground"
            onclick={onopen}
            >{t("{n} mensagens depois", { n: cut.after })} · {t(
              "Ver a conversa inteira na sala",
            )}</button
          >{/if}{/if}
    </div>
    {#if room && !full}<div data-task-answer class="shrink-0 pt-2">
        {#if itemActions || artifacts.primary}<div
            data-task-item-actions
            class="flex flex-wrap items-center gap-1.5 px-4 pb-1"
          >
            {#if artifacts.primary}{@const primary = artifacts.primary}<Button
                data-task-open-artifact
                size="sm"
                class="h-7 max-w-64 px-2.5 text-xs"
                onclick={() => expand(primary)}
                ><Icon icon="expand-01" size={13} /><span class="truncate"
                  >{t("Abrir {name}", { name: primary.name })}</span
                ></Button
              >{/if}
            {@render itemActions?.()}
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
  <!-- A thing of the thread, full screen: its bar (the thread's things as tabs, new tab, download, close),
       the thing, and under it what you are answering and the thread's composer. Esc or ✕ comes back. -->
  {#if full && shown && room}<div
      data-task-full={shown.kind}
      role="dialog"
      aria-modal="true"
      aria-label={shown.name}
      class="fixed inset-0 z-50 flex flex-col bg-background font-sans text-sm text-foreground"
    >
      <div
        data-task-artifacts
        class="flex h-12 shrink-0 items-stretch gap-1 border-b border-border pr-3 pl-5"
      >
        <div class="flex min-w-0 flex-1 items-stretch overflow-x-auto">
          {#each artifacts.all as item (item.key)}<button
              type="button"
              data-task-artifact-pick={item.key}
              aria-pressed={item.key === shown.key}
              title={item.kind === "file" ? item.file.name : item.name}
              class={cn(
                "-mb-px flex max-w-64 shrink-0 cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-2.5 font-sans text-sm whitespace-nowrap outline-none first:pl-0 focus-visible:ring-2 focus-visible:ring-ring",
                item.key === shown.key
                  ? "border-foreground font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              onclick={() => (chosen = item.key)}
              ><Icon
                icon={item.kind === "doc" ? "align-left" : "file-02"}
                size={14}
                class="shrink-0"
              /><span class="truncate">{item.name}</span></button
            >{/each}
        </div>
        <span class="flex shrink-0 items-center gap-0.5">
          {#if shown.kind === "file"}<IconButton
              label={t("Abrir em outra aba")}
              size="icon-sm"
              tooltipSide="bottom"
              class="text-muted-foreground hover:text-foreground"
              href={externalFileURL(
                { roomId, id: shown.file.id },
                location.origin,
                false,
              )}
              target="_blank"
              rel="noopener noreferrer"
              ><Icon icon="link-external-01" size={16} /></IconButton
            ><IconButton
              label={t("Baixar")}
              size="icon-sm"
              tooltipSide="bottom"
              class="text-muted-foreground hover:text-foreground"
              href={fileUrl(shown.file)}
              download={shown.file.name}
              ><Icon icon="download-01" size={16} /></IconButton
            >{/if}<IconButton
            data-task-full-close
            label={t("Fechar")}
            size="icon-sm"
            tooltipSide="bottom"
            class="text-muted-foreground hover:text-foreground"
            onclick={() => paneFocus.set(false)}
            ><Icon icon="x" size={16} /></IconButton
          >
        </span>
      </div>
      {#if shown.kind === "file"}<div
          class="flex min-h-0 flex-1 flex-col overflow-auto p-4"
        >
          <FileViewer
            controller={side.viewer}
            {lang}
            actions={richActions}
            inline
            onselect={(id) => {
              const target = side.target();
              if (active && target) side.select(target, id);
            }}
            onclose={() => paneFocus.set(false)}
          />
        </div>{:else}<div
          data-task-doc
          class="min-h-0 flex-1 overflow-auto px-8 py-6"
        >
          <div class="mx-auto max-w-3xl">
            <RichContent
              text={doc ?? ""}
              {room}
              actions={richActions}
              names={bridge.knownNames}
              {t}
            />
          </div>
        </div>{/if}
      <div data-task-answer class="shrink-0 border-t border-border pt-3">
        <div class="mx-auto w-full max-w-3xl">
          {#if askedMessage}<p
              data-task-asked
              class="m-0 truncate px-4 pb-2 text-xs text-muted-foreground"
            >
              <b class="font-medium text-foreground"
                >{name(askedMessage.author)}</b
              >
              {askedMessage.text}
            </p>{/if}
          {#if itemActions}<div
              data-task-item-actions
              class="flex flex-wrap items-center gap-1.5 px-4 pb-1"
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
        </div>
      </div>
    </div>{/if}
</section>
<FileViewer controller={dialog} {lang} actions={richActions} />
