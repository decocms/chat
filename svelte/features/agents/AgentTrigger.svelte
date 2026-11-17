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
  }: {
    owner: RoomAgentSession;
    onopen(): void;
    lang?: "pt" | "en";
    /** What you asked here that no agent of yours closed (`agentQueue`). */
    queue?: readonly { phase: string | null }[];
    /** The sidebar footer (desktop): a full-width row with the state written out. */
    row?: boolean;
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
    data-native-agent-trigger
    data-agent-status={mark.state}
    title={label}
    class="tw:flex tw:h-11 tw:w-full tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-2.5 tw:rounded-lg tw:border-0 tw:bg-sidebar-accent/60 tw:px-2.5 tw:text-left tw:font-sans tw:text-sm tw:text-sidebar-foreground tw:transition-colors tw:hover:bg-sidebar-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring"
    onclick={() => {
      if (owner.current()) onopen();
    }}
    ><span
      class="tw:relative tw:flex tw:size-7 tw:shrink-0 tw:items-center tw:justify-center"
      ><AgentMark state={mark.state} count={mark.count} on={mark.on} /></span
    ><span class="tw:min-w-0 tw:flex-1 tw:truncate">{label}</span></button
  >{:else if $view.data}<IconButton
    data-native-agent-trigger
    data-agent-status={mark.state}
    {label}
    tooltipSide="bottom"
    size="icon"
    class="tw:relative tw:rounded-full"
    onclick={() => {
      if (owner.current()) onopen();
    }}
    ><AgentMark
      state={mark.state}
      count={mark.count}
      on={mark.on}
    /></IconButton
  >{/if}
