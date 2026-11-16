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
  data-slot="card-title"
  {...rest}
  class={cn("tw:text-sm tw:font-medium", className)}
>
  {@render children?.()}
</div>
