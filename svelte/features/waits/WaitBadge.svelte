<script lang="ts">
  import Count from "../../lib/components/Count.svelte";
  import { cn } from "../../lib/studio/utils";
  import { waitIndicator, type WaitReference } from "./model";
  let {
    waits,
    label,
    taskLabel,
    solid = false,
    class: className = "",
  }: {
    waits: readonly WaitReference[];
    label: (count: number) => string;
    taskLabel: string;
    /** Ringed in the surface colour, for sitting on top of an avatar tile. */
    solid?: boolean;
    class?: string;
  } = $props();
  const indicator = $derived(waitIndicator(waits));
</script>

{#if indicator.asks}<span
    data-wait-kind="asks"
    data-wait-from={indicator.claude ? "claude" : "person"}
    class={cn("tw:inline-flex tw:shrink-0", className)}
    ><Count
      value={indicator.asks}
      label={label(indicator.asks)}
      class={solid ? "tw:ring-2 tw:ring-sidebar" : ""}
    /></span
  >{:else if indicator.tasks}<span
    data-wait-kind="tasks"
    role="img"
    aria-label={taskLabel}
    title={taskLabel}
    class={cn(
      "tw:inline-block tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-brand tw:ring-1 tw:ring-brand-foreground/30",
      solid && "tw:ring-2 tw:ring-sidebar",
      className,
    )}
  ></span>{/if}
