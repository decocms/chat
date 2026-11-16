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
    HTMLAttributes<HTMLTableRowElement>,
    "style" | "class" | "children"
  > & {
    class?: string;
    ref?: HTMLTableRowElement | null;
    children?: Snippet;
  } = $props();
</script>

<tr
  bind:this={ref}
  data-slot="table-row"
  {...rest}
  class={cn(
    "tw:data-[state=selected]:bg-muted tw:border-border tw:border-b tw:transition-colors",
    className,
  )}>{@render children?.()}</tr
>
