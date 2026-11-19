<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Text or an icon at either end: a currency, a protocol, a search glass. */
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
  data-slot="input-group-addon"
  {...rest}
  class={cn("text-muted-foreground flex shrink-0 items-center px-2", className)}
>
  {@render children?.()}
</span>
