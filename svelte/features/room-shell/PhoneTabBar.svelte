<script lang="ts">
  import { untrack } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Count from "../../lib/components/Count.svelte";
  import { cn } from "../../lib/studio/utils";
  import { MessageCircle01 } from "../../lib/studio/icons";
  import { paneIcons } from "../documents/paneIcons";
  import AgentMark from "../agents/AgentMark.svelte";
  import type { AgentMarkView } from "../agents/model";
  import type { DocumentPane } from "../documents/types";
  import type { RoomLayoutController } from "../room-layout/types";
  import { phoneTab, phoneTabPanes, type PhoneTab } from "./panelViews";
  /**
   * The phone room's bottom bar: Chat, Doc, Board, Files and Claude. Each tab
   * opens its panes (Doc and Decisions, Files and Apps, Agents and Reminders)
   * in the doc sheet; Board is the full-screen board; Chat closes both.
   */
  let {
    layout,
    current,
    lang,
    boardCount,
    agent = { state: "off", count: 0, on: false },
    agentTitle = "Claude",
    onPane,
  }: {
    layout: RoomLayoutController;
    current(): boolean;
    lang: string;
    boardCount?: number | string;
    /** The ✻ (`agentMark`), drawn as the Claude tab's icon. */
    agent?: AgentMarkView;
    agentTitle?: string;
    /** Opens a pane in the doc sheet (no toggle). */
    onPane(pane: DocumentPane): void;
  } = $props();
  const geometry = untrack(() => layout.state);
  const en = $derived(lang === "en");
  const selected = $derived(phoneTab($geometry));
  // Each tab reopens on the pane it last showed (Apps stays Apps).
  const last: Record<"doc" | "files" | "claude", DocumentPane> = {
    doc: "doc",
    files: "files",
    claude: "agents",
  };
  $effect(() => {
    const tab = selected;
    if (tab === "doc" || tab === "files" || tab === "claude")
      last[tab] = $geometry.pane;
  });
  const tabs = $derived<
    { id: PhoneTab; label: string; icon: (typeof paneIcons)[DocumentPane] }[]
  >([
    { id: "chat", label: "Chat", icon: MessageCircle01 },
    { id: "doc", label: "Doc", icon: paneIcons.doc },
    { id: "board", label: en ? "Board" : "Quadro", icon: paneIcons.board },
    { id: "files", label: en ? "Files" : "Arquivos", icon: paneIcons.files },
    { id: "claude", label: "Claude", icon: paneIcons.agents },
  ]);
  function choose(event: MouseEvent, tab: PhoneTab) {
    if (
      !current() ||
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected
    )
      return;
    const state = layout.read();
    if (tab === "chat") {
      if (state.boardFull) layout.toggleBoard();
      else if (state.sheet === "doc") layout.closeSheet();
      return;
    }
    if (tab === "board") {
      if (!state.boardFull) layout.toggleBoard();
      return;
    }
    const pane = phoneTabPanes[tab].includes(state.pane)
      ? state.pane
      : last[tab];
    if (selected === tab && state.pane === pane) return;
    onPane(pane);
  }
</script>

<nav
  data-vb-native
  data-native-phone-tabs
  aria-label={en ? "Room" : "Sala"}
  class="tw:grid tw:grid-cols-5 tw:border-t tw:border-border tw:bg-background tw:px-1 tw:pt-1 tw:pb-[max(0.375rem,env(safe-area-inset-bottom))] tw:font-sans"
>
  {#each tabs as tab (tab.id)}
    {@const on = selected === tab.id}
    <button
      type="button"
      data-phone-tab={tab.id}
      title={tab.id === "claude" ? agentTitle : undefined}
      aria-current={on ? "page" : undefined}
      class={cn(
        "tw:relative tw:flex tw:min-w-0 tw:cursor-pointer tw:flex-col tw:items-center tw:gap-0.5 tw:rounded-lg tw:border-0 tw:bg-transparent tw:py-1 tw:text-[0.6875rem] tw:leading-4 tw:text-muted-foreground tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring",
        on && "tw:font-semibold tw:text-foreground",
      )}
      onclick={(event) => choose(event, tab.id)}
      ><span
        class={cn(
          "tw:flex tw:h-7 tw:w-12 tw:items-center tw:justify-center tw:rounded-full tw:transition-colors tw:duration-150 tw:motion-reduce:transition-none",
          on && "tw:bg-accent",
        )}
        >{#if tab.id === "claude"}<AgentMark
            state={agent.state}
            count={agent.count}
            on={agent.on}
            size={18}
          />{:else}<Icon icon={tab.icon} size={18} />{/if}</span
      ><span class="tw:max-w-full tw:truncate">{tab.label}</span
      >{#if tab.id === "board" && typeof boardCount === "number" && boardCount}<Count
          value={boardCount}
          label={en
            ? `Waiting on you: ${boardCount}`
            : `Esperando você: ${boardCount}`}
          class="tw:absolute tw:top-0 tw:left-[calc(50%+0.375rem)] tw:shadow-[0_0_0_2px_var(--vb-background)]"
        />{/if}</button
    >
  {/each}
</nav>
