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
    "tw:bg-muted tw:text-muted-foreground tw:-mt-4 tw:flex tw:items-center tw:gap-2 tw:rounded-b-2xl tw:px-4 tw:pt-6 tw:pb-3 tw:text-xs tw:[&_svg]:size-4 tw:[&_svg]:stroke-[1.33]",
    className,
  )}
>
  {@render children?.()}
</div>
