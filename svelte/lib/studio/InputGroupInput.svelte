<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The bare input inside an `InputGroup`. */
  let {
    value = $bindable(),
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLInputAttributes, "style" | "class" | "children" | "files"> & {
    class?: string;
    ref?: HTMLInputElement | null;
  } = $props();
</script>

<input
  bind:this={ref}
  bind:value
  data-slot="input-group-input"
  {...rest}
  class={cn(
    "tw:text-foreground tw:placeholder:text-subtle-foreground tw:disabled:cursor-not-allowed tw:disabled:text-subtle-foreground tw:h-full tw:min-w-0 tw:flex-1 tw:bg-transparent tw:px-2 tw:text-sm tw:pointer-coarse:text-[16px] tw:outline-none",
    className,
  )}
/>
