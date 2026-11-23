<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import { paneIcons, paneLabel } from "../documents/paneIcons";
  import AgentMark from "../agents/AgentMark.svelte";
  import type { AgentMarkView } from "../agents/model";
  import type { DocumentPane } from "../documents/types";
  import { phonePanes } from "./panelViews";
  /**
   * The top of the phone's title menu: one shortcut for each of the room's
   * panes, in the desktop top bar's order (Gimenes #4076). The bottom of a
   * phone room is the composer's alone (Gimenes #3738). A shortcut closes the
   * menu, then opens its pane in the doc sheet.
   */
  let {
    current,
    lang,
    dm = false,
    agent = { state: "off", count: 0, on: false },
    agentTitle = "Claude",
    onPane,
  }: {
    current(): boolean;
    lang: string;
    /** A DM has no doc, people or agents: the same panes as its desktop bar. */
    dm?: boolean;
    /** The ✻ (`agentMark`), drawn as the Agents shortcut's icon. */
    agent?: AgentMarkView;
    agentTitle?: string;
    /** Opens a pane in the doc sheet (no toggle). */
    onPane(pane: DocumentPane): void;
  } = $props();
  const en = $derived(lang === "en");
  const shortcuts = $derived(phonePanes(dm));
  function choose(event: MouseEvent, pane: DocumentPane) {
    const trigger = event.currentTarget;
    if (!current() || !(trigger instanceof HTMLElement) || !trigger.isConnected)
      return;
    // The pane opens the doc sheet in the side sheet's own history entry: one
    // swap (the side slides out while the doc slides in), with no Back to wait for.
    onPane(pane);
  }
</script>

<nav
  data-phone-menu
  aria-label={en ? "Room" : "Sala"}
  class="grid grid-cols-4 gap-x-1 gap-y-3 px-2 pt-1 font-sans"
>
  {#each shortcuts as pane (pane)}
    <button
      type="button"
      data-phone-tab={pane}
      title={pane === "agents" ? agentTitle : undefined}
      class="group relative flex min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl border-0 bg-transparent py-1 text-xs leading-4 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onclick={(event) => choose(event, pane)}
      ><span
        class="flex size-12 items-center justify-center rounded-2xl bg-muted transition-[background-color,scale] duration-150 group-active:scale-95 group-hover:bg-secondary-hover motion-reduce:transition-none"
        >{#if pane === "agents"}<AgentMark
            state={agent.state}
            count={agent.count}
            on={agent.on}
            size={20}
          />{:else}<Icon icon={paneIcons[pane]} size={20} />{/if}</span
      ><span class="max-w-full truncate">{paneLabel(pane, en)}</span></button
    >
  {/each}
</nav>
