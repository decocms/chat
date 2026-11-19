<script lang="ts">
  import { untrack } from "svelte";
  import type { ComponentProps } from "svelte";
  import RoomBarTitle from "./RoomBarTitle.svelte";
  import type { ThreadHeaderProps } from "../room-sidebar/types";
  import DocumentToolbar from "../documents/DocumentToolbar.svelte";
  import type { DocumentPane } from "../documents/types";
  import type { ApplicationRoomPresentation } from "../application/shellTypes";
  import type { RoomLayoutController } from "../room-layout/types";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    ArrowLeft,
    ChevronDown,
    Inbox01,
    SearchMd,
  } from "../../lib/studio/icons";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { threadTitle } from "../room-sidebar/model";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Count from "../../lib/components/Count.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import type { SidebarProps } from "../../sidebar";
  import { dmPeer, roomAvatarVersion } from "../room-scope/model";
  import { isPanelToggleKey } from "./panelViews";
  let {
    presentation,
    header,
    layout,
    current,
    boardCount,
    appNavigation,
    back,
    tabs,
    onPane,
    inboxOpen = false,
    tochat,
  }: {
    presentation: ApplicationRoomPresentation;
    header: ThreadHeaderProps;
    layout: RoomLayoutController;
    current(): boolean;
    boardCount?: number | string;
    /** Search and your settings: on a phone the rail is hidden, so the header carries them. */
    appNavigation?: SidebarProps["appNavigation"];
    back(expectedThread: string): void;
    /** Desktop: the pane tabs live in this bar (one top bar, the split below it). */
    tabs?: ComponentProps<typeof DocumentToolbar>;
    onPane?(pane: DocumentPane): void;
    /** The room's inbox fills the middle (it replaces the chat, like the board). */
    inboxOpen?: boolean;
    /** Back to the chat: closes the inbox and the full board. */
    tochat?(): void;
  } = $props();
  const personal = untrack(() => presentation.services.personal.state),
    geometry = untrack(() => layout.state);
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const waits = $derived($personal.me?.waits ?? []);
  // A DM's face stands for it, the same as in your DM list.
  const peer = $derived(dmPeer(header.room));
  const en = $derived(presentation.services.language === "en");
  // Phone title: the room small on top, the open thread under it.
  const phoneTitle = $derived(
    threadTitle(header.room, header.thread) ??
      presentation.services.t(
        header.room.book.dm ? "Conversa" : "Sala principal",
      ),
  );
  const t = (text: string, vars?: Record<string, string | number>) =>
    presentation.services.t(text, vars);
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  // Desktop, two slots: the middle is the chat, the full board or the inbox;
  // the right pane (doc, files, apps, decisions, reminders) shows only beside
  // the chat. The pane open beside the chat: its tab shows selected.
  const split = $derived(
    !$geometry.mobile &&
      !inboxOpen &&
      !$geometry.boardFull &&
      $geometry.documentVisible,
  );
  // A tab brings the chat back, then opens that pane, or closes it when it's
  // the one already open (this replaced the pane toggle button).
  function pickPane(pane: DocumentPane) {
    if (!current()) return;
    if (split && layout.read().pane === pane) {
      layout.toggleDocument();
      return;
    }
    tochat?.();
    if (!layout.read().documentVisible) layout.toggleDocument();
    onPane?.(pane);
  }
  function toggleInbox(trigger: HTMLElement) {
    if (inboxOpen) tochat?.();
    else {
      if (!layout.read().mobile && layout.read().boardFull)
        layout.toggleBoard();
      presentation.openInbox(trigger);
    }
  }
  const editable = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !!target.closest("input, textarea, select, [contenteditable=true]");
  function onwindowkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || !current()) return;
    // Esc leaves the inbox or the full board for the chat.
    if (
      event.key === "Escape" &&
      (inboxOpen || (!layout.read().mobile && layout.read().boardFull)) &&
      !editable(event.target) &&
      !document.querySelector("[data-dialog-content], [role=dialog]")
    ) {
      event.preventDefault();
      if (inboxOpen) tochat?.();
      else layout.toggleBoard();
      return;
    }
    if (!isPanelToggleKey(event, mac)) return;
    event.preventDefault();
    layout.toggleDocument();
  }
</script>

