<script lang="ts" module>
  export type MetricStatus = "success" | "warning" | "error";

  const STATUS_TEXT: Record<MetricStatus, string> = {
    success: "text-success",
    warning: "text-warning",
    error: "text-destructive",
  };
</script>

<script lang="ts">
  import type { ComponentProps, Snippet } from "svelte";
  import Card from "./Card.svelte";
  import { cn } from "./utils";

  /** A number, its label and what it compares to; children add a chart or a breakdown below. */
  let {
    label,
    icon,
    value,
    caption,
    status,
    trend,
    action,
    children,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<ComponentProps<typeof Card>, "size" | "title" | "child"> & {
    label: string | Snippet;
    /** A 16px icon before the label. */
    icon?: Snippet;
    value?: string | number | Snippet;
    /** What the value is measured against: a goal, last week. */
    caption?: string | Snippet;
    /** How the metric is doing; colours the caption. */
    status?: MetricStatus;
    /** A trend beside the value, usually a `Sparkline`. */
    trend?: Snippet;
    /** Top right: a range or metric picker. */
    action?: Snippet;
  } = $props();
</script>

{#snippet content(node: string | number | Snippet)}
  {#if typeof node === "function"}{@render node()}{:else}{node}{/if}
{/snippet}

<Card
  bind:ref
  data-slot="metric-card"
  class={cn("@container/metric gap-6", className)}
  {...rest}
>
  <div class="flex flex-col gap-2">
    <div
      class="text-muted-foreground flex min-h-7 items-center gap-2 text-sm [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.33]"
    >
      {@render icon?.()}
      <span class="min-w-0 flex-1 truncate">{@render content(label)}</span>
      {@render action?.()}
    </div>
    {#if value !== undefined}
      <div class="flex items-end gap-3">
        <span
          class="font-medium tracking-[-0.02em] text-balance tabular-nums min-w-0 flex-1 truncate text-[2rem] leading-[1.15]"
          >{@render content(value)}</span
        >
        {@render trend?.()}
      </div>
    {/if}
    {#if caption}
      <p
        class={cn(
          "text-xs text-pretty",
          status ? STATUS_TEXT[status] : "text-muted-foreground",
        )}
      >
        {@render content(caption)}
      </p>
    {/if}
  </div>
  {@render children?.()}
</Card>
