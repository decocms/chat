<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLTableCaptionElement | null;
    children?: Snippet;
  } = $props();
</script>

<caption
  bind:this={ref}
  data-slot="table-caption"
  {...rest}
  class={cn("tw:text-muted-foreground tw:mt-4 tw:text-sm", className)}
  >{@render children?.()}</caption
>
