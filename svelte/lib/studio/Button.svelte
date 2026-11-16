<script lang="ts">
  import type { Snippet } from "svelte";
  import type {
    HTMLAnchorAttributes,
    HTMLAttributes,
    HTMLButtonAttributes,
  } from "svelte/elements";
  import { buttonVariants, type ButtonVariants } from "./button";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Button`. With `href` it renders a link, which is what `asChild` was used for. */
  let {
    variant,
    size,
    href,
    type = "button",
    disabled,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: ButtonVariants &
    Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> &
    Pick<
      HTMLButtonAttributes,
      "type" | "disabled" | "name" | "value" | "form"
    > &
    Pick<HTMLAnchorAttributes, "href" | "target" | "rel" | "download"> & {
      class?: string;
      ref?: HTMLElement | null;
      children?: Snippet;
    } = $props();
  const classes = $derived(cn(buttonVariants({ variant, size }), className));
</script>

{#if href !== undefined && href !== null}
  <a bind:this={ref} data-slot="button" {href} {...rest} class={classes}
    >{@render children?.()}</a
  >
{:else}
  <button
    bind:this={ref}
    {type}
    {disabled}
    data-slot="button"
    {...rest}
    class={classes}>{@render children?.()}</button
  >
{/if}
