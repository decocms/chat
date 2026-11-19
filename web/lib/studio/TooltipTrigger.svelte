<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";

  /** Ported from @decocms/ui `TooltipTrigger`. The `child` snippet replaces `asChild`. */
  let {
    ref = $bindable(null),
    ...rest
  }: Omit<TooltipPrimitive.TriggerProps, "style"> = $props();
</script>

<TooltipPrimitive.Trigger bind:ref data-slot="tooltip-trigger" {...rest} />
