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
   * The top of the phone's title menu: the room's shortcuts (Doc, Board,
   * Files, Agents, Search). The bottom of a phone room is the composer's alone
   * (Gimenes #3738), so these left the bottom bar. A shortcut closes the menu,
   * then opens its panes in the doc sheet (Doc and Decisions, Files and Apps,
   * Agents and Reminders), the full-screen board, or the search.
   */
  let {
    layout,
    current,
    lang,
    dm = false,
    boardCount,
    agent = { state: "off", count: 0, on: false },
    agentTitle = "Claude",
    onPane,
    onsearch,
  }: {
    layout: RoomLayoutController;
    current(): boolean;
    lang: string;
    /** A DM has no doc, board or agents: only its files and the search. */
    dm?: boolean;
    boardCount?: number | string;
    /** The ✻ (`agentMark`), drawn as the Agents shortcut's icon. */
    agent?: AgentMarkView;
    agentTitle?: string;
    /** Opens a pane in the doc sheet (no toggle). */
    onPane(pane: DocumentPane): void;
    onsearch?: (trigger: HTMLElement) => void;
  } = $props();
  const geometry = untrack(() => layout.state);
  const en = $derived(lang === "en");
  const selected = $derived(phoneTab($geometry));
  // Each shortcut reopens on the pane it last showed (Apps stays Apps).
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
  type Shortcut = Exclude<PhoneTab, "chat"> | "search";
  const shortcuts = $derived<
    { id: Shortcut; label: string; icon: (typeof paneIcons)[DocumentPane] }[]
  >(
    [
      { id: "doc" as const, label: "Doc", icon: paneIcons.doc },
      {
        id: "board" as const,
        label: en ? "Board" : "Quadro",
        icon: paneIcons.board,
      },
      {
        id: "files" as const,
        label: en ? "Files" : "Arquivos",
        icon: paneIcons.files,
      },
      {
        id: "claude" as const,
        label: paneLabel("agents", en),
        icon: paneIcons.agents,
      },
      {
        id: "search" as const,
        label: en ? "Search" : "Buscar",
        icon: paneIcons.search,
      },
    ].filter(({ id }) => !dm || id === "files" || id === "search"),
  );
  function choose(event: MouseEvent, id: Shortcut) {
    const trigger = event.currentTarget;
    if (!current() || !(trigger instanceof HTMLElement) || !trigger.isConnected)
      return;
    const state = layout.read();
    if (state.sheet === "side") layout.closeSheet();
    if (id === "search") {
      onsearch?.(trigger);
      return;
    }
    if (id === "board") {
      if (!state.boardFull) layout.toggleBoard();
      return;
    }
    if (state.boardFull) layout.toggleBoard();
    onPane(phoneTabPanes[id].includes(state.pane) ? state.pane : last[id]);
  }
</script>

<nav
  data-phone-menu
  aria-label={en ? "Room" : "Sala"}
  class={cn(
    "grid gap-1 px-2 pt-1 font-sans",
    dm ? "grid-cols-2" : "grid-cols-5",
  )}
>
  {#each shortcuts as shortcut (shortcut.id)}
    <button
      type="button"
      data-phone-tab={shortcut.id}
      title={shortcut.id === "claude" ? agentTitle : undefined}
      class="group relative flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl border-0 bg-transparent py-1 text-xs leading-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onclick={(event) => choose(event, shortcut.id)}
      ><span
        class="flex size-12 items-center justify-center rounded-2xl bg-muted transition-[background-color,scale] duration-150 group-active:scale-95 group-hover:bg-secondary-hover motion-reduce:transition-none"
        >{#if shortcut.id === "claude"}<AgentMark
            state={agent.state}
            count={agent.count}
            on={agent.on}
            size={20}
          />{:else}<Icon icon={shortcut.icon} size={20} />{/if}</span
      ><span class="max-w-full truncate">{shortcut.label}</span
      >{#if shortcut.id === "board" && typeof boardCount === "number" && boardCount}<Count
          value={boardCount}
          label={en
            ? `Waiting on you: ${boardCount}`
            : `Esperando você: ${boardCount}`}
          class="absolute top-0 left-[calc(50%+0.875rem)] shadow-[0_0_0_2px_var(--vb-sidebar)]"
        />{/if}</button
    >
  {/each}
</nav>
