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
  data-slot="card-action"
  {...rest}
  class={cn(
    "tw:col-start-2 tw:row-span-2 tw:row-start-1 tw:self-start tw:justify-self-end",
    className,
  )}
>
  {@render children?.()}
</div>
