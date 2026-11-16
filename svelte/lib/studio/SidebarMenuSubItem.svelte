<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLiAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `SidebarMenuSubItem`. */
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
  data-slot="sidebar-menu-sub-item"
  data-sidebar="menu-sub-item"
  {...rest}
  class={cn("tw:group/menu-sub-item tw:relative", className)}
>
  {@render children?.()}
</li>
