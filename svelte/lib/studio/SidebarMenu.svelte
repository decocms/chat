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
    "tw:flex tw:w-full tw:min-w-0 tw:list-none tw:flex-col tw:gap-1 tw:group-data-[state=collapsed]/sidebar:items-center",
    className,
  )}
>
  {@render children?.()}
</ul>
