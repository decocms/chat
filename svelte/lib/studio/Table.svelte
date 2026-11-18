<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLTableAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** `card` stands on its own; `flush` sits inside a surface that already draws the edge, with quieter headers and hairlines. */
  let {
    variant = "card",
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLTableAttributes, "style" | "class" | "children"> & {
    variant?: "card" | "flush";
    class?: string;
    ref?: HTMLTableElement | null;
    children?: Snippet;
  } = $props();
</script>

<div
  data-slot="table-container"
  class={cn(
    "w-full min-w-0",
    variant === "card" && "bg-card rounded-xl shadow-edge overflow-hidden",
  )}
>
  <table
    bind:this={ref}
    data-slot="table"
    {...rest}
    class={cn(
      "w-full caption-bottom text-sm min-w-0",
      variant === "flush" &&
        "[&_th]:text-muted-foreground [&_th]:font-normal [&_tr]:border-border/50",
      className,
    )}
  >
    {@render children?.()}
  </table>
</div>
