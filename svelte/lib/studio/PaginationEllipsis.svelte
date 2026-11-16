<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { DotsHorizontal } from "./icons";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLAttributes<HTMLSpanElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLSpanElement | null;
  } = $props();
</script>

<span
  bind:this={ref}
  aria-hidden="true"
  data-slot="pagination-ellipsis"
  {...rest}
  class={cn("tw:flex tw:size-10 tw:items-center tw:justify-center", className)}
>
  <Icon icon={DotsHorizontal} class="tw:size-4" />
  <span class="tw:sr-only">More pages</span>
</span>
