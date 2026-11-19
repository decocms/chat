<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `SidebarMenu`. */
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
  data-slot="sidebar-menu"
  data-sidebar="menu"
  {...rest}
  class={cn(
    "flex w-full min-w-0 list-none flex-col gap-1 group-data-[state=collapsed]/sidebar:items-center",
    className,
  )}
>
  {@render children?.()}
</ul>
