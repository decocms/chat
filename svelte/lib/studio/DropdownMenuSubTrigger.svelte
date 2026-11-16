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
    "tw:focus:bg-accent tw:focus:text-accent-foreground tw:data-[state=open]:bg-accent tw:data-[state=open]:text-accent-foreground tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:select-none tw:data-[disabled]:pointer-events-none tw:data-[disabled]:opacity-50 tw:data-[inset]:pl-8 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {@render children?.()}
  <Icon icon={ChevronRight} class="tw:ml-auto tw:size-4" />
</DropdownMenuPrimitive.SubTrigger>
