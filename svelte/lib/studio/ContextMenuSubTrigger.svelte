<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { ChevronRight } from "./icons";
  import { cn } from "./utils";

  let {
    class: className,
    inset,
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<ContextMenuPrimitive.SubTriggerProps, "child"> & {
    inset?: boolean;
  } = $props();
</script>

<ContextMenuPrimitive.SubTrigger
  bind:ref
  data-slot="context-menu-sub-trigger"
  data-inset={inset}
  class={cn(
    "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {@render children?.()}
  <Icon icon={ChevronRight} class="ml-auto" />
</ContextMenuPrimitive.SubTrigger>
