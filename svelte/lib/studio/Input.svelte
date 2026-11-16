<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { inputVariants, type InputVariants } from "./input";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Input`. `defaultValue` is an initial `value`; both `value` and `files` bind. */
  let {
    type,
    size,
    value = $bindable(),
    files = $bindable(),
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<
    HTMLInputAttributes,
    "size" | "style" | "class" | "children" | "files"
  > &
    InputVariants & {
      class?: string;
      files?: FileList | null;
      ref?: HTMLInputElement | null;
    } = $props();
  const classes = $derived(cn(inputVariants({ size }), className));
</script>

{#if type === "file"}
  <input
    bind:this={ref}
    bind:files
    bind:value
    type="file"
    data-slot="input"
    {...rest}
    class={classes}
  />
{:else}
  <input
    bind:this={ref}
    bind:value
    {type}
    data-slot="input"
    {...rest}
    class={classes}
  />
{/if}
