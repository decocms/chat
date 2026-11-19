<script lang="ts">
  import Button from "../studio/Button.svelte";
  import Icon from "../studio/Icon.svelte";
  import { cn } from "../studio/utils";
  let {
    title,
    description,
    compact = false,
    onretry,
    retryLabel,
  }: { title: string; description?: string; compact?: boolean } & (
    | { onretry: () => void; retryLabel: string }
    | { onretry?: never; retryLabel?: never }
  ) = $props();
</script>

<div
  role="alert"
  class={cn(
    "flex items-start gap-3 rounded-control border border-destructive/20 bg-destructive/10 font-sans text-sm text-foreground",
    compact ? "p-3" : "p-5",
  )}
>
  <Icon
    icon="alert-triangle"
    size={16}
    class="mt-0.5 shrink-0 text-destructive"
  />
  <div class="min-w-0 flex-1 space-y-1">
    <p class="m-0 font-medium">{title}</p>
    {#if description}<p class="m-0 leading-5 text-foreground">
        {description}
      </p>{/if}{#if onretry && retryLabel}<Button
        variant="outline"
        size="sm"
        onclick={onretry}>{retryLabel}</Button
      >{/if}
  </div>
</div>
