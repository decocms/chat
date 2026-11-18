<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Its icon or avatar, with an optional status or menu on the right. */
  let {
    icon,
    trailing,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    icon: Snippet;
    trailing?: Snippet;
    class?: string;
    ref?: HTMLDivElement | null;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="entity-card-header"
  {...rest}
  class={cn("flex items-start justify-between gap-3", className)}
>
  {@render icon()}
  {@render trailing?.()}
</div>
