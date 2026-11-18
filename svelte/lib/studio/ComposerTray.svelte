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
    "bg-muted -mb-4 flex flex-col gap-1 rounded-t-2xl px-2 pt-2 pb-6",
    className,
  )}
>
  {@render children?.()}
</div>
