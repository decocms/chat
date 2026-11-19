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
    "bg-background relative flex w-full flex-1 flex-col min-w-0 md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
    className,
  )}
>
  {@render children?.()}
</main>
