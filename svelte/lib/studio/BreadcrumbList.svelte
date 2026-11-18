<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLOlAttributes } from "svelte/elements";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLOlAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLOListElement | null;
    children?: Snippet;
  } = $props();
</script>

<ol
  bind:this={ref}
  data-slot="breadcrumb-list"
  {...rest}
  class={cn(
    "tw:flex tw:items-center tw:gap-1.5 tw:text-sm tw:md:gap-2 tw:overflow-hidden tw:text-muted-foreground",
    className,
  )}
>
  {@render children?.()}
</ol>
