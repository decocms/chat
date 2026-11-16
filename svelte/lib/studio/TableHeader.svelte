<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<
    HTMLAttributes<HTMLTableSectionElement>,
    "style" | "class" | "children"
  > & {
    class?: string;
    ref?: HTMLTableSectionElement | null;
    children?: Snippet;
  } = $props();
</script>

<thead
  bind:this={ref}
  data-slot="table-header"
  {...rest}
  class={cn(
    "tw:[:where(&_tr)]:border-border tw:[&_tr]:border-b tw:sticky tw:top-0 tw:z-10 tw:bg-card",
    className,
  )}>{@render children?.()}</thead
>
