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
      "outline-none bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] data-[state=closed]:[--tw-exit-scale:.95] data-[state=open]:[--tw-enter-scale:.95] data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] data-[side=left]:[--tw-enter-translate-x:0.5rem] data-[side=right]:[--tw-enter-translate-x:-0.5rem] data-[side=top]:[--tw-enter-translate-y:0.5rem] relative z-50 max-h-(--bits-select-content-available-height) min-w-[8rem] origin-(--bits-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-[var(--vb-studio-surface-radius,0.625rem)] border-border border shadow-md [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:var(--vb-border)_transparent]",
      "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
      className,
    )}
    {...rest}
  >
    {#if !hideScrollButtons}<SelectScrollUpButton />{/if}
    <SelectPrimitive.Viewport
      class="h-[var(--bits-select-anchor-height)] w-full min-w-[var(--bits-select-anchor-width)] scroll-my-1 p-1"
    >
      {@render children?.()}
    </SelectPrimitive.Viewport>
    {#if !hideScrollButtons}<SelectScrollDownButton />{/if}
  </SelectPrimitive.Content>
</SelectPrimitive.Portal>
