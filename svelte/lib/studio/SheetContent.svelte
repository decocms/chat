<script lang="ts" module>
  const SIDES = {
    right:
      "tw:data-[state=closed]:[--tw-exit-translate-x:100%] tw:data-[state=open]:[--tw-enter-translate-x:100%] tw:inset-y-0 tw:right-0 tw:h-full tw:w-3/4 tw:border-border tw:border-l",
    left: "tw:data-[state=closed]:[--tw-exit-translate-x:-100%] tw:data-[state=open]:[--tw-enter-translate-x:-100%] tw:inset-y-0 tw:left-0 tw:h-full tw:w-3/4 tw:border-border tw:border-r",
    top: "tw:data-[state=closed]:[--tw-exit-translate-y:-100%] tw:data-[state=open]:[--tw-enter-translate-y:-100%] tw:inset-x-0 tw:top-0 tw:h-auto tw:border-border tw:border-b",
    bottom:
      "tw:data-[state=closed]:[--tw-exit-translate-y:100%] tw:data-[state=open]:[--tw-enter-translate-y:100%] tw:inset-x-0 tw:bottom-0 tw:h-auto tw:border-border tw:border-t",
  } as const;
</script>

<script lang="ts">
  import { Dialog as SheetPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { X } from "./icons";
  import { selectTextOnAutoFocus } from "./overlay";
  import { cn } from "./utils";

  /** `size` is the width of a left or right sheet. */
  let {
    class: className,
    children,
    side = "right",
    size = "sm",
    hideCloseButton = false,
    onOpenAutoFocus,
    ref = $bindable(null),
    ...rest
  }: Omit<SheetPrimitive.ContentProps, "child"> & {
    side?: keyof typeof SIDES;
    size?: "sm" | "lg";
    hideCloseButton?: boolean;
  } = $props();
</script>

<SheetPrimitive.Portal>
  <SheetPrimitive.Overlay
    data-slot="sheet-overlay"
    class="tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:data-[state=closed]:[--tw-exit-opacity:0] tw:data-[state=open]:[--tw-enter-opacity:0] tw:fixed tw:inset-0 tw:z-50 tw:bg-[rgb(0_0_0/0.5)]"
  />
  <SheetPrimitive.Content
    bind:ref
    data-slot="sheet-content"
    onOpenAutoFocus={(event) => {
      onOpenAutoFocus?.(event);
      if (!event.defaultPrevented) selectTextOnAutoFocus(ref);
    }}
    class={cn(
      "tw:bg-background tw:data-[state=open]:animate-in tw:data-[state=closed]:animate-out tw:fixed tw:z-50 tw:flex tw:flex-col tw:gap-4 tw:shadow-lg tw:transition tw:ease-in-out tw:data-[state=closed]:duration-200 tw:data-[state=open]:duration-200",
      SIDES[side],
      (side === "left" || side === "right") &&
        (size === "lg" ? "tw:w-full tw:sm:max-w-xl" : "tw:sm:max-w-sm"),
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    {#if !hideCloseButton}
      <SheetPrimitive.Close
        class="tw:absolute tw:top-4 tw:right-4 tw:cursor-pointer tw:rounded-lg tw:opacity-70 tw:transition-opacity tw:hover:opacity-100 tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:disabled:pointer-events-none tw:disabled:cursor-not-allowed"
      >
        <Icon icon={X} class="tw:size-4" />
        <span class="tw:sr-only">Close</span>
      </SheetPrimitive.Close>
    {/if}
  </SheetPrimitive.Content>
</SheetPrimitive.Portal>
