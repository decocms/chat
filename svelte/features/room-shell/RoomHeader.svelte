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
    Columns03,
    Inbox01,
    LayoutAlt01,
    LayoutRight,
    SearchMd,
  } from "../../lib/studio/icons";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { suggestionAt } from "../room-sidebar/model";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Count from "../../lib/components/Count.svelte";
  import UserMenu from "../app-navigation/UserMenu.svelte";
  import { userMenuBridge } from "../app-navigation/menuBridge";
  import type { SidebarProps } from "../../sidebar";
  import { personAvatar } from "../home/model";
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
  }: {
    presentation: ApplicationRoomPresentation;
    header: ThreadHeaderProps;
    layout: RoomLayoutController;
    current(): boolean;
    boardCount?: number | string;
    /** Search and the account menu: on a phone the rail is hidden, so the header carries them. */
    appNavigation?: SidebarProps["appNavigation"];
    back(expectedThread: string): void;
    /** Desktop: the pane tabs live in this bar (one top bar, the split below it). */
    tabs?: ComponentProps<typeof DocumentToolbar>;
    onPane?(pane: DocumentPane): void;
  } = $props();
  // The shell's account menu (absent in isolated mounts).
  const menu = userMenuBridge();
  const personal = untrack(() => presentation.services.personal.state),
    geometry = untrack(() => layout.state);
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const waits = $derived($personal.me?.waits ?? []);
  const en = $derived(presentation.services.language === "en");
  // Phone title: the room small on top, the open thread under it.
  const threadTitle = $derived(
    suggestionAt(header.room, header.thread)?.title ??
      header.room.epics.find((epic) => epic.id === header.thread)?.title ??
      presentation.services.t("Sala principal"),
  );
  const t = (text: string, vars?: Record<string, string | number>) =>
    presentation.services.t(text, vars);
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const toggleLabel = $derived(
    t(
      mac
        ? "Alternar painel direito (⌥⌘B)"
        : "Alternar painel direito (Ctrl+Alt+B)",
    ),
  );
  // The pane open beside the chat: its tab shows selected.
  const split = $derived(
    !$geometry.mobile &&
      $geometry.documentVisible &&
      !($geometry.boardFull && $geometry.pane === "board"),
  );
  // A tab opens the pane when it's closed (or the board is full), then shows that pane.
  function pickPane(pane: DocumentPane) {
    if (!current()) return;
    if (layout.read().boardFull) layout.toggleBoard();
    if (!layout.read().documentVisible) layout.toggleDocument();
    onPane?.(pane);
  }
  function onwindowkeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || !isPanelToggleKey(event, mac) || !current())
      return;
    event.preventDefault();
    layout.toggleDocument();
  }
</script>

<svelte:window onkeydown={onwindowkeydown} />

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
    <div
      class="tw:hidden tw:min-w-0 tw:flex-1 tw:basis-0 tw:min-[901px]:flex tw:min-[901px]:min-w-24"
    >
      <ThreadHeader {...header} compact />
    </div>
    <IconButton
      data-native-board-toggle
      label={t("Quadro de tarefas (kanban)")}
      tooltipSide="bottom"
      size="icon"
      aria-pressed={$geometry.boardFull}
      class="tw:relative tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:aria-pressed:bg-accent tw:aria-pressed:text-foreground tw:max-[900px]:hidden"
      onclick={(event) => {
        if (live(event)) layout.toggleBoard();
      }}
      ><Icon
        icon={tabs ? LayoutAlt01 : Columns03}
        size={16}
      />{#if typeof boardCount === "number" && boardCount}<Count
          value={boardCount}
          label={t("Esperando você: {n}", { n: boardCount })}
          class="tw:absolute tw:-top-1 tw:-right-1 tw:shadow-[0_0_0_2px_var(--vb-background)]"
        />{/if}</IconButton
    >
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
    <IconButton
      data-native-inbox-toggle
      label={t("Caixa de entrada")}
      tooltipSide="bottom"
      size="icon"
      class="tw:relative tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground"
      onclick={(event) => {
        if (live(event)) presentation.openInbox(event.currentTarget);
      }}
      ><Icon icon={Inbox01} size={16} />{#if waits.length}<Count
          value={waits.length}
          label={t("Esperando você: {n}", { n: waits.length })}
          class="tw:absolute tw:-top-1 tw:-right-1 tw:shadow-[0_0_0_2px_var(--vb-background)]"
        />{/if}</IconButton
    >
  </div>
  <div
    class="tw:contents tw:min-[901px]:flex tw:min-[901px]:min-w-0 tw:min-[901px]:shrink tw:min-[901px]:items-center tw:min-[901px]:gap-1"
  >
    {#if tabs}<span
        aria-hidden="true"
        class="tw:hidden tw:mx-1.5 tw:h-5 tw:w-px tw:shrink-0 tw:bg-border tw:min-[901px]:block"
      ></span>
      <div
        data-native-header-tabs
        class="tw:hidden tw:min-w-0 tw:min-[901px]:block"
      >
        <DocumentToolbar
          {...tabs}
          bare
          exclude={["agents"]}
          pane={split ? tabs.pane : ("" as DocumentPane)}
          onPane={pickPane}
        />
      </div>{/if}
    <IconButton
      data-native-document-toggle
      label={toggleLabel}
      tooltipSide="bottom"
      size="icon"
      aria-pressed={$geometry.documentVisible}
      aria-keyshortcuts={mac ? "Alt+Meta+B" : "Control+Alt+B"}
      class="tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:max-[900px]:hidden"
      onclick={(event) => {
        if (live(event)) layout.toggleDocument();
      }}><Icon icon={LayoutRight} size={16} /></IconButton
    >
    {#if menu && $personal.me}<span
        data-native-phone-account
        class="tw:contents tw:min-[901px]:hidden"
        ><UserMenu
          name={$personal.me.name ?? ""}
          email={$personal.me.email}
          avatar={personAvatar($personal.me, $personal.me.email)}
          friends={$personal.me.friends.length}
          lang={menu.lang}
          theme={menu.theme()}
          onsettheme={menu.onsettheme}
          onlanguage={menu.onlanguage}
          onaccount={menu.onaccount}
          pwa={menu.pwa}
          onlogout={menu.onlogout}
        /></span
      >{/if}
  </div>
</header>
