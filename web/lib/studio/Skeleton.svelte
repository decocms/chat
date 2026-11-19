<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Skeleton`. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLDivElement | null;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="skeleton"
  {...rest}
  class={cn(
    "bg-secondary-hover animate-pulse rounded-md motion-reduce:[animation-duration:0.01ms] motion-reduce:[animation-iteration-count:1]",
    className,
  )}
>
  {@render children?.()}
</div>
