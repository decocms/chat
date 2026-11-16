<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** `child` stands in for React's `asChild`: spread `props` on your own element. */
  let {
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLDivElement | null;
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    children?: Snippet;
  } = $props();
  const classes = $derived(
    cn(
      "tw:bg-muted tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:px-4 tw:text-sm tw:font-medium tw:shadow-xs tw:[&_svg]:pointer-events-none tw:[&_svg:not([class*='size-'])]:size-4",
      className,
    ),
  );
</script>

{#if child}
  {@render child({ props: { ...rest, class: classes } })}
{:else}
  <div bind:this={ref} {...rest} class={classes}>{@render children?.()}</div>
{/if}
