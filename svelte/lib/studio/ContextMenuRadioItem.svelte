<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { Circle } from "./icons";
  import { cn } from "./utils";

  let {
    class: className,
    children: content,
    ref = $bindable(null),
    ...rest
  }: Omit<ContextMenuPrimitive.RadioItemProps, "child"> = $props();
</script>

<ContextMenuPrimitive.RadioItem
  bind:ref
  data-slot="context-menu-radio-item"
  class={cn(
    "tw:focus:bg-accent tw:focus:text-accent-foreground tw:relative tw:flex tw:cursor-default tw:items-center tw:gap-2 tw:rounded-sm tw:py-1.5 tw:pr-2 tw:pl-8 tw:text-sm tw:outline-hidden tw:select-none tw:data-[disabled]:pointer-events-none tw:data-[disabled]:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {#snippet children(state)}
    <span
      class="tw:pointer-events-none tw:absolute tw:left-2 tw:flex tw:size-3.5 tw:items-center tw:justify-center"
    >
      {#if state.checked}
        <span data-state="checked"
          ><Icon icon={Circle} class="tw:size-2 tw:fill-current" /></span
        >
      {/if}
    </span>
    {@render content?.(state)}
  {/snippet}
</ContextMenuPrimitive.RadioItem>
