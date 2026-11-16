<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    orientation = "vertical",
    hideScrollbar = false,
    ref = $bindable(null),
    ...rest
  }: Omit<
    ScrollAreaPrimitive.ScrollbarProps,
    "child" | "children" | "orientation"
  > & {
    orientation?: "vertical" | "horizontal";
    hideScrollbar?: boolean;
  } = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
  bind:ref
  data-slot="scroll-area-scrollbar"
  {orientation}
  class={cn(
    "tw:touch-none tw:p-px tw:transition-colors tw:select-none",
    orientation === "vertical" &&
      "tw:h-full tw:w-2.5 tw:border-l tw:border-border tw:border-l-transparent",
    orientation === "horizontal" &&
      "tw:h-2.5 tw:flex-col tw:border-t tw:border-border tw:border-t-transparent",
    hideScrollbar && "tw:hidden",
    className,
  )}
  {...rest}
>
  <ScrollAreaPrimitive.Thumb
    data-slot="scroll-area-thumb"
    class="tw:relative tw:flex-1 tw:rounded-full tw:bg-border"
  />
</ScrollAreaPrimitive.Scrollbar>
