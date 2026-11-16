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
    "tw:flex tw:h-[var(--vb-studio-control-height,2.25rem)] tw:data-[size=sm]:h-8 tw:w-full tw:min-w-0 tw:items-center tw:gap-0.5 tw:rounded-[var(--vb-studio-control-radius,0.625rem)] tw:bg-[var(--vb-studio-input-background)] tw:px-1 tw:text-sm tw:shadow-edge tw:transition-[background-color,box-shadow] tw:hover:bg-sidebar tw:has-[:focus-visible]:outline-2 tw:has-[:focus-visible]:outline-solid tw:has-[:focus-visible]:outline-ring tw:has-[:focus-visible]:outline-offset-2 tw:has-[[aria-invalid=true]]:bg-destructive/10 tw:has-[[aria-invalid=true]]:shadow-[inset_0_0_0_1px_var(--vb-destructive)] tw:has-[input:disabled]:pointer-events-none",
    "tw:[&_svg:not([class*='size-'])]:size-4 tw:[&_svg]:shrink-0 tw:[&_svg]:stroke-[1.33] tw:[&_svg:not([class*='text-'])]:text-muted-foreground",
    className,
  )}
>
  {@render children?.()}
</div>
