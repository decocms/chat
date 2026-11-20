<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The 6px status dot that leads a badge, in the badge's tone (`--badge-tone`), or its text colour outside a badge. */
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
  class={cn(
    "size-1.5 shrink-0 rounded-full bg-(--badge-tone,currentColor)",
    className,
  )}
></span>
