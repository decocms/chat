<script lang="ts">
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import Textarea from "../../lib/studio/Textarea.svelte";
  import { cn } from "../../lib/studio/utils";

  /** The text field of a ChatBox: grows with its content up to 10rem. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<HTMLTextareaAttributes, "style" | "class" | "children"> & {
    class?: string;
    ref?: HTMLTextAreaElement | null;
  } = $props();
</script>

<Textarea
  bind:ref
  {...rest}
  class={cn(
    "tw:block tw:max-h-40 tw:min-h-8 tw:min-w-0 tw:flex-1 tw:resize-none tw:rounded-lg tw:bg-transparent tw:px-1.5 tw:py-1.5 tw:text-[15px] tw:leading-5 tw:shadow-none tw:[field-sizing:content] tw:hover:bg-transparent tw:focus-visible:outline-none",
    className,
  )}
/>
