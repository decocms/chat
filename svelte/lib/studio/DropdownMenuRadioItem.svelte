<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { Circle } from "./icons";
  import { cn } from "./utils";

  let {
    class: className,
    children: content,
    ref = $bindable(null),
    ...rest
  }: Omit<DropdownMenuPrimitive.RadioItemProps, "child"> = $props();
</script>

<DropdownMenuPrimitive.RadioItem
  bind:ref
  data-slot="dropdown-menu-radio-item"
  class={cn(
    "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-lg py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    className,
  )}
  {...rest}
>
  {#snippet children(state)}
    <span
      class="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center"
    >
      {#if state.checked}
        <span data-state="checked"
          ><Icon icon={Circle} class="size-2 fill-current" /></span
        >
      {/if}
    </span>
    {@render content?.(state)}
  {/snippet}
</DropdownMenuPrimitive.RadioItem>
