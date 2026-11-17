<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLFormAttributes } from "svelte/elements";
  import { cn } from "../../lib/studio/utils";

  /** The one chat input box: the room's composer and the home's ask box share it.
   *  Children: buttons before the input, a ChatBoxInput, then buttons and a ChatBoxSend. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<HTMLFormAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLFormElement | null;
    children?: Snippet;
  } = $props();
</script>

<form
  bind:this={ref}
  data-chat-box
  {...rest}
  class={cn(
    "tw:flex tw:items-end tw:gap-0.5 tw:rounded-[18px] tw:bg-[var(--vb-studio-input-background)] tw:py-1.5 tw:pr-1.5 tw:pl-1 tw:shadow-[inset_0_0_0_1px_var(--vb-hairline),0_4px_16px_0_#0000000d] tw:transition-shadow tw:duration-150 tw:ease-[var(--vb-ease-out-cubic)] tw:focus-within:shadow-[inset_0_0_0_1px_var(--vb-input),0_6px_20px_0_#00000014]",
    className,
  )}
>
  {@render children?.()}
</form>
