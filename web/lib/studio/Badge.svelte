<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLAttributes } from "svelte/elements";
  import { badgeVariants, type BadgeVariants } from "./badge";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Badge`. `asChild` became `href` for a link and the `child` snippet for any other element. */
  let {
    variant,
    size,
    href,
    class: className,
    ref = $bindable(null),
    child,
    children,
    ...rest
  }: BadgeVariants &
    Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> &
    Pick<HTMLAnchorAttributes, "href" | "target" | "rel" | "download"> & {
      class?: string;
      ref?: HTMLElement | null;
      child?: Snippet<[{ props: Record<string, unknown> }]>;
      children?: Snippet;
    } = $props();
  const classes = $derived(cn(badgeVariants({ variant, size }), className));
</script>

{#if child}
  {@render child({ props: { "data-slot": "badge", ...rest, class: classes } })}
{:else if href !== undefined && href !== null}
  <a bind:this={ref} data-slot="badge" {href} {...rest} class={classes}
    >{@render children?.()}</a
  >
{:else}
  <span bind:this={ref} data-slot="badge" {...rest} class={classes}
    >{@render children?.()}</span
  >
{/if}
