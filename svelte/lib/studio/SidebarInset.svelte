<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `SidebarInset`. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLElement>, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLElement | null;
    children?: Snippet;
  } = $props();
</script>

<main
  bind:this={ref}
  data-slot="sidebar-inset"
  {...rest}
  class={cn(
    "tw:bg-background tw:relative tw:flex tw:w-full tw:flex-1 tw:flex-col tw:min-w-0 tw:md:peer-data-[variant=inset]:m-2 tw:md:peer-data-[variant=inset]:ml-0 tw:md:peer-data-[variant=inset]:rounded-xl tw:md:peer-data-[variant=inset]:shadow-sm tw:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
    className,
  )}
>
  {@render children?.()}
</main>
