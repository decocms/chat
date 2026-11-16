<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

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
  data-slot="card-description"
  {...rest}
  class={cn(
    "tw:text-[0.75rem] tw:leading-4 tw:tabular-nums tw:text-muted-foreground",
    className,
  )}
>
  {@render children?.()}
</div>
