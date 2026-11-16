<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Hidden by default, as in React. */
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
  data-slot="sidebar-menu-sub"
  data-sidebar="menu-sub"
  {...rest}
  class={cn("tw:hidden", className)}
>
  {@render children?.()}
</ul>
