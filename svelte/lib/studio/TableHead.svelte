<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLThAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLThAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLTableCellElement | null;
    children?: Snippet;
  } = $props();
</script>

<th
  bind:this={ref}
  data-slot="table-head"
  {...rest}
  class={cn(
    "tw:text-foreground tw:h-10 tw:px-2 tw:text-left tw:align-middle tw:font-medium tw:whitespace-nowrap tw:tabular-nums tw:[&:has([role=checkbox])]:pr-0 tw:[&>[role=checkbox]]:translate-y-[2px]",
    className,
  )}>{@render children?.()}</th
>
