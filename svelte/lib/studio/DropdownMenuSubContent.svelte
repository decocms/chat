<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    align = "start",
    ref = $bindable(null),
    ...rest
  }: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<DropdownMenuPrimitive.SubContent
  bind:ref
  data-slot="dropdown-menu-sub-content"
  {align}
  translate="no"
  class={cn(
    "tw:outline-none tw:bg-popover tw:text-popover-foreground tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:data-[state=closed]:[--tw-exit-scale:.95] tw:data-[state=open]:[--tw-enter-scale:.95] tw:data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] tw:data-[side=left]:[--tw-enter-translate-x:0.5rem] tw:data-[side=right]:[--tw-enter-translate-x:-0.5rem] tw:data-[side=top]:[--tw-enter-translate-y:0.5rem] tw:z-50 tw:min-w-[8rem] tw:origin-(--bits-menu-content-transform-origin) tw:overflow-hidden tw:rounded-md tw:border-border tw:border tw:p-1 tw:shadow-lg",
    className,
  )}
  {...rest}
/>
