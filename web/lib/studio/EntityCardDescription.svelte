<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `EntityCard.Description`. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLDivElement | null;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="entity-card-description"
  {...rest}
  class={cn(
    "text-[0.75rem] leading-4 tabular-nums text-muted-foreground -mt-2 line-clamp-2",
    className,
  )}
>
  {@render children?.()}
</div>
