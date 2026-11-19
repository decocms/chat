<script lang="ts">
  import { untrack } from "svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Count from "../../lib/components/Count.svelte";
  import { cn } from "../../lib/studio/utils";
  import { paneIcons, paneLabel } from "../documents/paneIcons";
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
    { id: "chat", label: "Chat", icon: "message-circle-01" },
    { id: "doc", label: "Doc", icon: paneIcons.doc },
    { id: "board", label: en ? "Board" : "Quadro", icon: paneIcons.board },
    { id: "files", label: en ? "Files" : "Arquivos", icon: paneIcons.files },
    {
      id: "claude",
      label: paneLabel("agents", en),
      icon: paneIcons.agents,
    },
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
  data-phone-tabs
  aria-label={en ? "Room" : "Sala"}
  class="grid grid-cols-5 border-t border-border bg-background px-1 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] font-sans"
>
  {#each tabs as tab (tab.id)}
    {@const on = selected === tab.id}
    <button
      type="button"
      data-phone-tab={tab.id}
      title={tab.id === "claude" ? agentTitle : undefined}
      aria-current={on ? "page" : undefined}
      class={cn(
        "relative flex min-w-0 cursor-pointer flex-col items-center gap-0.5 rounded-lg border-0 bg-transparent py-1 text-[0.6875rem] leading-4 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        on && "font-semibold text-foreground",
      )}
      onclick={(event) => choose(event, tab.id)}
      ><span
        class={cn(
          "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150 motion-reduce:transition-none",
          on && "bg-accent",
        )}
        >{#if tab.id === "claude"}<AgentMark
            state={agent.state}
            count={agent.count}
            on={agent.on}
            size={18}
          />{:else}<Icon icon={tab.icon} size={18} />{/if}</span
      ><span class="max-w-full truncate">{tab.label}</span
      >{#if tab.id === "board" && typeof boardCount === "number" && boardCount}<Count
          value={boardCount}
          label={en
            ? `Waiting on you: ${boardCount}`
            : `Esperando você: ${boardCount}`}
          class="absolute top-0 left-[calc(50%+0.375rem)] shadow-[0_0_0_2px_var(--vb-background)]"
        />{/if}</button
    >
  {/each}
</nav>
