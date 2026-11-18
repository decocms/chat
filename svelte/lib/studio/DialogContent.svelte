<script lang="ts">
  import { Dialog as DialogPrimitive } from "bits-ui";
  import DialogOverlay from "./DialogOverlay.svelte";
  import Icon from "./Icon.svelte";
  import { X } from "./icons";
  import { selectTextOnAutoFocus } from "./overlay";
  import { cn } from "./utils";

  let {
    class: className,
    children,
    closeButtonClassName,
    closeLabel = "Close",
    onOpenAutoFocus,
    ref = $bindable(null),
    ...rest
  }: Omit<DialogPrimitive.ContentProps, "child"> & {
    closeButtonClassName?: string;
    /** The close button's accessible name, for apps that are not in English. */
    closeLabel?: string;
  } = $props();
</script>

<DialogPrimitive.Portal>
  <DialogOverlay />
  <DialogPrimitive.Content
    bind:ref
    data-slot="dialog-content"
    onOpenAutoFocus={(event) => {
      onOpenAutoFocus?.(event);
      if (!event.defaultPrevented) selectTextOnAutoFocus(ref);
    }}
    class={cn(
      "bg-glass backdrop-blur-[32px] shadow-glass-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] data-[state=closed]:[--tw-exit-scale:0.96] data-[state=open]:[--tw-enter-scale:0.96] fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-5 rounded-2xl p-6 duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:max-w-lg",
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    <DialogPrimitive.Close
      class={cn(
        "cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2",
        "absolute top-5 right-5 flex size-7 items-center justify-center rounded-full transition-colors",
        "disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        closeButtonClassName,
      )}
    >
      <Icon icon={X} />
      <span class="sr-only">{closeLabel}</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
