<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Hidden by default, as in React. `asChild` became the `child` snippet: spread `props` on your own element. */
  let {
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLDivElement | null;
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    children?: Snippet;
  } = $props();
  const classes = $derived(
    cn(
      "tw:hidden tw:shrink-0 tw:items-center tw:rounded-md tw:px-1 tw:py-1 tw:text-xs tw:font-medium tw:text-sidebar-foreground/70 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:[&>svg]:size-4 tw:[&>svg]:shrink-0",
      className,
    ),
  );
</script>

{#if child}
  {@render child({
    props: {
      "data-slot": "sidebar-group-label",
      "data-sidebar": "group-label",
      ...rest,
      class: classes,
    },
  })}
{:else}
  <div
    bind:this={ref}
    data-slot="sidebar-group-label"
    data-sidebar="group-label"
    {...rest}
    class={classes}
  >
    {@render children?.()}
  </div>
{/if}
