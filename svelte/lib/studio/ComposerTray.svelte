<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Tucked behind the top edge: the queue, a task's progress. */
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
  data-slot="composer-tray"
  {...rest}
  class={cn(
    "tw:bg-muted tw:-mb-4 tw:flex tw:flex-col tw:gap-1 tw:rounded-t-2xl tw:px-2 tw:pt-2 tw:pb-6",
    className,
  )}
>
  {@render children?.()}
</div>
