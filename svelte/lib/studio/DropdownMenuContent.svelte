<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    sideOffset = 4,
    ref = $bindable(null),
    ...rest
  }: DropdownMenuPrimitive.ContentProps = $props();
</script>

<DropdownMenuPrimitive.Portal>
  <DropdownMenuPrimitive.Content
    bind:ref
    data-slot="dropdown-menu-content"
    {sideOffset}
    translate="no"
    class={cn(
      "tw:outline-none tw:bg-popover tw:text-popover-foreground tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:data-[state=closed]:[--tw-exit-scale:.95] tw:data-[state=open]:[--tw-enter-scale:.95] tw:data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] tw:data-[side=left]:[--tw-enter-translate-x:0.5rem] tw:data-[side=right]:[--tw-enter-translate-x:-0.5rem] tw:data-[side=top]:[--tw-enter-translate-y:0.5rem] tw:z-50 tw:max-h-(--bits-dropdown-menu-content-available-height) tw:min-w-[8rem] tw:origin-(--bits-dropdown-menu-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:border-border tw:border tw:p-1 tw:shadow-md tw:[scrollbar-width:thin] tw:[scrollbar-color:transparent_transparent] tw:hover:[scrollbar-color:var(--vb-border)_transparent]",
      className,
    )}
    {...rest}
  />
</DropdownMenuPrimitive.Portal>
