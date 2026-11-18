<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLDivElement | null;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="alert-dialog-footer"
  {...rest}
  class={cn(
    "tw:flex tw:flex-col-reverse tw:gap-2 tw:min-[901px]:flex-row tw:min-[901px]:justify-end",
    className,
  )}
>
  {@render children?.()}
</div>
