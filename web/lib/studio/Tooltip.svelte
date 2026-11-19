<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { getContext } from "svelte";
  import TooltipProvider from "./TooltipProvider.svelte";
  import { SHARED_TOOLTIP_PROVIDER } from "./tooltipContext";

  /**
   * Ported from @decocms/ui `Tooltip`: on its own it carries its own provider, so it works
   * anywhere; inside a `TooltipProvider` it joins that one, so its siblings hand off instantly.
   */
  let { open = $bindable(false), ...rest }: TooltipPrimitive.RootProps =
    $props();
  const shared = getContext<boolean>(SHARED_TOOLTIP_PROVIDER) === true;
</script>

{#if shared}
  <TooltipPrimitive.Root bind:open {...rest} />
{:else}
  <TooltipProvider>
    <TooltipPrimitive.Root bind:open {...rest} />
  </TooltipProvider>
{/if}
