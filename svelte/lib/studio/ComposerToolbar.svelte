<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The bottom row. Put a `ComposerGroup` on each side. */
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
  data-slot="composer-toolbar"
  {...rest}
  class={cn(
    "flex items-center justify-between gap-2 p-2 group-data-[size=compact]/composer:p-0 [&_svg]:stroke-[1.33] [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-muted-foreground",
    className,
  )}
>
  {@render children?.()}
</div>
