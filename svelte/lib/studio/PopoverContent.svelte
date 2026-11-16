<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";
  import { selectTextOnAutoFocus } from "./overlay";
  import { cn } from "./utils";

  /** `glass` is the frosted panel for comment threads, confirmations and annotations floating over content. */
  let {
    class: className,
    align = "center",
    sideOffset = 4,
    container,
    variant = "default",
    onOpenAutoFocus,
    ref = $bindable(null),
    ...rest
  }: PopoverPrimitive.ContentProps & {
    variant?: "default" | "glass";
    /** Portal target. Pass a dialog's content to keep wheel-scroll working inside a scroll-locked dialog. */
    container?: PopoverPrimitive.PortalProps["to"];
  } = $props();
</script>

<PopoverPrimitive.Portal to={container}>
  <PopoverPrimitive.Content
    bind:ref
    data-slot="popover-content"
    {align}
    {sideOffset}
    translate="no"
    data-variant={variant}
    onOpenAutoFocus={(event) => {
      onOpenAutoFocus?.(event);
      if (!event.defaultPrevented) selectTextOnAutoFocus(ref);
    }}
    class={cn(
      "tw:text-popover-foreground tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:data-[state=closed]:[--tw-exit-scale:.95] tw:data-[state=open]:[--tw-enter-scale:.95] tw:data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] tw:data-[side=left]:[--tw-enter-translate-x:0.5rem] tw:data-[side=right]:[--tw-enter-translate-x:-0.5rem] tw:data-[side=top]:[--tw-enter-translate-y:0.5rem] tw:z-50 tw:w-72 tw:origin-(--bits-popover-content-transform-origin) tw:rounded-[var(--vb-studio-surface-radius,0.625rem)] tw:overflow-hidden tw:outline-hidden",
      variant === "glass"
        ? "tw:bg-glass tw:backdrop-blur-[32px] tw:shadow-glass-panel tw:rounded-[0.875rem] tw:px-3.5 tw:py-3"
        : "tw:bg-popover tw:border-border tw:border tw:p-4 tw:shadow-md",
      className,
    )}
    {...rest}
  />
</PopoverPrimitive.Portal>
