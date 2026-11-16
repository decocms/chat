<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

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
  data-slot="card-header"
  {...rest}
  class={cn(
    "tw:grid tw:auto-rows-min tw:items-start tw:gap-1 tw:has-data-[slot=card-action]:grid-cols-[1fr_auto]",
    className,
  )}
>
  {@render children?.()}
</div>
