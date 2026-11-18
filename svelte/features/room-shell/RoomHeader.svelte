<script lang="ts">
  import { untrack } from "svelte";
  import type { ComponentProps } from "svelte";
  import ThreadHeader from "../room-sidebar/ThreadHeader.svelte";
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
  import { suggestionAt } from "../room-sidebar/model";
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
  const threadTitle = $derived(
    suggestionAt(header.room, header.thread)?.title ??
      header.room.epics.find((epic) => epic.id === header.thread)?.title ??
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
  // The room's name or icon in the bar brings the chat back (not its buttons);
  // in the chat already, nothing changes.
  function titleClick(event: MouseEvent) {
    if (!current() || !(event.target instanceof Element)) return;
    if (event.target.closest("button, a, input, [role=menu], [role=menuitem]"))
      return;
    tochat?.();
  }
</script>

<svelte:window onkeydown={onwindowkeydown} />
<!-- The tab's name follows the room (the server's <title> only names the first page, in the room's language). -->
<svelte:head
  ><title
    >{header.room.book.title
      ? `${header.room.book.title} · vibebook`
      : "vibebook"}</title
  ></svelte:head
>

<header
  data-vb-native
  data-native-room-header
  data-room-document-toolbar
  class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-wrap tw:items-center tw:gap-1 tw:font-sans tw:text-sm tw:text-foreground tw:min-[901px]:flex-nowrap"
>
  {#key header.thread}<Snapshot value={header.thread}
      >{#snippet children(expectedThread)}<IconButton
          label={t(
            expectedThread === "main"
              ? "Seus vibebooks"
              : "Voltar pra sala principal",
          )}
          tooltipSide="bottom"
          size="icon"
          class="tw:rounded-full tw:min-[901px]:hidden"
          onclick={(event) => {
            if (live(event)) back(expectedThread);
          }}><Icon icon={ArrowLeft} size={16} /></IconButton
        >{/snippet}</Snapshot
    >{/key}
  <button
    type="button"
    data-native-phone-title
    aria-label={t("Trocar de conversa")}
    class="tw:flex tw:min-w-0 tw:flex-1 tw:basis-0 tw:cursor-pointer tw:items-center tw:gap-2.5 tw:rounded-lg tw:border-0 tw:bg-transparent tw:px-1.5 tw:py-1 tw:text-left tw:font-sans tw:text-foreground tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:min-[901px]:hidden"
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
    /><span class="tw:flex tw:min-w-0 tw:flex-col"
      ><span
        class="tw:truncate tw:text-xs tw:leading-4 tw:text-muted-foreground"
        >{header.room.book.title}</span
      ><span
        class="tw:flex tw:min-w-0 tw:items-center tw:gap-1 tw:text-base tw:leading-5 tw:font-semibold"
        ><span class="tw:truncate">{threadTitle}</span><Icon
          icon={ChevronDown}
          size={16}
          class="tw:shrink-0"
        /></span
      ></span
    ></button
  >
  <!-- Desktop, one bar over chat and pane: the thread, the room's actions, then the pane's tabs at the end. -->
  <div
    class="tw:contents tw:min-[901px]:flex tw:min-[901px]:min-w-0 tw:min-[901px]:flex-1 tw:min-[901px]:items-center tw:min-[901px]:gap-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div
      data-native-header-title
      class="tw:hidden tw:min-w-0 tw:flex-1 tw:basis-0 tw:min-[901px]:flex tw:min-[901px]:min-w-24 tw:[&_h2]:cursor-pointer"
      onclick={titleClick}
    >
      <ThreadHeader {...header} compact onhome={tochat} />
    </div>
    {#if appNavigation}<IconButton
        data-native-phone-search
        label={t("Buscar")}
        size="icon"
        class="tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:min-[901px]:hidden"
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
        class="tw:relative tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:min-[901px]:aria-pressed:bg-accent tw:min-[901px]:aria-pressed:text-foreground"
        onclick={(event) => {
          if (live(event)) toggleInbox(event.currentTarget);
        }}
        ><Icon icon={Inbox01} size={16} />{#if waits.length}<Count
            value={waits.length}
            label={t("Esperando você: {n}", { n: waits.length })}
            class="tw:absolute tw:-top-1 tw:-right-1 tw:shadow-[0_0_0_2px_var(--vb-background)]"
          />{/if}</IconButton
      >{/if}
  </div>
  <div
    class="tw:contents tw:min-[901px]:flex tw:min-[901px]:min-w-0 tw:min-[901px]:shrink tw:min-[901px]:items-center tw:min-[901px]:gap-1"
  >
    {#if tabs}<div
        data-native-header-tabs
        class="tw:hidden tw:min-w-0 tw:min-[901px]:block"
      >
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
    {#if $personal.me}<span
        data-native-phone-account
        class="tw:contents tw:min-[901px]:hidden"
        ><AccountRow me={$personal.me} row={false} /></span
      >{/if}
  </div>
</header>
