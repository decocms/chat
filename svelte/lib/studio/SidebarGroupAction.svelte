<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Hidden by default, as in React. `asChild` became the `child` snippet: spread `props` on your own element. */
  let {
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: Omit<HTMLButtonAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLButtonElement | null;
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    children?: Snippet;
  } = $props();
  const classes = $derived(cn("tw:hidden", className));
</script>

{#if child}
  {@render child({
    props: {
      "data-slot": "sidebar-group-action",
      "data-sidebar": "group-action",
      ...rest,
      class: classes,
    },
  })}
{:else}
  <button
    bind:this={ref}
    data-slot="sidebar-group-action"
    data-sidebar="group-action"
    {...rest}
    class={classes}
  >
    {@render children?.()}
  </button>
{/if}
