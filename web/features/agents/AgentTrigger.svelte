<script lang="ts">
  import { untrack } from "svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import AgentMark from "./AgentMark.svelte";
  import type { RoomAgentSession } from "./room";
  import { agentMark, agentPresence, agentStatus } from "./model";
  import { runnerPath } from "./runner";
  import { agentMarkLabel } from "./roomCopy";
  let {
    owner,
    onopen,
    lang = "pt",
    queue = [],
    row = false,
    origin: _origin = "",
  }: {
    owner: RoomAgentSession;
    onopen(): void;
    lang?: "pt" | "en";
    /** What you asked here that no agent of yours closed (`agentQueue`). */
    queue?: readonly { phase: string | null }[];
    /** The sidebar footer (desktop): a full-width row with the state written out. */
    row?: boolean;
    /** Used by the expanded foot (AgentFoot), which shares these props. */
    origin?: string;
  } = $props();
  const view = untrack(() => owner.state),
    runner = untrack(() => owner.runner.state);
  const presence = $derived(
    agentPresence($view.data, owner.account, $view.now),
  );
  const status = $derived(
    agentStatus(presence, $view.hasAgent, $view.askedAt, $view.now),
  );
  const mark = $derived(agentMark(status, queue));
  const path = $derived(runnerPath($runner.where));
  const label = $derived(
    `${agentMarkLabel(lang, mark.state, status, mark.count)}${path ? ` · ${path}` : ""}`,
  );
</script>

{#if $view.data && row}<button
    type="button"
    data-agent-trigger
    data-agent-status={mark.state}
    title={label}
    class="flex h-11 w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-lg border-0 bg-transparent px-2.5 text-left font-sans text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring"
    onclick={() => {
      if (owner.current()) onopen();
    }}
    ><span class="relative flex size-7 shrink-0 items-center justify-center"
      ><AgentMark state={mark.state} count={mark.count} on={mark.on} /></span
    ><span class="min-w-0 flex-1 truncate">{label}</span></button
  >{:else if $view.data}<IconButton
    data-agent-trigger
    data-agent-status={mark.state}
    {label}
    tooltipSide="bottom"
    size="icon"
    class="relative rounded-full"
    onclick={() => {
      if (owner.current()) onopen();
    }}
    ><AgentMark
      state={mark.state}
      count={mark.count}
      on={mark.on}
    /></IconButton
  >{/if}
