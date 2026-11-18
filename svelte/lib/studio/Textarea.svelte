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
    "tw:placeholder:text-subtle-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:aria-invalid:bg-destructive/10 tw:aria-invalid:shadow-[inset_0_0_0_1px_var(--vb-destructive)] tw:flex tw:field-sizing-content tw:min-h-16 tw:w-full tw:rounded-[var(--vb-studio-control-radius,0.875rem)] tw:bg-[var(--vb-studio-input-background)] tw:px-3 tw:py-2 tw:text-sm tw:pointer-coarse:text-[16px] tw:transition-[color,background-color,box-shadow] tw:outline-none tw:shadow-edge tw:hover:bg-sidebar tw:disabled:cursor-not-allowed tw:disabled:text-subtle-foreground",
    className,
  )}></textarea>
