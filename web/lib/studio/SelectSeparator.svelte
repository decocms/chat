<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Bits UI has no select separator; Radix renders exactly this hidden rule. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLDivElement | null;
  } = $props();
</script>

<div
  bind:this={ref}
  aria-hidden="true"
  data-slot="select-separator"
  {...rest}
  class={cn("bg-border pointer-events-none -mx-1 my-1 h-px", className)}
></div>
