<script lang="ts">
  import { Dialog as DrawerPrimitive } from "bits-ui";
  import { getContext, type Snippet } from "svelte";
  import DrawerHandle from "./DrawerHandle.svelte";
  import {
    DRAWER_CONTEXT,
    dragToClose,
    drawerPanel,
    type DrawerContext,
    type DrawerSide,
  } from "./drawer";
  import { selectTextOnAutoFocus } from "./overlay";
  import { cn } from "./utils";

  /**
   * The phone drawer (Gimenes #6174): one panel for every side, with the room drawer's slide (360 ms open, 260 ms
   * close, `ease-drawer`), its grab bar and its drag to close. Put it in a `Drawer`. `closeLabel` names the grab bar;
   * the left and the right have no grab bar, the drag is enough. `class` styles the surface (padding, gap, scroll).
   */
  let {
    class: className,
    children,
    side = "bottom",
    closeLabel,
    onOpenAutoFocus,
    ref = $bindable(null),
    ...rest
  }: Omit<DrawerPrimitive.ContentProps, "child" | "children"> & {
    side?: DrawerSide;
    closeLabel: string;
    children?: Snippet;
  } = $props();

  const drawer = getContext<DrawerContext>(DRAWER_CONTEXT);
  const SLIDE = {
    top: "data-[state=open]:[--tw-enter-translate-y:-100%] data-[state=closed]:[--tw-exit-translate-y:-100%]",
    bottom:
      "data-[state=open]:[--tw-enter-translate-y:100%] data-[state=closed]:[--tw-exit-translate-y:100%]",
    left: "data-[state=open]:[--tw-enter-translate-x:-100%] data-[state=closed]:[--tw-exit-translate-x:-100%]",
    right:
      "data-[state=open]:[--tw-enter-translate-x:100%] data-[state=closed]:[--tw-exit-translate-x:100%]",
  } as const;
  const panel = $derived(drawerPanel({ side }));
</script>

<DrawerPrimitive.Portal>
  <DrawerPrimitive.Overlay
    data-slot="drawer-overlay"
    class="fixed inset-0 z-50 bg-scrim backdrop-blur-sm ease-drawer data-[state=open]:animate-in data-[state=open]:duration-[360ms] data-[state=open]:[--tw-enter-opacity:0] data-[state=closed]:animate-out data-[state=closed]:duration-[260ms] data-[state=closed]:[--tw-exit-opacity:0] motion-reduce:duration-0"
  />
  <DrawerPrimitive.Content
    bind:ref
    data-slot="drawer-content"
    data-side={side}
    onOpenAutoFocus={(event) => {
      onOpenAutoFocus?.(event);
      if (!event.defaultPrevented) selectTextOnAutoFocus(ref);
    }}
    class={cn(
      panel.place(),
      "fixed z-50 ease-drawer outline-none data-[state=open]:animate-in data-[state=open]:duration-[360ms] data-[state=closed]:animate-out data-[state=closed]:duration-[260ms] motion-reduce:duration-0",
      SLIDE[side],
    )}
    {...rest}
  >
    <div
      data-drawer-surface
      class={panel.surface()}
      use:dragToClose={{ side, onclose: () => drawer?.close() }}
    >
      {#if side === "bottom"}<DrawerHandle
          label={closeLabel}
          onclick={() => drawer?.close()}
        />{/if}
      <div class={cn("flex min-h-0 flex-1 flex-col", className)}>
        {@render children?.()}
      </div>
      {#if side === "top"}<DrawerHandle
          label={closeLabel}
          onclick={() => drawer?.close()}
        />{/if}
    </div>
  </DrawerPrimitive.Content>
</DrawerPrimitive.Portal>
