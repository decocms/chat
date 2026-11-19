<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";

  let { ...rest }: ContextMenuPrimitive.PortalProps = $props();
</script>

<ContextMenuPrimitive.Portal {...rest} />
