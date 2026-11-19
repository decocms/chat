<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { composerVariants, type ComposerVariants } from "./composer";
  import { cn } from "./utils";

  /** Where you talk to the agent; `compact` is one line, for side panels and threads. */
  let {
    size,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: ComposerVariants &
    Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
      class?: string;
      ref?: HTMLDivElement | null;
      children?: Snippet;
    } = $props();
</script>

<div
  bind:this={ref}
  data-slot="composer"
  data-size={size ?? "full"}
  {...rest}
  class={cn(composerVariants({ size }), className)}
>
  {@render children?.()}
</div>
