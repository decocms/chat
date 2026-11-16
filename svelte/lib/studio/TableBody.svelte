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

<tbody
  bind:this={ref}
  data-slot="table-body"
  {...rest}
  class={cn("tw:[&_tr:last-child]:border-0", className)}
  >{@render children?.()}</tbody
>
