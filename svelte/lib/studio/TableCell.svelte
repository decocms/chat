<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLTdAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLTdAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLTableCellElement | null;
    children?: Snippet;
  } = $props();
</script>

<td
  bind:this={ref}
  data-slot="table-cell"
  {...rest}
  class={cn(
    "tw:p-2 tw:align-middle tw:whitespace-nowrap tw:text-sm tw:tabular-nums tw:[&:has([role=checkbox])]:pr-0 tw:[&>[role=checkbox]]:translate-y-[2px]",
    className,
  )}>{@render children?.()}</td
>
