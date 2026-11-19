<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLLiAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLLiAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLLIElement | null;
    children?: Snippet;
  } = $props();
</script>

<li
  bind:this={ref}
  data-slot="breadcrumb-separator"
  role="presentation"
  aria-hidden="true"
  {...rest}
  class={cn(
    "[&>svg]:size-3.5 text-muted-foreground opacity-50 list-none shrink-0",
    className,
  )}
>
  {#if children}{@render children()}{:else}<Icon icon="chevron-right" />{/if}
</li>
