<script lang="ts">
  import { untrack } from "svelte";
  import type { ComponentProps, Snippet } from "svelte";
  import Separator from "../../lib/studio/Separator.svelte";
  import RoomBarTitle from "./RoomBarTitle.svelte";
  import { tabTitle } from "../notifications/title";
  import type { ThreadHeaderProps } from "../room-sidebar/types";
  import DocumentToolbar from "../documents/DocumentToolbar.svelte";
  import type { DocumentPane } from "../documents/types";
  import type { ApplicationRoomPresentation } from "../application/shellTypes";
  import type { RoomLayoutController } from "../room-layout/types";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { threadTitle } from "../room-sidebar/model";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Count from "../../lib/components/Count.svelte";
  import AccountRow from "../app-navigation/AccountRow.svelte";
  import type { SidebarProps } from "../../app/sidebar";
  import { dmPeer, roomAvatarVersion } from "../room-scope/model";
  import { isPanelToggleKey } from "./panelViews";
  import { roomSearchQuery } from "../chat/roomSearch";
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
    viewControls,
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
    /** Desktop: the controls of the view in the middle (the inbox's scope and "Resolve all"),
     * before the pane's tabs, after a vertical divider. See docs/design.md (Top bar). */
    viewControls?: Snippet;
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
  // Phone title: the most important line first (the open thread, or a DM's
  // person), and under it the room with the epic's progress (Gimenes #3739).
  const phoneTitle = $derived(
    header.room.book.dm
      ? header.room.book.title
      : (threadTitle(header.room, header.thread) ??
          presentation.services.t("Sala principal")),
  );
  const phoneEpic = $derived(
    header.room.epics.find((epic) => epic.id === header.thread),
  );
  const phoneSubtitle = $derived(
    header.room.book.dm
      ? ""
      : [
          header.room.book.title,
          phoneEpic?.tasks.length
            ? presentation.services.t("{done} de {total} tarefas", {
                done: phoneEpic.tasks.filter((task) => task.done).length,
                total: phoneEpic.tasks.length,
              })
            : "",
        ]
          .filter(Boolean)
          .join(" · "),
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
  /** Closing the doc falls back to People & agents (a DM has no People): only then does the pane close. */
  function closePane() {
    if (layout.read().pane === "doc" && !header.room.book.dm)
      onPane?.("people");
    else layout.toggleDocument();
  }
  function pickPane(pane: DocumentPane) {
    if (!current()) return;
    if (split && layout.read().pane === pane) {
      closePane();
      return;
    }
    tochat?.();
    if (!layout.read().documentVisible) layout.toggleDocument();
    onPane?.(pane);
  }
  // The room's search (like Discord's): typing opens the Search pane beside the chat, which lists the matches.
  function searchRoom(value: string) {
    if (!current()) return;
    roomSearchQuery.set(value);
    if (value.trim() && !(split && layout.read().pane === "search")) {
      tochat?.();
      if (!layout.read().documentVisible) layout.toggleDocument();
      onPane?.("search");
    }
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
    if (split) closePane();
    else layout.toggleDocument();
  }
</script>

<svelte:window onkeydown={onwindowkeydown} />
<!-- The tab's name follows the room (the server's <title> only names the first page, in the room's language). -->
<svelte:head
  ><title
    >{tabTitle(
      header.room.book.title
        ? `${header.room.book.title} · deco.chat`
        : "deco.chat",
      waits.length,
    )}</title
  ></svelte:head
>

<header
  data-room-bar
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
          data-phone-back
          size="icon"
          class="size-10 rounded-full md:hidden"
          onclick={(event) => {
            if (live(event)) back(expectedThread);
          }}><Icon icon="arrow-left" size={20} /></IconButton
        >{/snippet}</Snapshot
    >{/key}
  <button
    type="button"
    data-phone-title
    aria-label={t("Trocar de conversa")}
    class="flex min-w-0 flex-1 basis-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-0 bg-transparent px-1.5 py-1 text-center font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
    onclick={(event) => {
      if (live(event)) header.onopenside();
    }}
    >{#if peer}<!-- A DM: the person's face beside their name. --><RoomAvatar
        title={header.room.book.title}
        icon={header.roomIcon}
        person={{
          email: peer,
          version: roomAvatarVersion(header.room, $personal.me, peer),
        }}
        lang={en ? "en" : "pt"}
        surface="background"
      />{/if}<span class="flex min-w-0 flex-col items-center"
      ><span
        class="flex max-w-full min-w-0 items-center gap-1 text-base leading-5 font-semibold"
        ><span data-phone-thread class="truncate">{phoneTitle}</span><Icon
          icon="chevron-down"
          size={16}
          class="shrink-0"
        /></span
      >{#if phoneSubtitle}<span
          data-phone-room
          class="max-w-full truncate text-xs leading-4 text-muted-foreground"
          >{phoneSubtitle}</span
        >{/if}</span
    ></button
  >
  <!-- Desktop, one bar over chat and pane: what fills the middle (with the epic's actions), then the pane's tabs at the end. -->
  <div class="contents md:flex md:min-w-0 md:flex-1 md:items-center md:gap-1">
    <div
      data-header-title
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
    <!-- Phones: the inbox in the bar (the search is in the title's menu). Desktop: it and the board are views in the sidebar, under the main thread. -->
    {#if $geometry.mobile}<IconButton
        data-inbox-toggle
        label={t("Caixa de entrada")}
        tooltipSide="bottom"
        size="icon"
        aria-pressed={inboxOpen}
        class="relative size-10 rounded-full text-muted-foreground hover:text-foreground md:aria-pressed:bg-accent md:aria-pressed:text-foreground"
        onclick={(event) => {
          if (live(event)) toggleInbox(event.currentTarget);
        }}
        ><Icon icon="inbox-01" size={20} />{#if waits.length}<Count
            value={waits.length}
            label={t("Esperando você: {n}", { n: waits.length })}
            class="absolute -top-1 -right-1 shadow-[0_0_0_2px_var(--vb-background)]"
          />{/if}</IconButton
      >{/if}
  </div>
  <div class="contents md:flex md:min-w-0 md:shrink md:items-center md:gap-1">
    {#if viewControls}<div
        data-header-view-controls
        class="hidden shrink-0 items-center gap-1 md:flex"
      >
        {@render viewControls()}{#if tabs}<Separator
            orientation="vertical"
            class="mx-1.5 h-5 data-[orientation=vertical]:h-5"
          />{/if}
      </div>{/if}
    {#if !header.room.book.dm}<label
        data-room-search-field
        class="mr-1 hidden h-8 w-44 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2.5 text-muted-foreground transition-[width] duration-150 focus-within:w-60 focus-within:text-foreground md:flex"
        ><Icon icon="search-md" size={14} /><input
          type="text"
          inputmode="search"
          value={$roomSearchQuery}
          placeholder={t("Buscar nesta sala")}
          aria-label={t("Buscar nesta sala")}
          class="h-full min-w-0 flex-1 border-0 bg-transparent font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground"
          oninput={(event) => searchRoom(event.currentTarget.value)}
          onkeydown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              searchRoom("");
              event.currentTarget.blur();
            }
          }}
        />{#if $roomSearchQuery}<IconButton
            label={t("Limpar busca")}
            tooltipSide="bottom"
            size="icon-xs"
            class="-mr-1.5 text-muted-foreground hover:text-foreground"
            onclick={() => searchRoom("")}
            ><Icon icon="x" size={14} /></IconButton
          >{/if}</label
      >{/if}
    {#if tabs}<div data-header-tabs class="hidden min-w-0 md:block">
        <DocumentToolbar
          {...tabs}
          bare
          exclude={header.room.book.dm
            ? ["agents", "board", "doc", "people", "search"]
            : ["agents", "board", "search"]}
          pane={split ? tabs.pane : ("" as DocumentPane)}
          onPane={pickPane}
        />
      </div>{/if}
    {#if $personal.me}<span data-phone-account class="contents md:hidden"
        ><AccountRow me={$personal.me} row={false} /></span
      >{/if}
  </div>
</header>
