<script lang="ts" module>
  export type MetricStatus = "success" | "warning" | "error";

  const STATUS_TEXT: Record<MetricStatus, string> = {
    success: "tw:text-success",
    warning: "tw:text-warning",
    error: "tw:text-destructive",
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
  class={cn("tw:@container/metric tw:gap-6", className)}
  {...rest}
>
  <div class="tw:flex tw:flex-col tw:gap-2">
    <div
      class="tw:text-muted-foreground tw:flex tw:min-h-7 tw:items-center tw:gap-2 tw:text-sm tw:[&_svg]:size-4 tw:[&_svg]:shrink-0 tw:[&_svg]:stroke-[1.33]"
    >
      {@render icon?.()}
      <span class="tw:min-w-0 tw:flex-1 tw:truncate"
        >{@render content(label)}</span
      >
      {@render action?.()}
    </div>
    {#if value !== undefined}
      <div class="tw:flex tw:items-end tw:gap-3">
        <span
          class="tw:font-medium tw:tracking-[-0.02em] tw:text-balance tw:tabular-nums tw:min-w-0 tw:flex-1 tw:truncate tw:text-[2rem] tw:leading-[1.15]"
          >{@render content(value)}</span
        >
        {@render trend?.()}
      </div>
    {/if}
    {#if caption}
      <p
        class={cn(
          "tw:text-xs tw:text-pretty",
          status ? STATUS_TEXT[status] : "tw:text-muted-foreground",
        )}
      >
        {@render content(caption)}
      </p>
    {/if}
  </div>
  {@render children?.()}
</Card>
