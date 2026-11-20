<script lang="ts">
  import Badge from "../studio/Badge.svelte";
  import { cn } from "../studio/utils";

  /** How many things wait on you somewhere: the one notification count of the app, and the only lime in it. */
  let {
    value,
    label,
    class: className,
  }: { value: number; label: string; class?: string } = $props();
</script>

<Badge
  role="img"
  aria-label={label}
  title={label}
  data-count={value}
  class={cn(
    "h-[1.125rem] min-w-[1.125rem] bg-brand px-1 shadow-none leading-none tabular-nums text-brand-foreground",
    className,
  )}>{value}</Badge
>
