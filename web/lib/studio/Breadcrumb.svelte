<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLElement | null;
    children?: Snippet;
  } = $props();
</script>

<nav
  bind:this={ref}
  aria-label="breadcrumb"
  data-slot="breadcrumb"
  {...rest}
  class={cn("min-w-0 overflow-hidden", className)}
>
  {@render children?.()}
</nav>
