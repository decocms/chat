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
    "[:where(&_tr)]:border-border [&_tr]:border-b sticky top-0 z-10 bg-card",
    className,
  )}>{@render children?.()}</thead
>
