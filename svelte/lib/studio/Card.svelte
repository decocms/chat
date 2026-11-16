<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cardVariants, type CardVariants } from "./card";
  import { cn } from "./utils";

  /** A titled group or one thing you open. `child` stands in for React's `asChild`: spread `props` on your own element. */
  let {
    size,
    interactive,
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: CardVariants &
    Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> & {
      class?: string;
      ref?: HTMLDivElement | null;
      child?: Snippet<[{ props: Record<string, unknown> }]>;
      children?: Snippet;
    } = $props();
  const classes = $derived(cn(cardVariants({ size, interactive }), className));
</script>

{#if child}
  {@render child({ props: { "data-slot": "card", ...rest, class: classes } })}
{:else}
  <div bind:this={ref} data-slot="card" {...rest} class={classes}>
    {@render children?.()}
  </div>
{/if}
