<script lang="ts">
  import { Dialog as DrawerPrimitive } from "bits-ui";
  import { setContext } from "svelte";
  import { DRAWER_CONTEXT, type DrawerContext } from "./drawer";

  /** The root of a phone drawer (a bits-ui dialog): put one `DrawerContent` in it. */
  let { open = $bindable(false), ...rest }: DrawerPrimitive.RootProps =
    $props();
  setContext<DrawerContext>(DRAWER_CONTEXT, { close: () => (open = false) });
</script>

<DrawerPrimitive.Root bind:open {...rest} />
