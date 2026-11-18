<script lang="ts">
  import Count from "../../lib/components/Count.svelte";
  import { cn } from "../../lib/studio/utils";
  import { waitIndicator, type WaitReference } from "./model";
  let {
    waits,
    label,
    taskLabel,
    solid = false,
    surface = "sidebar",
    class: className = "",
  }: {
    waits: readonly WaitReference[];
    label: (count: number) => string;
    taskLabel: string;
    /** Ringed in the surface colour, for sitting on top of an avatar tile. */
    solid?: boolean;
    /** The colour behind the avatar the badge sits on. */
    surface?: "sidebar" | "background";
    class?: string;
  } = $props();
  const indicator = $derived(waitIndicator(waits));
  const ring = $derived(
    surface === "sidebar" ? "ring-2 ring-sidebar" : "ring-2 ring-background",
  );
</script>

{#if indicator.asks}<span
    data-wait-kind="asks"
    data-wait-from={indicator.claude ? "claude" : "person"}
    class={cn("inline-flex shrink-0", className)}
    ><Count
      value={indicator.asks}
      label={label(indicator.asks)}
      class={solid ? ring : ""}
    /></span
  >{:else if indicator.tasks}<span
    data-wait-kind="tasks"
    role="img"
    aria-label={taskLabel}
    title={taskLabel}
    class={cn(
      "inline-block size-2 shrink-0 rounded-full bg-brand ring-1 ring-brand-foreground/30",
      solid && ring,
      className,
    )}
  ></span>{/if}
