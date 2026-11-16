<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements";
  import { chipVariants, type ChipVariants } from "./chip";
  import { cn } from "./utils";

  /** An entity named inline: a goal, an area, an app. `asChild` became `href` for a link and the `child` snippet for any other element. */
  let {
    size,
    href,
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: ChipVariants &
    Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> &
    Pick<HTMLAnchorAttributes, "href" | "target" | "rel" | "download"> & {
      class?: string;
      ref?: HTMLElement | null;
      child?: Snippet<[{ props: Record<string, unknown> }]>;
      children?: Snippet;
    } = $props();
  const classes = $derived(cn(chipVariants({ size }), className));
</script>

{#if child}
  {@render child({ props: { "data-slot": "chip", ...rest, class: classes } })}
{:else if href !== undefined && href !== null}
  <a bind:this={ref} data-slot="chip" {href} {...rest} class={classes}
    >{@render children?.()}</a
  >
{:else}
  <span bind:this={ref} data-slot="chip" {...rest} class={classes}
    >{@render children?.()}</span
  >
{/if}
