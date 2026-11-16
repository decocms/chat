<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The row holding the sidebar and the page. The two widths are classes here, where React writes them as inline custom properties; override them with a class. */
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
  data-slot="sidebar-wrapper"
  {...rest}
  class={cn(
    "tw:group/sidebar-wrapper tw:has-data-[variant=inset]:bg-sidebar tw:flex tw:h-full tw:w-full tw:[--sidebar-width:15rem] tw:[--sidebar-width-icon:4.5rem]",
    className,
  )}
>
  {@render children?.()}
</div>
