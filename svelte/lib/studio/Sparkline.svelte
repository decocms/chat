<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** A trend in a glance: thin purple bars, bottom-aligned, 20px tall. One bar per value, oldest first. */
  let {
    values,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLSpanElement>, "style" | "class" | "children"> & {
    values: readonly number[];
    class?: string;
    ref?: HTMLSpanElement | null;
  } = $props();
  const max = $derived(Math.max(...values, 0));
</script>

<span
  bind:this={ref}
  data-slot="sparkline"
  aria-hidden="true"
  {...rest}
  class={cn(
    "tw:inline-flex tw:h-5 tw:shrink-0 tw:items-end tw:gap-0.5",
    className,
  )}
>
  {#each values as value, index (index)}
    <!-- An svg box takes its height from an attribute, where a span would need an inline style. -->
    <svg
      class="tw:w-0.5 tw:rounded-[1px] tw:bg-brand-purple"
      height={`${max > 0 ? Math.max(8, (value / max) * 100) : 8}%`}
    ></svg>
  {/each}
</span>
