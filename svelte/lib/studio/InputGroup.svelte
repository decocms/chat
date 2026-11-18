<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** An input with icons, text or buttons inside it; the group draws the field. */
  let {
    size = "default",
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "style" | "class" | "children"> & {
    size?: "default" | "sm";
    class?: string;
    ref?: HTMLDivElement | null;
    children?: Snippet;
  } = $props();
</script>

<div
  bind:this={ref}
  data-slot="input-group"
  data-size={size}
  {...rest}
  class={cn(
    "flex h-[var(--vb-studio-control-height,2.25rem)] data-[size=sm]:h-8 w-full min-w-0 items-center gap-0.5 rounded-[var(--vb-studio-control-radius,0.625rem)] bg-[var(--vb-studio-input-background)] px-1 text-sm shadow-edge transition-[background-color,box-shadow] hover:bg-sidebar has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-offset-2 has-[[aria-invalid=true]]:bg-destructive/10 has-[[aria-invalid=true]]:shadow-[inset_0_0_0_1px_var(--vb-destructive)] has-[input:disabled]:pointer-events-none",
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:stroke-[1.33] [&_svg:not([class*='text-'])]:text-muted-foreground",
    className,
  )}
>
  {@render children?.()}
</div>
