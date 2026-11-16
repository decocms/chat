<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The 6px status dot that leads a badge, in the badge's own colour. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLSpanElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLSpanElement | null;
  } = $props();
</script>

<span
  bind:this={ref}
  data-slot="badge-dot"
  aria-hidden="true"
  {...rest}
  class={cn("tw:size-1.5 tw:shrink-0 tw:rounded-full tw:bg-current", className)}
></span>
