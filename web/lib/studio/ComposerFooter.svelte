<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Tucked behind the bottom edge: a nudge like connecting your tools. */
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
  data-slot="composer-footer"
  {...rest}
  class={cn(
    "bg-muted text-muted-foreground -mt-4 flex items-center gap-2 rounded-b-2xl px-4 pt-6 pb-3 text-xs [&_svg]:size-4 [&_svg]:stroke-[1.33]",
    className,
  )}
>
  {@render children?.()}
</div>
