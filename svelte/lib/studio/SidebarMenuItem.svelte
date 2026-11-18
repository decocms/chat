<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLiAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `SidebarMenuItem`. */
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
  data-slot="sidebar-menu-item"
  data-sidebar="menu-item"
  {...rest}
  class={cn("group/menu-item relative w-full list-none", className)}
>
  {@render children?.()}
</li>
