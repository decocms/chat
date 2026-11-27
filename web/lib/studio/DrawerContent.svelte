<script lang="ts">
  import { Dialog as DrawerPrimitive } from "bits-ui";
  import { getContext, untrack, type Snippet } from "svelte";
  import DrawerHandle from "./DrawerHandle.svelte";
  import {
    createDrawerMotion,
    DRAWER_ANIMATION,
    DRAWER_CONTEXT,
    drawerPanel,
    type DrawerContext,
    type DrawerMotion,
    type DrawerSide,
  } from "./drawer";
  import { selectTextOnAutoFocus } from "./overlay";
  import { cn } from "./utils";

  /**
   * Every phone drawer (Gimenes #6174, #6221). One engine (createDrawerMotion) slides it and drags it, from the panel,
   * the grab bar or the scrim, on any side; only `side` changes the look. Put it in a `Drawer`.
   * - `closeLabel` names the grab bar (top and bottom; on the left and the right the drag is enough).
   * - `class` styles the content (padding, gap, scroll); `surfaceClass` the panel (its colors); `fill` makes it as
   *   tall as it may be. `overlayProps` go on the scrim.
   */
  let {
    class: className,
    surfaceClass,
    children,
    side = "bottom",
    fill = false,
    closeLabel,
    overlayProps = {},
    onOpenAutoFocus,
    ref = $bindable(null),
    ...rest
  }: Omit<DrawerPrimitive.ContentProps, "child" | "children" | "forceMount"> & {
    side?: DrawerSide;
    fill?: boolean;
    closeLabel: string;
    surfaceClass?: string;
    /** Test hooks and a name for the scrim (`data-room-scrim`, `aria-label`). */
    overlayProps?: Partial<Record<`data-${string}` | "aria-label", string>>;
    children?: Snippet;
  } = $props();

  const drawer = getContext<DrawerContext>(DRAWER_CONTEXT);
  const panel = $derived(drawerPanel({ side, fill }));
  let overlay = $state<HTMLElement | null>(null),
    surface = $state<HTMLElement | null>(null),
    presented = $state(false),
    motion: DrawerMotion | null = null;
  // Mounted while open or still sliding out; the engine says when it is fully closed.
  const mounted = $derived(drawer.open() || presented);

  $effect(() => {
    if (!ref || !overlay || !surface) return;
    const place = ref,
      scrim = overlay,
      body = surface;
    const engine = createDrawerMotion({
      side: () => side,
      panel: place,
      scrim,
      request: (open) => {
        if (!open) drawer.close();
      },
      presented: (shown) => (presented = shown),
    });
    const offs = [
      engine.bind(body, "panel"),
      engine.bind(scrim, "scrim"),
      ...[...body.querySelectorAll<HTMLElement>("[data-drawer-handle]")].map(
        (handle) => engine.bind(handle, "handle"),
      ),
    ];
    motion = engine;
    untrack(() => engine.sync(drawer.open()));
    return () => {
      for (const off of offs) off();
      engine.dispose();
      if (motion === engine) motion = null;
    };
  });
  $effect(() => {
    const open = drawer.open();
    motion?.sync(open);
  });
</script>

{#if mounted}<DrawerPrimitive.Portal>
    <DrawerPrimitive.Overlay
      bind:ref={overlay}
      forceMount
      data-slot="drawer-overlay"
      onclick={() => drawer.close()}
      class="fixed inset-0 z-50 animate-drawer-scrim touch-none bg-scrim backdrop-blur-sm"
      {...overlayProps}
    />
    <DrawerPrimitive.Content
      bind:ref
      forceMount
      data-slot="drawer-content"
      data-side={side}
      interactOutsideBehavior="ignore"
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (!event.defaultPrevented) selectTextOnAutoFocus(ref);
      }}
      class={cn(
        panel.place(),
        "fixed z-50 outline-none",
        DRAWER_ANIMATION[side],
      )}
      {...rest}
    >
      <div
        bind:this={surface}
        data-drawer-surface
        class={panel.surface({ class: surfaceClass })}
      >
        {#if side === "bottom"}<DrawerHandle
            label={closeLabel}
            onclick={() => drawer.close()}
          />{/if}
        <div class={cn("flex min-h-0 flex-1 flex-col", className)}>
          {@render children?.()}
        </div>
        {#if side === "top"}<DrawerHandle
            label={closeLabel}
            onclick={() => drawer.close()}
          />{/if}
      </div>
    </DrawerPrimitive.Content>
  </DrawerPrimitive.Portal>{/if}
