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
    "tw:h-[1.125rem] tw:min-w-[1.125rem] tw:bg-brand tw:px-1 tw:leading-none tw:tabular-nums tw:text-brand-foreground",
    className,
  )}>{value}</Badge
>
