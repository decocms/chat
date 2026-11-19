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
      "bg-muted flex items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
      className,
    ),
  );
</script>

{#if child}
  {@render child({ props: { ...rest, class: classes } })}
{:else}
  <div bind:this={ref} {...rest} class={classes}>{@render children?.()}</div>
{/if}
