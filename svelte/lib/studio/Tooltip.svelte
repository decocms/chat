<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import TooltipProvider from "./TooltipProvider.svelte";

  /** Ported from @decocms/ui `Tooltip`: each one carries its own provider, so it works anywhere. */
  let { open = $bindable(false), ...rest }: TooltipPrimitive.RootProps =
    $props();
</script>

<TooltipProvider>
  <TooltipPrimitive.Root bind:open {...rest} />
</TooltipProvider>
