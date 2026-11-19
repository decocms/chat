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
  class={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
>
  {@render children?.()}
</span>
