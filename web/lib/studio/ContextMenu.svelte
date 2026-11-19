<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

  /** Ported from @decocms/ui `ContextMenu`; `defaultOpen` is the initial value of `open`. */
  let { open = $bindable(false), ...rest }: ContextMenuPrimitive.RootProps =
    $props();
</script>

<ContextMenuPrimitive.Root bind:open {...rest} />
