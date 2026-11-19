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
      "text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] data-[state=closed]:[--tw-exit-scale:.95] data-[state=open]:[--tw-enter-scale:.95] data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] data-[side=left]:[--tw-enter-translate-x:0.5rem] data-[side=right]:[--tw-enter-translate-x:-0.5rem] data-[side=top]:[--tw-enter-translate-y:0.5rem] z-50 w-72 origin-(--bits-popover-content-transform-origin) rounded-[var(--vb-studio-surface-radius,0.625rem)] overflow-hidden outline-hidden",
      variant === "glass"
        ? "bg-glass backdrop-blur-[32px] shadow-glass-panel rounded-[0.875rem] px-3.5 py-3"
        : "bg-popover border-border border p-4 shadow-md",
      className,
    )}
    {...rest}
  />
</PopoverPrimitive.Portal>
