<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import {
    projectIconVariants,
    type ProjectIconVariants,
  } from "./project-icon";
  import { cn } from "./utils";

  /** Small tiles are round (nav rows, chips); large ones are rounded squares (rails, cards). */
  let {
    color,
    size,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: ProjectIconVariants &
    Omit<
      HTMLAttributes<HTMLSpanElement>,
      "style" | "class" | "children" | "color"
    > & {
      class?: string;
      ref?: HTMLSpanElement | null;
      children?: Snippet;
    } = $props();
</script>

<span
  bind:this={ref}
  data-slot="project-icon"
  {...rest}
  class={cn(projectIconVariants({ color, size }), className)}
  >{@render children?.()}</span
>
