<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The @ and / menu, floating above the composer. */
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
  data-slot="composer-suggestions"
  role="listbox"
  {...rest}
  class={cn(
    "tw:bg-glass tw:backdrop-blur-[32px] tw:shadow-glass-panel tw:flex tw:flex-col tw:rounded-2xl tw:p-1.5",
    className,
  )}
>
  {@render children?.()}
</div>
