<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import { paneIcons } from "../documents/paneIcons";
  import type { AgentMarkState } from "./model";
  /**
   * The agent's ✻ with its one badge, bottom right: a dot when nothing waits on
   * the agent, a count when something does. Hollow = needs you, a number = work
   * waiting, motion = changing (the star turns while it works). Same mark in the
   * room header, the doc tabs and the phone bar.
   */
  let {
    state,
    count = 0,
    on = false,
    size = 20,
  }: {
    state: AgentMarkState;
    count?: number;
    on?: boolean;
    size?: number;
  } = $props();
  const tone: Record<AgentMarkState, string> = {
    blocked: "tw:bg-destructive",
    busy: "tw:bg-warning",
    queued: "tw:bg-warning",
    working: "tw:bg-brand",
    listening: "tw:bg-brand",
    opening: "tw:bg-warning",
    late: "tw:border-2 tw:border-warning tw:bg-background",
    off: "",
    none: "tw:border-2 tw:border-muted-foreground tw:bg-background",
  };
  const counted = $derived(
    count > 0 &&
      (state === "blocked" || state === "busy" || state === "queued"),
  );
  const pulse = $derived(state === "blocked" || state === "opening");
</script>

<span
  data-agent-mark={state}
  class="tw:relative tw:inline-grid tw:place-items-center tw:leading-none"
  ><Icon
    icon={paneIcons.agents}
    {size}
    stroke-width="2.6"
    class={cn(
      on ? "tw:text-agent-claude-text" : "tw:text-muted-foreground",
      (state === "working" || state === "busy") &&
        "tw:animate-[spin_3s_linear_infinite] tw:motion-reduce:animate-none",
    )}
  />{#if counted}<span
      aria-hidden="true"
      class={cn(
        "tw:absolute tw:-right-2 tw:-bottom-1.5 tw:h-4 tw:min-w-4 tw:rounded-full tw:px-1 tw:text-center tw:font-sans tw:text-[0.625rem] tw:leading-4 tw:font-bold tw:tabular-nums tw:shadow-[0_0_0_2px_var(--vb-background)]",
        tone[state],
        state === "blocked"
          ? "tw:text-destructive-foreground"
          : "tw:text-warning-foreground",
        pulse && "tw:animate-pulse tw:motion-reduce:animate-none",
      )}>{count > 99 ? "99+" : count}</span
    >{:else if tone[state]}<span
      aria-hidden="true"
      class={cn(
        "tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2.5 tw:rounded-full tw:shadow-[0_0_0_2px_var(--vb-background)]",
        tone[state],
        pulse && "tw:animate-pulse tw:motion-reduce:animate-none",
      )}
    ></span>{/if}</span
>
