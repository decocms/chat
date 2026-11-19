<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    align = "start",
    ref = $bindable(null),
    ...rest
  }: ContextMenuPrimitive.SubContentProps = $props();
</script>

<ContextMenuPrimitive.SubContent
  bind:ref
  data-slot="context-menu-sub-content"
  {align}
  translate="no"
  class={cn(
    "outline-none bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] data-[state=closed]:[--tw-exit-scale:.95] data-[state=open]:[--tw-enter-scale:.95] data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] data-[side=left]:[--tw-enter-translate-x:0.5rem] data-[side=right]:[--tw-enter-translate-x:-0.5rem] data-[side=top]:[--tw-enter-translate-y:0.5rem] z-50 min-w-[8rem] origin-(--bits-menu-content-transform-origin) overflow-hidden rounded-md border-border border p-1 shadow-lg",
    className,
  )}
  {...rest}
/>
