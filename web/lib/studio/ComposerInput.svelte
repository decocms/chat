<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The composer's text; `defaultValue` is an initial `value`, which binds. */
  let {
    value = $bindable(),
    rows = 1,
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLTextareaAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLTextAreaElement | null;
  } = $props();
</script>

<textarea
  bind:this={ref}
  bind:value
  data-slot="composer-input"
  {rows}
  {...rest}
  class={cn(
    "placeholder:text-subtle-foreground field-sizing-content max-h-60 min-w-0 flex-1 resize-none bg-transparent px-4 pt-3.5 pb-1 text-sm pointer-coarse:text-[16px] leading-relaxed outline-none disabled:cursor-not-allowed group-data-[size=compact]/composer:px-2 group-data-[size=compact]/composer:py-1 [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:var(--vb-border)_transparent]",
    className,
  )}></textarea>
