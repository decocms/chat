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
    blocked: "bg-destructive",
    busy: "bg-warning",
    queued: "bg-warning",
    working: "bg-brand",
    listening: "bg-brand",
    opening: "bg-warning",
    late: "border-2 border-warning bg-background",
    off: "",
    none: "border-2 border-muted-foreground bg-background",
  };
  const counted = $derived(
    count > 0 &&
      (state === "blocked" || state === "busy" || state === "queued"),
  );
  const pulse = $derived(state === "blocked" || state === "opening");
</script>

<span
  data-agent-mark={state}
  class="relative inline-grid place-items-center leading-none"
  ><Icon
    icon={paneIcons.agents}
    {size}
    stroke-width="2.6"
    class={cn(
      on ? "text-agent-claude-text" : "text-muted-foreground",
      (state === "working" || state === "busy") &&
        "animate-[spin_3s_linear_infinite] motion-reduce:animate-none",
    )}
  />{#if counted}<span
      aria-hidden="true"
      class={cn(
        "absolute -right-2 -bottom-1.5 h-4 min-w-4 rounded-full px-1 text-center font-sans text-[0.625rem] leading-4 font-bold tabular-nums shadow-[0_0_0_2px_var(--vb-background)]",
        // A count is text: white on the warning orange is under 4.5:1, so work
        // waiting uses the app's one count style (lime, as Count); blocked stays red.
        state === "blocked"
          ? "bg-destructive text-destructive-foreground"
          : "bg-brand text-brand-foreground",
        pulse && "animate-pulse motion-reduce:animate-none",
      )}>{count > 99 ? "99+" : count}</span
    >{:else if tone[state]}<span
      aria-hidden="true"
      class={cn(
        "absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full shadow-[0_0_0_2px_var(--vb-background)]",
        tone[state],
        pulse && "animate-pulse motion-reduce:animate-none",
      )}
    ></span>{/if}</span
>
