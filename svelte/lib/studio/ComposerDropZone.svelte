<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
  import { Upload01 } from "./icons";
  import { cn } from "./utils";

  /** Shown over the composer while files are dragged onto it. */
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
  data-slot="composer-drop-zone"
  {...rest}
  class={cn(
    "tw:bg-card/90 tw:text-muted-foreground tw:absolute tw:inset-0 tw:z-20 tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-2xl tw:text-sm tw:font-medium tw:shadow-[inset_0_0_0_1.5px_var(--vb-input)] tw:backdrop-blur-sm",
    className,
  )}
>
  <Icon icon={Upload01} class="tw:size-5 tw:stroke-[1.33]" />
  {@render children?.()}
</div>
