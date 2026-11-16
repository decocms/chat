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
    "tw:placeholder:text-subtle-foreground tw:field-sizing-content tw:max-h-60 tw:min-w-0 tw:flex-1 tw:resize-none tw:bg-transparent tw:px-4 tw:pt-3.5 tw:pb-1 tw:text-sm tw:leading-relaxed tw:outline-none tw:disabled:cursor-not-allowed tw:group-data-[size=compact]/composer:px-2 tw:group-data-[size=compact]/composer:py-1 tw:[scrollbar-width:thin] tw:[scrollbar-color:transparent_transparent] tw:hover:[scrollbar-color:var(--vb-border)_transparent]",
    className,
  )}></textarea>
