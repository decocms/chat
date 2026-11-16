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
    "tw:border-border tw:text-[0.75rem] tw:leading-4 tw:tabular-nums tw:text-muted-foreground tw:flex tw:items-center tw:justify-between tw:gap-2 tw:border-t tw:pt-3",
    className,
  )}
>
  {@render children?.()}
</div>
