<script lang="ts">
  import { ScrollArea as ScrollAreaPrimitive } from "bits-ui";
  import ScrollBar from "./ScrollBar.svelte";
  import { cn } from "./utils";

  let {
    class: className,
    children,
    hideScrollbar = false,
    viewportRef = $bindable(null),
    ref = $bindable(null),
    ...rest
  }: Omit<ScrollAreaPrimitive.RootProps, "child"> & {
    hideScrollbar?: boolean;
    viewportRef?: HTMLElement | null;
  } = $props();
</script>

<ScrollAreaPrimitive.Root
  bind:ref
  data-slot="scroll-area"
  class={cn("tw:relative tw:h-full tw:w-full", className)}
  {...rest}
>
  <ScrollAreaPrimitive.Viewport
    bind:ref={viewportRef}
    data-slot="scroll-area-viewport"
    class="tw:h-full tw:w-full tw:overflow-auto tw:rounded-[inherit] tw:transition-[color,box-shadow] tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2"
  >
    <div class="tw:flex tw:min-w-0 tw:flex-col">{@render children?.()}</div>
  </ScrollAreaPrimitive.Viewport>
  <ScrollBar {hideScrollbar} />
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
