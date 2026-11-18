<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** A plain heading row, as in React: it does not need to sit inside a group. */
  let {
    class: className,
    inset,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    inset?: boolean;
    ref?: HTMLDivElement | null;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="dropdown-menu-label"
  data-inset={inset}
  {...rest}
  class={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
>
  {@render children?.()}
</div>
