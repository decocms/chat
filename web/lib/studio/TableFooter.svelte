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

<tfoot
  bind:this={ref}
  data-slot="table-footer"
  {...rest}
  class={cn(
    "bg-muted/50 border-border border-t font-medium [&>tr]:last:border-b-0",
    className,
  )}>{@render children?.()}</tfoot
>
