<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { setContext } from "svelte";
  import { SHARED_TOOLTIP_PROVIDER } from "./tooltipContext";

  /**
   * Ported from @decocms/ui `TooltipProvider`: tooltips open without a delay unless told otherwise.
   * Wrap a group of tooltips (a toolbar) in one so moving between them swaps the tooltip at once
   * instead of fading one out while the next fades in.
   */
  let { delayDuration = 0, ...rest }: TooltipPrimitive.ProviderProps = $props();
  setContext(SHARED_TOOLTIP_PROVIDER, true);
</script>

<TooltipPrimitive.Provider {delayDuration} {...rest} />
