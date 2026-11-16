<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLSpanElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLSpanElement | null;
    children?: Snippet;
  } = $props();
</script>

<span
  bind:this={ref}
  data-slot="context-menu-shortcut"
  {...rest}
  class={cn(
    "tw:text-muted-foreground tw:ml-auto tw:text-xs tw:tracking-widest",
    className,
  )}
>
  {@render children?.()}
</span>
