<script lang="ts">
  import Badge from "../../lib/ui/Badge.svelte";
  import { cn } from "../../lib/ui/utils";
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
    /** Compact count chip with an opaque fill, for sitting on top of an avatar tile. */
    solid?: boolean;
    class?: string;
  } = $props();
  const indicator = $derived(waitIndicator(waits));
</script>

{#if indicator.asks}<Badge
    data-wait-kind="asks"
    variant={indicator.claude ? "destructive" : "warning"}
    aria-label={label(indicator.asks)}
    title={label(indicator.asks)}
    class={cn(
      solid &&
        "tw:h-4 tw:min-w-4 tw:justify-center tw:border-transparent tw:px-1 tw:py-0 tw:text-[10px] tw:leading-4 tw:font-semibold",
      solid &&
        (indicator.claude
          ? "tw:bg-destructive tw:text-destructive-foreground"
          : "tw:bg-warning tw:text-warning-foreground"),
      className,
    )}>{indicator.asks}</Badge
  >{:else if indicator.tasks}<span
    data-wait-kind="tasks"
    role="img"
    aria-label={taskLabel}
    title={taskLabel}
    class={[
      "tw:inline-block tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-warning",
      className,
    ]}
  ></span>{/if}
