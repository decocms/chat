<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: ContextMenuPrimitive.ContentProps = $props();
</script>

<ContextMenuPrimitive.Portal>
  <ContextMenuPrimitive.Content
    bind:ref
    data-slot="context-menu-content"
    translate="no"
    class={cn(
      "outline-none bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] data-[state=closed]:[--tw-exit-scale:.95] data-[state=open]:[--tw-enter-scale:.95] data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] data-[side=left]:[--tw-enter-translate-x:0.5rem] data-[side=right]:[--tw-enter-translate-x:-0.5rem] data-[side=top]:[--tw-enter-translate-y:0.5rem] z-50 max-h-(--bits-context-menu-content-available-height) min-w-[8rem] origin-(--bits-context-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border-border border p-1 shadow-md [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:var(--vb-border)_transparent]",
      className,
    )}
    {...rest}
  />
</ContextMenuPrimitive.Portal>
