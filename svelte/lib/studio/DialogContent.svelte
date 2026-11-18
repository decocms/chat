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
      "tw:bg-glass tw:backdrop-blur-[32px] tw:shadow-glass-panel tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:data-[state=closed]:[--tw-exit-scale:0.96] tw:data-[state=open]:[--tw-enter-scale:0.96] tw:fixed tw:top-[50%] tw:left-[50%] tw:z-50 tw:grid tw:w-full tw:max-w-[calc(100%-2rem)] tw:translate-x-[-50%] tw:translate-y-[-50%] tw:gap-5 tw:rounded-2xl tw:p-6 tw:duration-300 tw:ease-[cubic-bezier(0.22,1,0.36,1)] tw:md:max-w-lg",
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    <DialogPrimitive.Close
      class={cn(
        "tw:cursor-pointer tw:text-muted-foreground tw:hover:text-foreground tw:hover:bg-accent tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2",
        "tw:absolute tw:top-5 tw:right-5 tw:flex tw:size-7 tw:items-center tw:justify-center tw:rounded-full tw:transition-colors",
        "tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4",
        closeButtonClassName,
      )}
    >
      <Icon icon={X} />
      <span class="tw:sr-only">{closeLabel}</span>
    </DialogPrimitive.Close>
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>
