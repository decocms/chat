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

<!-- svelte-ignore a11y_no_redundant_roles -->
<nav
  bind:this={ref}
  role="navigation"
  aria-label="pagination"
  data-slot="pagination"
  {...rest}
  class={cn("tw:mx-auto tw:flex tw:w-full tw:justify-center", className)}
>
  {@render children?.()}
</nav>
