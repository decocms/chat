<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import {
    buttonGroupVariants,
    type ButtonGroupVariants,
  } from "./button-group";
  import { cn } from "./utils";

  let {
    orientation,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: ButtonGroupVariants &
    Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
      class?: string;
      ref?: HTMLDivElement | null;
      children?: Snippet;
    } = $props();
</script>

<div
  bind:this={ref}
  role="group"
  data-slot="button-group"
  data-orientation={orientation}
  {...rest}
  class={cn(buttonGroupVariants({ orientation }), className)}
>
  {@render children?.()}
</div>
