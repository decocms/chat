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
  data-slot="breadcrumb-ellipsis"
  role="presentation"
  aria-hidden="true"
  {...rest}
  class={cn("flex size-10 items-center justify-center", className)}
>
  <Icon icon={DotsHorizontal} class="size-4" />
  <span class="sr-only">More</span>
</span>
