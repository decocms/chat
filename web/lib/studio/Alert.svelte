<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { alertVariants, type AlertVariants } from "./alert";
  import { cn } from "./utils";

  let {
    variant,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: AlertVariants &
    Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
      class?: string;
      ref?: HTMLDivElement | null;
      children?: Snippet;
    } = $props();
</script>

<div
  bind:this={ref}
  data-slot="alert"
  role="alert"
  {...rest}
  class={cn(alertVariants({ variant }), className)}
>
  {@render children?.()}
</div>
