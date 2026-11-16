<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import SelectScrollDownButton from "./SelectScrollDownButton.svelte";
  import SelectScrollUpButton from "./SelectScrollUpButton.svelte";
  import { cn } from "./utils";

  /** Always positioned as a popper under its trigger: Bits UI has no item-aligned mode. */
  let {
    class: className,
    children,
    align = "start",
    collisionPadding = 10,
    hideScrollButtons = false,
    ref = $bindable(null),
    ...rest
  }: Omit<SelectPrimitive.ContentProps, "child"> & {
    hideScrollButtons?: boolean;
  } = $props();
</script>

<SelectPrimitive.Portal>
  <SelectPrimitive.Content
    bind:ref
    data-slot="select-content"
    translate="no"
    {align}
    {collisionPadding}
    class={cn(
      "tw:outline-none tw:bg-popover tw:text-popover-foreground tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:data-[state=closed]:[--tw-exit-scale:.95] tw:data-[state=open]:[--tw-enter-scale:.95] tw:data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] tw:data-[side=left]:[--tw-enter-translate-x:0.5rem] tw:data-[side=right]:[--tw-enter-translate-x:-0.5rem] tw:data-[side=top]:[--tw-enter-translate-y:0.5rem] tw:relative tw:z-50 tw:max-h-(--bits-select-content-available-height) tw:min-w-[8rem] tw:origin-(--bits-select-content-transform-origin) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-[var(--vb-studio-surface-radius,0.625rem)] tw:border-border tw:border tw:shadow-md tw:[scrollbar-width:thin] tw:[scrollbar-color:transparent_transparent] tw:hover:[scrollbar-color:var(--vb-border)_transparent]",
      "tw:data-[side=bottom]:translate-y-1 tw:data-[side=left]:-translate-x-1 tw:data-[side=right]:translate-x-1 tw:data-[side=top]:-translate-y-1",
      className,
    )}
    {...rest}
  >
    {#if !hideScrollButtons}<SelectScrollUpButton />{/if}
    <SelectPrimitive.Viewport
      class="tw:h-[var(--bits-select-anchor-height)] tw:w-full tw:min-w-[var(--bits-select-anchor-width)] tw:scroll-my-1 tw:p-1"
    >
      {@render children?.()}
    </SelectPrimitive.Viewport>
    {#if !hideScrollButtons}<SelectScrollDownButton />{/if}
  </SelectPrimitive.Content>
</SelectPrimitive.Portal>
