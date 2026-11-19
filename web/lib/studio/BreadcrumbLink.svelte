<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** `child` stands in for React's `asChild`: render your own link and spread `props` on it. */
  let {
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: Omit<HTMLAnchorAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLAnchorElement | null;
    child?: Snippet<[{ props: Record<string, unknown> }]>;
    children?: Snippet;
  } = $props();
  const classes = $derived(
    cn("hover:text-foreground transition-colors truncate", className),
  );
</script>

{#if child}
  {@render child({
    props: { "data-slot": "breadcrumb-link", ...rest, class: classes },
  })}
{:else}
  <a bind:this={ref} data-slot="breadcrumb-link" {...rest} class={classes}
    >{@render children?.()}</a
  >
{/if}
