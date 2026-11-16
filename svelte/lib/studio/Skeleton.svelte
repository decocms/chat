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
    "tw:bg-secondary-hover tw:animate-pulse tw:rounded-md tw:motion-reduce:[animation-duration:0.01ms] tw:motion-reduce:[animation-iteration-count:1]",
    className,
  )}
>
  {@render children?.()}
</div>
