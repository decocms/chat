<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { SIDEBAR_SKELETON_WIDTHS } from "./sidebar";
  import Skeleton from "./Skeleton.svelte";
  import { cn } from "./utils";

  /** A placeholder row; its text bar takes a random width between 50% and 89%, picked once. */
  let {
    class: className,
    showIcon = false,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    showIcon?: boolean;
    ref?: HTMLDivElement | null;
  } = $props();

  const width = SIDEBAR_SKELETON_WIDTHS[Math.floor(Math.random() * 40)];
</script>

<div
  bind:this={ref}
  data-slot="sidebar-menu-skeleton"
  data-sidebar="menu-skeleton"
  {...rest}
  class={cn(
    "tw:flex tw:h-10 tw:items-center tw:gap-2 tw:rounded-md tw:px-2",
    className,
  )}
>
  {#if showIcon}
    <Skeleton
      class="tw:size-4 tw:rounded-md"
      data-sidebar="menu-skeleton-icon"
    />
  {/if}
  <Skeleton
    class={cn("tw:h-4 tw:flex-1", width)}
    data-sidebar="menu-skeleton-text"
  />
</div>
