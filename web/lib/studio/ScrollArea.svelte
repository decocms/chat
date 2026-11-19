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
  class={cn("relative h-full w-full", className)}
  {...rest}
>
  <ScrollAreaPrimitive.Viewport
    bind:ref={viewportRef}
    data-slot="scroll-area-viewport"
    class="h-full w-full overflow-auto rounded-[inherit] transition-[color,box-shadow] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2"
  >
    <div class="flex min-w-0 flex-col">{@render children?.()}</div>
  </ScrollAreaPrimitive.Viewport>
  <ScrollBar {hideScrollbar} />
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
