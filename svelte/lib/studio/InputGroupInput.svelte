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
    "text-foreground placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:text-subtle-foreground h-full min-w-0 flex-1 bg-transparent px-2 text-sm pointer-coarse:text-[16px] outline-none",
    className,
  )}
/>
