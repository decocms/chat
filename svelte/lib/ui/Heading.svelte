<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "../studio/utils";
  let {
    level = 2,
    children,
    class: className,
    ...rest
  }: Omit<
    HTMLAttributes<HTMLHeadingElement>,
    "style" | "class" | "children"
  > & {
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    children: Snippet;
    class?: string;
  } = $props();
  const tag = $derived(`h${level}`);
</script>

<svelte:element
  this={tag}
  {...rest}
  class={cn(
    "m-0 font-sans text-base font-semibold leading-6 tracking-normal [font-variation-settings:normal]",
    className,
  )}>{@render children()}</svelte:element
>
