<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLiAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLLiAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLLIElement | null;
    children?: Snippet;
  } = $props();
</script>

<li
  bind:this={ref}
  data-slot="breadcrumb-item"
  {...rest}
  class={cn("tw:inline-flex tw:items-center tw:gap-1.5 tw:min-w-0", className)}
>
  {@render children?.()}
</li>
