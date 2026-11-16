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
  class={cn(
    "tw:bg-border tw:pointer-events-none tw:-mx-1 tw:my-1 tw:h-px",
    className,
  )}
></div>
