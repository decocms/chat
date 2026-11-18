<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `SidebarGroup`. */
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
  data-slot="sidebar-group"
  data-sidebar="group"
  {...rest}
  class={cn(
    "tw:relative tw:flex tw:w-full tw:min-w-0 tw:flex-col tw:px-2 tw:py-2 tw:min-[901px]:py-0",
    className,
  )}
>
  {@render children?.()}
</div>
