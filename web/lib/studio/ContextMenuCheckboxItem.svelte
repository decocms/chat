<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  let {
    class: className,
    children: content,
    checked = $bindable(false),
    indeterminate = $bindable(false),
    ref = $bindable(null),
    ...rest
  }: Omit<ContextMenuPrimitive.CheckboxItemProps, "child"> = $props();
</script>

<ContextMenuPrimitive.CheckboxItem
  bind:ref
  bind:checked
  bind:indeterminate
  data-slot="context-menu-checkbox-item"
  class={cn(
    "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {#snippet children(state)}
    <span
      class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center"
    >
      {#if state.checked}
        <span data-state="checked"><Icon icon="check" class="size-4" /></span>
      {/if}
    </span>
    {@render content?.(state)}
  {/snippet}
</ContextMenuPrimitive.CheckboxItem>
