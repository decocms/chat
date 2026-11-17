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
  }: {
    owner: RoomAgentSession;
    onopen(): void;
    lang?: "pt" | "en";
    /** What you asked here that no agent of yours closed (`agentQueue`). */
    queue?: readonly { phase: string | null }[];
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

{#if $view.data}<IconButton
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
