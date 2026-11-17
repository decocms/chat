<script lang="ts">
  import { untrack } from "svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import type { RoomAgentSession } from "./room";
  import { agentPresence, agentStatus, type AgentStatus } from "./model";
  import { runnerPath } from "./runner";
  import { roomAgentText, type RoomAgentCopyKey } from "./roomCopy";
  let {
    owner,
    onopen,
    lang = "pt",
  }: { owner: RoomAgentSession; onopen(): void; lang?: "pt" | "en" } = $props();
  const view = untrack(() => owner.state),
    runner = untrack(() => owner.runner.state);
  const presence = $derived(
    agentPresence($view.data, owner.account, $view.now),
  );
  const status = $derived(
    agentStatus(presence, $view.hasAgent, $view.askedAt, $view.now),
  );
  const path = $derived(runnerPath($runner.where));
  const labels: Record<AgentStatus, RoomAgentCopyKey> = {
    none: "stateNone",
    off: "stateOff",
    opening: "stateOpening",
    late: "stateLate",
    listening: "stateListening",
    working: "stateWorking",
  };
  /** The dot says the state by shape too: hollow = needs you, solid = fine or off, pulsing = on its way. */
  const dots: Record<AgentStatus, string> = {
    none: "tw:border-2 tw:border-muted-foreground tw:bg-background",
    off: "tw:bg-muted-foreground",
    opening: "tw:bg-warning tw:animate-pulse tw:motion-reduce:animate-none",
    late: "tw:border-2 tw:border-warning tw:bg-background",
    listening: "tw:bg-brand",
    working: "tw:bg-brand",
  };
  const label = $derived(
    `${roomAgentText(lang, labels[status])}${path ? ` · ${path}` : ""}`,
  );
</script>

{#if $view.data}<IconButton
    data-native-agent-trigger
    data-agent-status={status}
    {label}
    tooltipSide="bottom"
    size="icon"
    class="tw:relative tw:rounded-full"
    onclick={() => {
      if (owner.current()) onopen();
    }}
    ><span
      aria-hidden="true"
      class={[
        "tw:inline-block tw:text-lg tw:leading-none",
        status === "none" || status === "off"
          ? "tw:text-muted-foreground"
          : "tw:text-agent-claude-text",
        status === "working" &&
          "tw:animate-[spin_3s_linear_infinite] tw:motion-reduce:animate-none",
      ]}>✻</span
    ><span
      aria-hidden="true"
      class={[
        "tw:absolute tw:right-1 tw:bottom-1 tw:size-2 tw:rounded-full tw:shadow-[0_0_0_2px_var(--vb-background)]",
        dots[status],
      ]}
    ></span></IconButton
  >{/if}
