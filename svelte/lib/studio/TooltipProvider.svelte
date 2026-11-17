<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { setContext } from "svelte";
  import { TOOLTIP_PROVIDER } from "./tooltip";

  /** Ported from @decocms/ui `TooltipProvider`: tooltips open without a delay unless told otherwise. Tooltips inside one provider share it, so only one is open at a time. */
  let { delayDuration = 0, ...rest }: TooltipPrimitive.ProviderProps = $props();
  setContext(TOOLTIP_PROVIDER, true);
</script>

<TooltipPrimitive.Provider {delayDuration} {...rest} />
