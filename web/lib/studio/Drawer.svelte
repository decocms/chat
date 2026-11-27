<script lang="ts">
  import { Dialog as DrawerPrimitive } from "bits-ui";
  import { setContext } from "svelte";
  import { DRAWER_CONTEXT, type DrawerContext } from "./drawer";

  /**
   * The root of a phone drawer (a bits-ui dialog): put one `DrawerContent` in it. `bind:open`, or `open` with
   * `onOpenChange` when the owner decides (the room closes its drawer through history).
   */
  let {
    open = $bindable(false),
    onOpenChange,
    ...rest
  }: DrawerPrimitive.RootProps = $props();
  setContext<DrawerContext>(DRAWER_CONTEXT, {
    open: () => open,
    close: () => {
      if (!open) return;
      open = false;
      onOpenChange?.(false);
    },
  });
</script>

<DrawerPrimitive.Root bind:open {onOpenChange} {...rest} />
