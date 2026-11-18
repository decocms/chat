<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLUListElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLUListElement | null;
    children?: Snippet;
  } = $props();
</script>

<ul
  bind:this={ref}
  data-slot="pagination-content"
  {...rest}
  class={cn("flex flex-row items-center gap-1", className)}
>
  {@render children?.()}
</ul>
