<script lang="ts">
  import { untrack } from "svelte";
  import type { ComponentProps } from "svelte";
  import ThreadHeader from "../room-sidebar/ThreadHeader.svelte";
  import type { ThreadHeaderProps } from "../room-sidebar/types";
  import AgentTrigger from "../agents/AgentTrigger.svelte";
  import type { ApplicationRoomPresentation } from "../application/shellTypes";
  import type { RoomLayoutController } from "../room-layout/types";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    ArrowLeft,
    ChevronDown,
    Columns03,
    DotsHorizontal,
    File02,
    Inbox01,
    LayoutRight,
  } from "../../lib/studio/icons";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import { cn } from "../../lib/studio/utils";
  import { studioType } from "../../lib/components/type";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { suggestionAt } from "../room-sidebar/model";
  import { paneIcons, paneLabel } from "../documents/paneIcons";
  import type { DocumentPane } from "../documents/types";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Count from "../../lib/components/Count.svelte";
  import { isPanelToggleKey } from "./panelViews";
  let {
    presentation,
    header,
    trigger,
    layout,
    current,
    boardCount,
    panes,
    back,
  }: {
    presentation: ApplicationRoomPresentation;
    header: ThreadHeaderProps;
    trigger: ComponentProps<typeof AgentTrigger> | null;
    layout: RoomLayoutController;
    current(): boolean;
    boardCount?: number | string;
    /** The room panels (the doc sheet's tabs): on a phone they live in the ⋯ menu. */
    panes?: {
      counts?: Partial<Record<DocumentPane, number | string>>;
      onPane(pane: DocumentPane): void;
    };
    back(expectedThread: string): void;
  } = $props();
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
  const morePanes: DocumentPane[] = [
    "files",
    "apps",
    "decisions",
    "reminders",
    "agents",
  ];
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
  class="tw:@container/room-header tw:flex tw:min-w-0 tw:flex-1 tw:flex-wrap tw:items-center tw:gap-1 tw:font-sans tw:text-sm tw:text-foreground tw:min-[901px]:flex-nowrap"
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
  <div
    class="tw:hidden tw:min-w-0 tw:flex-1 tw:basis-0 tw:min-[901px]:flex tw:min-[901px]:min-w-24"
  >
    <ThreadHeader {...header} compact />
  </div>
  <div
    class="tw:contents tw:min-[901px]:flex tw:min-[901px]:shrink-0 tw:min-[901px]:items-center tw:min-[901px]:justify-end tw:min-[901px]:gap-1"
  >
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
        icon={Columns03}
        size={16}
      />{#if typeof boardCount === "number" && boardCount}<Count
          value={boardCount}
          label={t("Esperando você: {n}", { n: boardCount })}
          class="tw:absolute tw:-top-1 tw:-right-1 tw:shadow-[0_0_0_2px_var(--vb-background)]"
        />{/if}</IconButton
    >
    {#if panes}<IconButton
        data-native-phone-doc
        label="Doc"
        size="icon"
        aria-pressed={$geometry.sheet === "doc" && $geometry.pane === "doc"}
        class="tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:aria-pressed:bg-accent tw:aria-pressed:text-foreground tw:min-[901px]:hidden"
        onclick={(event) => {
          if (live(event)) panes.onPane("doc");
        }}><Icon icon={File02} size={16} /></IconButton
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
    <div class="tw:contents">
      <!-- Desktop: the agent icon leads the icon buttons on the right. -->
      {#if trigger}<div
          class="tw:flex tw:max-[900px]:hidden tw:min-[901px]:order-first tw:min-[901px]:mr-1"
        >
          <AgentTrigger {...trigger} />
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
      {#if panes}<span class="tw:contents tw:min-[901px]:hidden"
          ><DropdownMenu>
            <DropdownMenuTrigger
              data-native-phone-more
              aria-label={t("Mais opções")}
              class={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "tw:relative tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:min-[901px]:hidden",
              )}
              ><Icon
                icon={DotsHorizontal}
                size={16}
              />{#if typeof boardCount === "number" && boardCount}<Count
                  value={boardCount}
                  label={t("Esperando você: {n}", { n: boardCount })}
                  class="tw:absolute tw:-top-1 tw:-right-1 tw:shadow-[0_0_0_2px_var(--vb-background)]"
                />{/if}</DropdownMenuTrigger
            >
            <DropdownMenuContent
              data-vb-native
              align="end"
              class={cn(studioType, "tw:w-56")}
            >
              <DropdownMenuItem
                data-phone-pane="board"
                onSelect={() => {
                  if (current()) layout.toggleBoard();
                }}
                ><Icon icon={Columns03} /><span class="tw:flex-1"
                  >{t("Quadro de tarefas (kanban)")}</span
                >{#if typeof boardCount === "number" && boardCount}<Count
                    value={boardCount}
                    label={t("Esperando você: {n}", { n: boardCount })}
                  />{/if}</DropdownMenuItem
              >
              {#each morePanes as pane (pane)}<DropdownMenuItem
                  data-phone-pane={pane}
                  onSelect={() => {
                    if (current()) panes.onPane(pane);
                  }}
                  ><Icon icon={paneIcons[pane]} /><span class="tw:flex-1"
                    >{paneLabel(pane, en)}</span
                  >{#if panes.counts?.[pane]}<span
                      class="tw:text-xs tw:text-muted-foreground tw:tabular-nums"
                      >{panes.counts[pane]}</span
                    >{/if}</DropdownMenuItem
                >{/each}
            </DropdownMenuContent>
          </DropdownMenu></span
        >{/if}
    </div>
  </div>
</header>
