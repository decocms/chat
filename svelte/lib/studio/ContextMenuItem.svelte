<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    class: className,
    inset,
    variant = "default",
    ref = $bindable(null),
    ...rest
  }: ContextMenuPrimitive.ItemProps & {
    inset?: boolean;
    variant?: "default" | "destructive";
  } = $props();
</script>

<ContextMenuPrimitive.Item
  bind:ref
  data-slot="context-menu-item"
  data-inset={inset}
  data-variant={variant}
  class={cn(
    "tw:focus:bg-accent tw:focus:text-accent-foreground tw:data-[variant=destructive]:text-destructive tw:data-[variant=destructive]:focus:bg-destructive/10 tw:dark:data-[variant=destructive]:focus:bg-destructive/20 tw:data-[variant=destructive]:focus:text-destructive tw:data-[variant=destructive]:*:[svg]:!text-destructive tw:[&_svg:not([class*='text-'])]:text-muted-foreground tw:relative tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:select-none tw:data-[disabled]:pointer-events-none tw:data-[disabled]:opacity-50 tw:data-[inset]:pl-8 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
/>
