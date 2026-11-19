<script lang="ts" module>
  const SIDES = {
    right:
      "data-[state=closed]:[--tw-exit-translate-x:100%] data-[state=open]:[--tw-enter-translate-x:100%] inset-y-0 right-0 h-full w-3/4 border-border border-l",
    left: "data-[state=closed]:[--tw-exit-translate-x:-100%] data-[state=open]:[--tw-enter-translate-x:-100%] inset-y-0 left-0 h-full w-3/4 border-border border-r",
    top: "data-[state=closed]:[--tw-exit-translate-y:-100%] data-[state=open]:[--tw-enter-translate-y:-100%] inset-x-0 top-0 h-auto border-border border-b",
    bottom:
      "data-[state=closed]:[--tw-exit-translate-y:100%] data-[state=open]:[--tw-enter-translate-y:100%] inset-x-0 bottom-0 h-auto border-border border-t",
  } as const;
</script>

<script lang="ts">
  import { Dialog as SheetPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
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
    class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:[--tw-exit-opacity:0] data-[state=open]:[--tw-enter-opacity:0] fixed inset-0 z-50 bg-[rgb(0_0_0/0.5)]"
  />
  <SheetPrimitive.Content
    bind:ref
    data-slot="sheet-content"
    onOpenAutoFocus={(event) => {
      onOpenAutoFocus?.(event);
      if (!event.defaultPrevented) selectTextOnAutoFocus(ref);
    }}
    class={cn(
      "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-200 data-[state=open]:duration-200",
      SIDES[side],
      (side === "left" || side === "right") &&
        (size === "lg" ? "w-full md:max-w-xl" : "md:max-w-sm"),
      className,
    )}
    {...rest}
  >
    {@render children?.()}
    {#if !hideCloseButton}
      <SheetPrimitive.Close
        class="absolute top-4 right-4 cursor-pointer rounded-lg opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed"
      >
        <Icon icon="x" class="size-4" />
        <span class="sr-only">Close</span>
      </SheetPrimitive.Close>
    {/if}
  </SheetPrimitive.Content>
</SheetPrimitive.Portal>
