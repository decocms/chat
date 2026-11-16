<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";

  /** Ported from @decocms/ui `TooltipProvider`: tooltips open without a delay unless told otherwise. */
  let { delayDuration = 0, ...rest }: TooltipPrimitive.ProviderProps = $props();
</script>

<TooltipPrimitive.Provider {delayDuration} {...rest} />