<svelte:window onkeydown={onwindowkeydown} />
<!-- The tab's name follows the room (the server's <title> only names the first page, in the room's language). -->
<svelte:head
  ><title
    >{header.room.book.title
      ? `${header.room.book.title} · deco.chat`
      : "deco.chat"}</title
  ></svelte:head
>

<header
  data-vb-native
  data-native-room-header
  data-room-document-toolbar
  class="flex min-w-0 flex-1 flex-wrap items-center gap-1 font-sans text-sm text-foreground md:flex-nowrap"
>
  {#key header.thread}<Snapshot value={header.thread}
      >{#snippet children(expectedThread)}<IconButton
          label={t(
            expectedThread === "main"
              ? "Suas salas"
              : "Voltar pra sala principal",
          )}
          tooltipSide="bottom"
          size="icon"
          class="rounded-full md:hidden"
          onclick={(event) => {
            if (live(event)) back(expectedThread);
          }}><Icon icon={ArrowLeft} size={16} /></IconButton
        >{/snippet}</Snapshot
    >{/key}
  <button
    type="button"
    data-native-phone-title
    aria-label={t("Trocar de conversa")}
    class="flex min-w-0 flex-1 basis-0 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-1.5 py-1 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
    onclick={(event) => {
      if (live(event)) header.onopenside();
    }}
    ><RoomAvatar
      title={header.room.book.title}
      icon={header.roomIcon}
      person={peer
        ? {
            email: peer,
            version: roomAvatarVersion(header.room, $personal.me, peer),
          }
        : null}
      lang={en ? "en" : "pt"}
      surface="background"
    /><span class="flex min-w-0 flex-col"
      ><span class="truncate text-xs leading-4 text-muted-foreground"
        >{header.room.book.title}</span
      ><span
        class="flex min-w-0 items-center gap-1 text-base leading-5 font-semibold"
        ><span class="truncate">{phoneTitle}</span><Icon
          icon={ChevronDown}
          size={16}
          class="shrink-0"
        /></span
      ></span
    ></button
  >
  <!-- Desktop, one bar over chat and pane: what fills the middle (with the epic's actions), then the pane's tabs at the end. -->
  <div class="contents md:flex md:min-w-0 md:flex-1 md:items-center md:gap-1">
    <div
      data-native-header-title
      class="hidden min-w-0 flex-1 basis-0 md:flex md:min-w-24"
    >
      <RoomBarTitle
        room={header.room}
        thread={header.thread}
        owner={header.owner}
        vb={header.vb}
        view={inboxOpen ? "inbox" : $geometry.boardFull ? "board" : null}
      />
    </div>
    {#if appNavigation}<IconButton
        data-native-phone-search
        label={t("Buscar")}
        size="icon"
        class="rounded-full text-muted-foreground hover:text-foreground md:hidden"
        onclick={(event) => {
          if (live(event))
            appNavigation.controller.openSearch(event.currentTarget);
        }}><Icon icon={SearchMd} size={16} /></IconButton
      >{/if}
    <!-- Phones: the inbox in the bar. Desktop: it and the board are views in the sidebar, under the main thread. -->
    {#if $geometry.mobile}<IconButton
        data-native-inbox-toggle
        label={t("Caixa de entrada")}
        tooltipSide="bottom"
        size="icon"
        aria-pressed={inboxOpen}
        class="relative rounded-full text-muted-foreground hover:text-foreground md:aria-pressed:bg-accent md:aria-pressed:text-foreground"
        onclick={(event) => {
          if (live(event)) toggleInbox(event.currentTarget);
        }}
        ><Icon icon={Inbox01} size={16} />{#if waits.length}<Count
            value={waits.length}
            label={t("Esperando você: {n}", { n: waits.length })}
            class="absolute -top-1 -right-1 shadow-[0_0_0_2px_var(--vb-background)]"
          />{/if}</IconButton
      >{/if}
  </div>
  <div class="contents md:flex md:min-w-0 md:shrink md:items-center md:gap-1">
    {#if tabs}<div data-native-header-tabs class="hidden min-w-0 md:block">
        <DocumentToolbar
          {...tabs}
          bare
          exclude={header.room.book.dm
            ? ["agents", "board", "doc"]
            : ["agents", "board"]}
          pane={split ? tabs.pane : ("" as DocumentPane)}
          onPane={pickPane}
        />
      </div>{/if}
    {#if $personal.me}<span data-native-phone-account class="contents md:hidden"
        ><AccountRow me={$personal.me} row={false} /></span
      >{/if}
  </div>
</header>
