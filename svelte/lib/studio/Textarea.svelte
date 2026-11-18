<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Textarea`; `defaultValue` is an initial `value`. */
  let {
    value = $bindable(),
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
  data-slot="textarea"
  {...rest}
  class={cn(
    "placeholder:text-subtle-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 aria-invalid:bg-destructive/10 aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)] flex field-sizing-content min-h-16 w-full rounded-[var(--vb-studio-control-radius,0.875rem)] bg-[var(--vb-studio-input-background)] px-3 py-2 text-sm pointer-coarse:text-[16px] transition-[color,background-color,box-shadow] outline-none shadow-edge hover:bg-sidebar disabled:cursor-not-allowed disabled:text-subtle-foreground",
    className,
  )}></textarea>
