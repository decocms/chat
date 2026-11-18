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
    "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap tabular-nums [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
    className,
  )}>{@render children?.()}</th
>
