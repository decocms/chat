<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import Icon from "./Icon.svelte";
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
    "bg-card/90 text-muted-foreground absolute inset-0 z-20 flex flex-col items-center justify-center gap-1.5 rounded-2xl text-sm font-medium shadow-[inset_0_0_0_1.5px_var(--vb-input)] backdrop-blur-sm",
    className,
  )}
>
  <Icon icon="upload-01" class="size-5 stroke-[1.33]" />
  {@render children?.()}
</div>
