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
    Columns03,
    Inbox01,
    LayoutRight,
  } from "../../lib/studio/icons";
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
    back,
  }: {
    presentation: ApplicationRoomPresentation;
    header: ThreadHeaderProps;
    trigger: ComponentProps<typeof AgentTrigger> | null;
    layout: RoomLayoutController;
    current(): boolean;
    boardCount?: number | string;
    back(expectedThread: string): void;
  } = $props();
  const personal = untrack(() => presentation.services.personal.state),
    geometry = untrack(() => layout.state);
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const waits = $derived($personal.me?.waits ?? []);
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
  <div
    class="tw:flex tw:min-w-0 tw:flex-1 tw:basis-0 tw:min-[901px]:min-w-[16rem]"
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
      class="tw:relative tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground tw:aria-pressed:bg-accent tw:aria-pressed:text-foreground"
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
    <div
      class="tw:flex tw:basis-full tw:items-center tw:justify-between tw:gap-1 tw:min-[901px]:contents"
    >
      {#if trigger}<AgentTrigger {...trigger} />{/if}
      <IconButton
        data-native-document-toggle
        label={toggleLabel}
        tooltipSide="bottom"
        size="icon"
        aria-pressed={$geometry.documentVisible}
        aria-keyshortcuts={mac ? "Alt+Meta+B" : "Control+Alt+B"}
        class="tw:rounded-full tw:text-muted-foreground tw:hover:text-foreground"
        onclick={(event) => {
          if (live(event)) layout.toggleDocument();
        }}><Icon icon={LayoutRight} size={16} /></IconButton
      >
    </div>
  </div>
</header>
