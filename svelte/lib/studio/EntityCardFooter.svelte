<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Counts, people, a last update; set off by a hairline. */
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
  data-slot="entity-card-footer"
  {...rest}
  class={cn(
    "border-border text-[0.75rem] leading-4 tabular-nums text-muted-foreground flex items-center justify-between gap-2 border-t pt-3",
    className,
  )}
>
  {@render children?.()}
</div>
