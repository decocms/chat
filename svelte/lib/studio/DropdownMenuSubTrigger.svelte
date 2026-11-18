<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { ChevronRight } from "./icons";
  import { cn } from "./utils";

  let {
    class: className,
    inset,
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<DropdownMenuPrimitive.SubTriggerProps, "child"> & {
    inset?: boolean;
  } = $props();
</script>

<DropdownMenuPrimitive.SubTrigger
  bind:ref
  data-slot="dropdown-menu-sub-trigger"
  data-inset={inset}
  class={cn(
    "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {@render children?.()}
  <Icon icon={ChevronRight} class="ml-auto size-4" />
</DropdownMenuPrimitive.SubTrigger>
