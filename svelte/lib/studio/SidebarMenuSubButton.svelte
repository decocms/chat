<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Hidden by default, as in React. `asChild` became the `child` snippet: spread `props` on your own element. */
  let {
    isActive = false,
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: Omit<HTMLAnchorAttributes, "style" | "class" | "children"> & {
    isActive?: boolean;
    class?: string;
    ref?: HTMLAnchorElement | null;
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    children?: Snippet;
  } = $props();
  const classes = $derived(cn("tw:hidden", className));
</script>

{#if child}
  {@render child({
    props: {
      "data-slot": "sidebar-menu-sub-button",
      "data-sidebar": "menu-sub-button",
      "data-active": isActive,
      ...rest,
      class: classes,
    },
  })}
{:else}
  <a
    bind:this={ref}
    data-slot="sidebar-menu-sub-button"
    data-sidebar="menu-sub-button"
    data-active={isActive}
    {...rest}
    class={classes}
  >
    {@render children?.()}
  </a>
{/if}
